"use client";

import { useEffect, useRef, useState } from "react";
import {
  clock, fileNameFor, LIVE_EVERY_MS, LIVE_MIN_MS, liveAllowed, MAX_RECORDING_MS,
  nextAfterFinal, pickMimeType, TIMESLICE_MS, type VoiceState, levelFrom
} from "@/lib/voice-client";

const FINAL_TIMEOUT_MS = 25_000;
/** Below this the recording holds no usable words; only the provisional text, if any, survives. */
const MIN_BLOB_BYTES = 2000;

type TranscribeResult = { status: string; text?: string };

export function useVoice({ surah, depth, stop, onStart, onLive, onFinal, onLevel }: {
  surah: number; depth: number; stop: number | null;
  onStart: () => void; onLive: (text: string) => void; onFinal: (text: string | null) => void;
  onLevel: (level: number | null) => void;
}) {
  const [supported, setSupported] = useState(false);
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
  const starting = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const setVoiceState = (next: VoiceState) => { stateRef.current = next; if (alive.current) setState(next); };

  useEffect(() => {
    const mediaDevices = (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    setSupported(Boolean(window.isSecureContext && mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"));
  }, []);

  useEffect(() => () => {
    alive.current = false;
    clearTimers();
    liveAbort.current?.abort();
    finalAbort.current?.abort();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.removeEventListener("stop", onRecorderStop);
      try { if (recorder.state !== "inactive") recorder.stop(); } catch { }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cleanupAudioCtx();
  }, []);

  function clearTimers() {
    if (clockTimer.current !== null) { window.clearInterval(clockTimer.current); clockTimer.current = null; }
    if (hardTimer.current !== null) { window.clearTimeout(hardTimer.current); hardTimer.current = null; }
    if (liveTimer.current !== null) { window.clearInterval(liveTimer.current); liveTimer.current = null; }
  }

  function cleanupAudioCtx() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

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

  function start() {
    if (starting.current) return;
    starting.current = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((media) => {
      starting.current = false;
      if (!alive.current) { media.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = media;
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
      
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        void ctx.resume();
        const source = ctx.createMediaStreamSource(media);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;

        const dataArray = new Uint8Array(analyser.fftSize);
        let smoothed = 0;
        const loop = () => {
          analyser.getByteTimeDomainData(dataArray);
          const level = levelFrom(dataArray);
          smoothed = smoothed * 0.7 + level * 0.3;
          onLevel(smoothed);
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        onLevel(null);
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

  function stopRecording() {
    if (stateRef.current !== "listening") return;
    clearTimers();
    liveAbort.current?.abort();
    setVoiceState("finalizing");
    recorderRef.current?.stop();
  }

  function onTrackEnded() { stopRecording(); }

  function onRecorderStop() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cleanupAudioCtx();
    onLevel(0);
    const blob = new Blob(chunksRef.current, { type: recorder?.mimeType });
    chunksRef.current = [];
    void finalize(blob);
  }

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

  function toggle() {
    if (stateRef.current === "listening") { stopRecording(); return; }
    if (stateRef.current === "finalizing") return;
    start();
  }

  return { supported, state, elapsed, liveOn, toggle };
}
