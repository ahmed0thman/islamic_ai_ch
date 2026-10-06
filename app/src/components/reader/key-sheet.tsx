"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Ui } from "@/lib/types";
import { clearOwnKey, clearProviderOwnKey, getOwnKeys, keyWithinShape, OWN_KEY_CHANGE_EVENT, OWN_KEY_PROVIDERS, setActiveOwnKey, setProviderOwnKey, type OwnKeyProvider } from "@/lib/own-key";
import { BottomSheet } from "./bottom-sheet";
import styles from "./key-sheet.module.css";

export function KeySheet({ ui, onClose }: { ui: Ui; onClose: () => void }) {
  return <BottomSheet title={ui.judge_key.title} ui={ui} onClose={onClose}>
    {(dismiss) => <KeyForm ui={ui} onClose={dismiss} />}
  </BottomSheet>;
}

export function KeyForm({ ui }: { ui: Ui; onClose: () => void }) {
  const [stored, setStored] = useState<ReturnType<typeof getOwnKeys>>({ keys: {} });
  const [clearVersion, setClearVersion] = useState(0);

  useEffect(() => {
    const update = () => setStored(getOwnKeys());
    update();
    window.addEventListener(OWN_KEY_CHANGE_EVENT, update);
    return () => window.removeEventListener(OWN_KEY_CHANGE_EVENT, update);
  }, []);

  return <div className={styles.form} dir="rtl">
    <p className={styles.intro}>{ui.judge_key.intro}</p>
    {OWN_KEY_PROVIDERS.map((provider) => <ProviderKeyForm key={provider} ui={ui} provider={provider}
      savedKey={stored.keys[provider]} inUse={stored.active === provider} clearVersion={clearVersion} />)}
    <button type="button" className={styles.button} onClick={() => {
      if (clearOwnKey()) setClearVersion((version) => version + 1);
    }}>{ui.judge_key.clear_all}</button>
  </div>;
}

function ProviderKeyForm({ ui, provider, savedKey, inUse, clearVersion }: {
  ui: Ui; provider: OwnKeyProvider; savedKey?: string; inUse: boolean; clearVersion: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"checking" | "ok" | "bad" | null>(null);
  const active = useRef<AbortController | null>(null);
  const key = draft || savedKey || "";
  const valid = keyWithinShape(key);

  useEffect(() => {
    active.current?.abort();
    active.current = null;
    setDraft("");
    setStatus(null);
    return () => { active.current?.abort(); };
  }, [savedKey, clearVersion]);

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

  function save(event: FormEvent) {
    event.preventDefault();
    if (!valid) { setStatus("bad"); return; }
    if (setProviderOwnKey({ provider, key })) { resetCheck(); setDraft(""); }
    else setStatus("bad");
  }

  function clear() {
    resetCheck();
    if (clearProviderOwnKey(provider)) setDraft("");
    else setStatus("bad");
  }

  return <form className={styles.field} onSubmit={save} aria-busy={status === "checking" || undefined}>
    <label htmlFor={`${id}-key`}>{ui.judge_key.providers[provider]}</label>
    <input id={`${id}-key`} className={styles.input} type="password" autoComplete="off" spellCheck={false} dir="ltr"
      autoCapitalize="none" maxLength={300} value={draft} aria-describedby={`${id}-choice ${id}-status`} aria-invalid={status === "bad" || undefined}
      onChange={(event) => { resetCheck(); setDraft(event.target.value); }} />
    <div id={`${id}-choice`} className={styles.using}>
      {savedKey ? <button type="button" className={`${styles.button} ${styles.choice}`} aria-pressed={inUse}
        onClick={() => { if (!setActiveOwnKey(provider)) setStatus("bad"); }}>
        {inUse ? ui.judge_key.in_use : ui.judge_key.use_this}
      </button> : <span>{ui.judge_key.empty}</span>}
    </div>
    <p id={`${id}-status`} className={styles.status} role="status" aria-live="polite" aria-atomic="true">{status ? ui.judge_key[status] : null}</p>
    <div className={styles.actions}>
      <button type="button" className={styles.button} disabled={!valid || status === "checking"} onClick={check}>{status === "checking" ? ui.judge_key.checking : ui.judge_key.test}</button>
      <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!keyWithinShape(draft) || status === "checking"}>{ui.judge_key.save}</button>
      <button type="button" className={styles.button} disabled={!savedKey && !draft} onClick={clear}>{ui.judge_key.clear}</button>
    </div>
  </form>;
}
