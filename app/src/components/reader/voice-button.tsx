"use client";

import { useEffect, useRef, useState } from "react";
import { Mic01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Ui } from "@/lib/types";
import {
  clock, fileNameFor, LIVE_EVERY_MS, LIVE_MIN_MS, liveAllowed, MAX_RECORDING_MS,
  nextAfterFinal, pickMimeType, TIMESLICE_MS, type VoiceState,
} from "@/lib/voice-client";

const FINAL_TIMEOUT_MS = 25_000;
/** Below this the recording holds no usable words; only the provisional text, if any, survives. */
const MIN_BLOB_BYTES = 2000;

type TranscribeResult = { status: string; text?: string };

/**
 * The microphone of the ask sheet. One tap records; while it records, the growing recording is posted every
 * LIVE_EVERY_MS for a provisional transcript that appears in the question box; the next tap posts the whole
 * recording once and its text replaces the provisional one. It never submits, and nothing is kept after a send.
 */
export function VoiceButton({ surah, depth, stop, ui, disabled = false, onStart, onLive, onFinal }: {
  surah: number; depth: number; stop: number | null; ui: Ui; disabled?: boolean;
  onStart: () => void; onLive: (text: string) => void; onFinal: (text: string | null) => void;
}) {
  const [supported, setSupported] = useState(false); // decided on the client so server and client HTML match
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [liveOn, setLiveOn] = useState(false);
  const alive = useRef(true);
  const stateRef = useRef<VoiceState>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clockTimer = useRef<number | null>(null);
  const hardTimer = useRef<number | null>(null);
  const liveTimer = useRef<number | null>(null);
  const liveAbort = useRef<AbortController | null>(null);
  const finalAbort = useRef<AbortController | null>(null);
  const liveText = useRef("");
  const liveSeq = useRef(0);
  const lastApplied = useRef(0);
  const liveFailures = useRef(0);
  const liveInFlight = useRef(false);
  const startedAt = useRef(0);
  const starting = useRef(false); // a second tap while the permission prompt is open must not ask twice

  const setVoiceState = (next: VoiceState) => { stateRef.current = next; if (alive.current) setState(next); };

  useEffect(() => {
    // lib.dom types `mediaDevices` as always present; older browsers and non-secure contexts lack it, hence the cast.
    const mediaDevices = (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    setSupported(Boolean(window.isSecureContext && mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"));
  }, []);

  // On unmount: every timer cleared, every request aborted, the recorder and the mic released.
  useEffect(() => () => {
    alive.current = false;
    clearTimers();
    liveAbort.current?.abort();
    finalAbort.current?.abort();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.removeEventListener("stop", onRecorderStop); // no final send for a recording nobody hears the end of
      try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* releasing the mic never throws */ }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  function clearTimers() {
    if (clockTimer.current !== null) { window.clearInterval(clockTimer.current); clockTimer.current = null; }
    if (hardTimer.current !== null) { window.clearTimeout(hardTimer.current); hardTimer.current = null; }
    if (liveTimer.current !== null) { window.clearInterval(liveTimer.current); liveTimer.current = null; }
  }

  /** One POST to the transcription endpoint; any non-2xx, a `busy`, or a network failure is a failure status. */
  async function postTranscribe(blob: Blob, live: boolean, signal: AbortSignal): Promise<TranscribeResult> {
    const form = new FormData();
    form.set("audio", blob, fileNameFor(blob.type));
    form.set("surah", String(surah));
    form.set("depth", String(depth));
    if (stop !== null) form.set("stop", String(stop));
    if (live) form.set("live", "1");
    try {
      const response = await fetch("/api/transcribe/", { method: "POST", body: form, signal });
      if (response.status === 429) return { status: "busy" };
      if (!response.ok) return { status: "error" };
      const body: unknown = await response.json();
      return typeof body === "object" && body !== null && typeof (body as TranscribeResult).status === "string" ? body as TranscribeResult : { status: "error" };
    } catch {
      return { status: "error" };
    }
  }

  /** The tap: getUserMedia is called directly here (iOS grants it only inside the gesture), then the recording starts. */
  function start() {
    if (starting.current) return;
    starting.current = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((media) => {
      starting.current = false;
      if (!alive.current) { media.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = media;
      // Older WebKit lacks the static method entirely; the cast keeps `undefined` representable.
      const isTypeSupported = (MediaRecorder as unknown as { isTypeSupported?: (type: string) => boolean }).isTypeSupported;
      const mime = pickMimeType(isTypeSupported?.bind(MediaRecorder));
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      } catch {
        media.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setVoiceState("failed");
        return;
      }
      recorderRef.current = recorder;
      chunksRef.current = [];
      liveText.current = "";
      liveSeq.current = 0;
      lastApplied.current = 0;
      liveFailures.current = 0;
      liveInFlight.current = false;
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); });
      recorder.addEventListener("stop", onRecorderStop);
      for (const track of media.getTracks()) track.addEventListener("ended", onTrackEnded);
      recorder.start(TIMESLICE_MS);
      startedAt.current = Date.now();
      setElapsed(0);
      const canLive = liveAllowed(recorder.mimeType || mime);
      setLiveOn(canLive);
      setVoiceState("listening");
      onStart();
      clockTimer.current = window.setInterval(() => { if (alive.current) setElapsed(Date.now() - startedAt.current); }, 1000);
      hardTimer.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
      if (canLive) liveTimer.current = window.setInterval(liveTick, LIVE_EVERY_MS);
    }, () => { starting.current = false; setVoiceState("denied"); });
  }

  /** One provisional send of the recording so far; late answers are dropped, failures are counted and never shown. */
  function liveTick() {
    const recorder = recorderRef.current;
    if (!recorder || liveInFlight.current) return;
    if (Date.now() - startedAt.current < LIVE_MIN_MS) return;
    if (liveFailures.current >= 2) return;
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
    const seq = ++liveSeq.current;
    const controller = new AbortController();
    liveAbort.current = controller;
    liveInFlight.current = true;
    void postTranscribe(blob, true, controller.signal).then((result) => {
      liveInFlight.current = false;
      if (!alive.current || controller.signal.aborted) return;
      if (result.status === "ok" && result.text) {
        if (seq > lastApplied.current) {
          lastApplied.current = seq;
          liveText.current = result.text;
          onLive(result.text);
        }
      } else if (result.status !== "empty") {
        liveFailures.current += 1;
      }
    });
  }

  /** The second tap, the hard stop, or the mic going away: timers off, provisional send aborted, recorder flushed. */
  function stopRecording() {
    if (stateRef.current !== "listening") return;
    clearTimers();
    liveAbort.current?.abort();
    setVoiceState("finalizing");
    recorderRef.current?.stop(); // the final blob is assembled in onRecorderStop
  }

  function onTrackEnded() { stopRecording(); }

  function onRecorderStop() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const blob = new Blob(chunksRef.current, { type: recorder?.mimeType });
    chunksRef.current = []; // the recording is released; only the send holds it now
    void finalize(blob);
  }

  /** The whole recording goes once more; the final text replaces the provisional one. onFinal fires exactly once. */
  async function finalize(blob: Blob) {
    if (blob.size < MIN_BLOB_BYTES) {
      setVoiceState(nextAfterFinal(undefined, Boolean(liveText.current)));
      onFinal(null);
      return;
    }
    const controller = new AbortController();
    finalAbort.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), FINAL_TIMEOUT_MS);
    const result = await postTranscribe(blob, false, controller.signal);
    window.clearTimeout(timeout);
    finalAbort.current = null;
    if (result.status === "ok" && result.text) {
      setVoiceState("review");
      onFinal(result.text);
    } else {
      setVoiceState(nextAfterFinal(result.status, Boolean(liveText.current)));
      onFinal(null);
    }
  }

  function onTap() {
    if (stateRef.current === "listening") { stopRecording(); return; }
    if (stateRef.current === "finalizing") return;
    start();
  }

  if (!supported) return null;
  const listening = state === "listening";
  return <>
    <span className="ask-voice">
      <Button variant="round" size="icon" onClick={onTap}
        disabled={state === "finalizing" || (disabled && !listening)}
        aria-label={listening ? ui.ask.voice_stop : ui.ask.voice_start}
        aria-pressed={listening}
        data-state={listening ? "listening" : undefined}>
        <Icon icon={listening ? StopIcon : Mic01Icon} />
      </Button>
    </span>
    {state === "idle" ? null : <div className="ask-voice-status" role="status" aria-live="polite">
      {listening ? <>
        <p><span className="ask-voice-dot" aria-hidden="true" /> {ui.ask.voice_listening} <span className="ask-voice-clock">{clock(elapsed)}</span></p>
        {liveOn ? <p className="ask-voice-note">{ui.ask.voice_live_note}</p> : null}
        <p className="ask-voice-note">{ui.ask.voice_privacy}</p>
      </> : null}
      {state === "finalizing" ? <p>{ui.ask.voice_transcribing}</p> : null}
      {state === "review" ? <p>{ui.ask.voice_review}</p> : null}
      {state === "partial" ? <p>{ui.ask.voice_partial}</p> : null}
      {state === "denied" ? <p>{ui.ask.voice_denied}</p> : null}
      {state === "failed" ? <p>{ui.ask.voice_failed}</p> : null}
    </div>}
  </>;
}
