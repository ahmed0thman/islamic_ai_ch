# /// script
# requires-python = ">=3.10"
# dependencies = ["mlx-whisper", "yt-dlp[default]"]
# ///
"""Transcribe YouTube lectures that have no usable Arabic captions, locally (Apple Silicon).

Usage (from the repo root):
  uv run tools/whisper_batch.py <jobs.tsv>

<jobs.tsv> has one video per line: `<series-dir>\t<nn>\t<video-id>`. For each line:
  1. audio is downloaded to `.cache/audio/` (git-ignored) unless already there;
  2. mlx-whisper large-v3-turbo transcribes it with language=ar;
  3. the result goes straight to `references/<series-dir>/raw/<nn>-<id>.whisper.json`.
Finished files are skipped, so the job can be re-run after an interruption.
yt-dlp needs a JS runtime for YouTube media; Node is passed explicitly.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import mlx_whisper

CACHE = Path(".cache/audio")
MODEL = "mlx-community/whisper-large-v3-turbo"


def audio_for(vid: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"{vid}.m4a"
    for attempt in range(3):  # YouTube sometimes answers 403 once and then serves the same URL
        if out.exists():
            return out
        subprocess.run([sys.executable, "-m", "yt_dlp", "-q", "--no-warnings", "--js-runtimes", "node",
                        "-f", "bestaudio", "-x", "--audio-format", "m4a",
                        "-o", str(CACHE / f"{vid}.%(ext)s"), f"https://www.youtube.com/watch?v={vid}"])
        time.sleep(10 * (attempt + 1))
    if not out.exists():
        raise RuntimeError(f"audio download failed 3 times: {vid}")
    return out


def main():
    jobs = [l.split("\t") for l in Path(sys.argv[1]).read_text().splitlines() if l.strip()]
    for series, nn, vid in jobs:
        dst = Path("references") / series / "raw" / f"{nn}-{vid}.whisper.json"
        if dst.exists():
            continue
        t = time.time()
        try:
            audio = audio_for(vid)
        except RuntimeError as e:
            print(f"ERROR {e}", flush=True)  # skip it; a re-run retries only the missing ones
            continue
        r = mlx_whisper.transcribe(str(audio), path_or_hf_repo=MODEL, language="ar",
                                   condition_on_previous_text=False, verbose=None)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(json.dumps({"model": MODEL, "segments": [
            {"start": s["start"], "end": s["end"], "text": s["text"]} for s in r["segments"]]},
            ensure_ascii=False))
        print(f"{dst} {r['segments'][-1]['end']:.0f}s audio in {time.time() - t:.0f}s", flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
