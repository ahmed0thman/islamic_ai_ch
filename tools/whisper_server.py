# /// script
# requires-python = ">=3.10"
# dependencies = ["mlx-whisper"]
# ///
"""Local speech-to-text server backed by mlx-whisper (Apple Silicon).

Usage (from the repo root):
  uv run --offline tools/whisper_server.py

Serves an OpenAI-compatible transcription endpoint on 127.0.0.1:
  GET  /health                     -> {"ok": true, "model": ...}
  POST /v1/audio/transcriptions    -> multipart form like Groq's endpoint
Set HUDA_VOICE_STT_URL=http://127.0.0.1:8178/v1 in the app to use it.
One request at a time: the model must never run twice in parallel.
"""
import os

os.environ.setdefault("HF_HUB_OFFLINE", "1")

import email.parser
import email.policy
import json
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import mlx_whisper

MODEL = "mlx-community/whisper-large-v3-turbo"
HOST = "127.0.0.1"
PORT = int(os.environ.get("HUDA_WHISPER_PORT", "8178"))
MAX_BYTES = 26 * 1024 * 1024
HEALTH_PATH = "/health"
TRANSCRIBE_PATH = "/v1/audio/transcriptions"


def parse_form(content_type: str, body: bytes) -> dict:
    """Splits a multipart/form-data body into its fields, stdlib only."""
    message = email.parser.BytesParser(policy=email.policy.HTTP).parsebytes(
        b"Content-Type: " + content_type.encode("ascii", "replace") + b"\r\n\r\n" + body)
    fields: dict = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        payload = part.get_payload(decode=True)
        if name == "file":
            fields["file_bytes"] = payload
            fields["file_name"] = part.get_filename()
        elif name == "language":
            fields["language"] = (payload or b"").decode("utf-8", "replace").strip()
        elif name == "prompt":
            fields["prompt"] = (payload or b"").decode("utf-8", "replace")
        elif name == "temperature":
            try:
                fields["temperature"] = float((payload or b"0").decode("ascii", "replace"))
            except ValueError:
                fields["temperature"] = 0.0
    return fields


class WhisperHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # access log stays silent
        pass

    def _send_json(self, status: int, payload: dict) -> None:
        self._send_bytes(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _send_bytes(self, status: int, data: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _log_transcription(self, started: float, nbytes: int, nchars: int, status: int) -> None:
        ms = int((time.time() - started) * 1000)
        print(f"transcribe ms={ms} bytes={nbytes} chars={nchars} status={status}",
              file=sys.stderr, flush=True)

    def do_GET(self):
        if self.path != HEALTH_PATH:
            self._send_json(404, {"error": "not_found"})
            return
        self._send_json(200, {"ok": True, "model": MODEL})

    def do_POST(self):
        if self.path != TRANSCRIBE_PATH:
            self._send_json(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self._send_json(400, {"error": "bad_request"})
            return
        if length > MAX_BYTES:
            self._send_json(413, {"error": "too_large"})
            return
        body = self.rfile.read(length)
        try:
            fields = parse_form(self.headers.get("Content-Type", ""), body)
        except Exception:
            self._send_json(400, {"error": "bad_request"})
            return
        file_bytes = fields.get("file_bytes")
        if not file_bytes:
            self._send_json(400, {"error": "bad_request"})
            return
        language = fields.get("language") or "ar"
        prompt = fields.get("prompt") or None
        temperature = fields.get("temperature", 0)
        suffix = os.path.splitext(fields.get("file_name") or "")[1] or ".webm"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        try:
            tmp.write(file_bytes)
            tmp.close()
            started = time.time()
            try:
                result = mlx_whisper.transcribe(tmp.name, path_or_hf_repo=MODEL, language=language,
                                                 initial_prompt=prompt or None, temperature=temperature,
                                                 condition_on_previous_text=False, verbose=None)
            except Exception:
                self._log_transcription(started, len(file_bytes), 0, 500)
                self._send_json(500, {"error": "transcription_failed"})
                return
            text = result["text"].strip()
            payload = {
                "text": text,
                "language": language,
                "segments": [
                    {"start": s["start"], "end": s["end"], "text": s["text"],
                     "no_speech_prob": s.get("no_speech_prob", 0.0)}
                    for s in result.get("segments", [])
                ],
            }
            self._log_transcription(started, len(file_bytes), len(text), 200)
            self._send_bytes(200, json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass


def main():
    try:
        import numpy
        mlx_whisper.transcribe(numpy.zeros(16000, dtype=numpy.float32),
                               path_or_hf_repo=MODEL, language="ar", verbose=None)
    except Exception:
        pass
    print(f"ready http://{HOST}:{PORT}", file=sys.stderr, flush=True)
    server = HTTPServer((HOST, PORT), WhisperHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
