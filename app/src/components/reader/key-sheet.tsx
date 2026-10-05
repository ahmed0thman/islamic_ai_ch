"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Ui } from "@/lib/types";
import { clearOwnKey, getOwnKey, keyWithinShape, OWN_KEY_PROVIDERS, setOwnKey, type OwnKeyProvider } from "@/lib/own-key";
import { BottomSheet } from "./bottom-sheet";
import styles from "./key-sheet.module.css";

export function KeySheet({ ui, onClose }: { ui: Ui; onClose: () => void }) {
  const id = useId();
  const [provider, setProvider] = useState<OwnKeyProvider>("opencode-go");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"checking" | "ok" | "bad" | null>(null);
  const active = useRef<AbortController | null>(null);
  const valid = keyWithinShape(key);

  useEffect(() => {
    const stored = getOwnKey();
    if (stored) { setProvider(stored.provider); setKey(stored.key); }
    return () => { active.current?.abort(); };
  }, []);

  function resetCheck() {
    active.current?.abort();
    active.current = null;
    setStatus(null);
  }

  async function check() {
    if (!valid || status === "checking") return;
    const controller = new AbortController();
    active.current = controller;
    setStatus("checking");
    try {
      const response = await fetch("/api/key-check/", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      });
      const result: unknown = response.ok ? await response.json() : null;
      if (!controller.signal.aborted) setStatus(result && typeof result === "object" && "ok" in result && result.ok === true ? "ok" : "bad");
    } catch {
      if (!controller.signal.aborted) setStatus("bad");
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  function save(event: FormEvent, dismiss: () => void) {
    event.preventDefault();
    if (!valid) { setStatus("bad"); return; }
    if (setOwnKey({ provider, key })) { resetCheck(); setKey(""); dismiss(); }
    else setStatus("bad");
  }

  function clear() {
    resetCheck();
    if (clearOwnKey()) setKey("");
    else setStatus("bad");
  }

  return <BottomSheet title={ui.judge_key.title} ui={ui} onClose={onClose}>
    {(dismiss) => <form className={styles.form} dir="rtl" onSubmit={(event) => save(event, dismiss)} aria-busy={status === "checking" || undefined}>
      <p id={`${id}-intro`} className={styles.intro}>{ui.judge_key.intro}</p>
      <div className={styles.field}>
        <label htmlFor={`${id}-provider`}>{ui.judge_key.provider}</label>
        <select id={`${id}-provider`} className={styles.input} value={provider} onChange={(event) => { resetCheck(); setProvider(event.target.value as OwnKeyProvider); }}>
          {OWN_KEY_PROVIDERS.map((name) => <option key={name} value={name}>{ui.judge_key.providers[name]}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-key`}>{ui.judge_key.key}</label>
        <input id={`${id}-key`} className={styles.input} type="password" autoComplete="off" spellCheck={false} dir="ltr"
          autoCapitalize="none" maxLength={300} value={key} aria-describedby={`${id}-intro ${id}-status`} aria-invalid={status === "bad" || undefined}
          onChange={(event) => { resetCheck(); setKey(event.target.value); }} />
      </div>
      <p id={`${id}-status`} className={styles.status} role="status" aria-live="polite" aria-atomic="true">{status ? ui.judge_key[status] : null}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={!valid || status === "checking"} onClick={check}>{status === "checking" ? ui.judge_key.checking : ui.judge_key.test}</button>
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!valid || status === "checking"}>{ui.judge_key.save}</button>
        <button type="button" className={styles.button} onClick={clear}>{ui.judge_key.clear}</button>
      </div>
    </form>}
  </BottomSheet>;
}
