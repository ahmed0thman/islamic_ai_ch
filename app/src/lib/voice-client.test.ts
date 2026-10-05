import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error -- Node requires source extensions.
import { clock, fileNameFor, LIVE_EVERY_MS, LIVE_FOR_MP4, LIVE_MIN_MS, liveAllowed, MAX_RECORDING_MS, mergeQuestion, MIME_CANDIDATES, nextAfterFinal, pickMimeType, TIMESLICE_MS } from "./voice-client.ts";

test("the constants the button and the server rely on", () => {
  assert.equal(LIVE_EVERY_MS, 2500);
  assert.equal(LIVE_MIN_MS, 1800);
  assert.equal(MAX_RECORDING_MS, 40_000);
  assert.equal(TIMESLICE_MS, 1000);
  assert.deepEqual(MIME_CANDIDATES, ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]);
});

test("pickMimeType takes the first supported candidate", () => {
  assert.equal(pickMimeType(() => true), "audio/webm;codecs=opus");
  assert.equal(pickMimeType((type) => type === "audio/mp4"), "audio/mp4");
  assert.equal(pickMimeType((type) => type === "audio/webm"), "audio/webm");
});

test("pickMimeType: a missing method or no support means the recorder default", () => {
  assert.equal(pickMimeType(undefined), undefined);
  assert.equal(pickMimeType(() => false), undefined);
});

test("fileNameFor names the upload after its container", () => {
  assert.equal(fileNameFor("audio/mp4"), "question.mp4");
  assert.equal(fileNameFor("audio/x-m4a"), "question.m4a");
  assert.equal(fileNameFor("audio/aac"), "question.m4a");
  assert.equal(fileNameFor("audio/ogg"), "question.ogg");
  assert.equal(fileNameFor("audio/wav"), "question.wav");
  assert.equal(fileNameFor("audio/webm;codecs=opus"), "question.webm");
  assert.equal(fileNameFor(""), "question.webm");
});

test("liveAllowed gates only mp4/m4a on the Safari check", () => {
  assert.equal(liveAllowed("audio/mp4"), LIVE_FOR_MP4);
  assert.equal(liveAllowed("audio/x-m4a"), LIVE_FOR_MP4);
  assert.equal(liveAllowed("audio/webm;codecs=opus"), true);
  assert.equal(liveAllowed("audio/ogg"), true);
  assert.equal(liveAllowed(undefined), true);
});

test("clock floors to whole seconds and renders m:ss in display digits", () => {
  assert.equal(clock(0), "\u0660:\u0660\u0660");
  assert.equal(clock(999), "\u0660:\u0660\u0660");
  assert.equal(clock(1000), "\u0660:\u0660\u0661");
  assert.equal(clock(59_999), "\u0660:\u0665\u0669");
  assert.equal(clock(61_000), "\u0661:\u0660\u0661");
  assert.equal(clock(600_000), "\u0661\u0660:\u0660\u0660");
});

test("mergeQuestion: a blank base leaves the trimmed spoken text alone", () => {
  const greeting = "\u0645\u0631\u062D\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645";
  assert.equal(mergeQuestion("", `  ${greeting}  `), greeting);
  assert.equal(mergeQuestion("   ", "\u0633\u0624\u0627\u0644"), "\u0633\u0624\u0627\u0644");
});

test("mergeQuestion: the spoken text follows the base with one space", () => {
  const base = "\u0645\u0627 \u062D\u0643\u0645";
  const spoken = "\u0627\u0644\u0635\u064A\u0627\u0645";
  assert.equal(mergeQuestion(base, `  ${spoken}  `), `${base} ${spoken}`);
  assert.equal(mergeQuestion("base", "spoken words"), "base spoken words");
});

test("mergeQuestion counts code points and cuts at the last whitespace before 300", () => {
  const word = "\u0643\u0644\u0645\u0629"; // 4 code points
  const base = Array.from({ length: 60 }, () => word).join(" "); // 60 * 4 + 59 = 299 code points
  assert.equal([...base].length, 299);
  const merged = mergeQuestion(base, word); // 299 + 1 + 4 = 304 code points
  assert.equal(merged, base); // the joining space sits at index 299, so the cut gives the base back
  assert.equal([...merged].length, 299);
});

test("mergeQuestion cuts mid-overflow at the whitespace before it, astral-safe", () => {
  const base = `${"a".repeat(299)} \u{1F600}`; // 301 code points, 302 UTF-16 units
  assert.equal([...base].length, 301);
  const merged = mergeQuestion(base, "bcd"); // 305 code points
  assert.equal(merged, "a".repeat(299)); // the space at index 299 is the last whitespace before 300, and the emoji is never split
  // no whitespace in the first 300 code points: a hard cut at 300
  const solid = mergeQuestion("x".repeat(300), "y".repeat(50));
  assert.equal(solid, "x".repeat(300));
});

test("mergeQuestion leaves a result of exactly 300 code points alone", () => {
  const base = "z".repeat(295);
  const merged = mergeQuestion(base, "word"); // 295 + 1 + 4 = 300
  assert.equal(merged, `${base} word`);
});

test("nextAfterFinal: ok goes to review, anything else keeps the provisional text or fails", () => {
  assert.equal(nextAfterFinal("ok", false), "review");
  assert.equal(nextAfterFinal("ok", true), "review");
  assert.equal(nextAfterFinal("busy", true), "partial");
  assert.equal(nextAfterFinal("error", true), "partial");
  assert.equal(nextAfterFinal("unavailable", true), "partial");
  assert.equal(nextAfterFinal(undefined, true), "partial");
  assert.equal(nextAfterFinal("empty", false), "failed");
  assert.equal(nextAfterFinal("busy", false), "failed");
  assert.equal(nextAfterFinal(undefined, false), "failed");
});
