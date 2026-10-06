# m-009: handoff from the Claude orchestrator to Codex (6 Oct 2026, 21:55)

**Status:** open · **Next step:** Codex reads this file, then runs task 1 below.

Written in English because it is a brief for Codex. The owner is Ahmed Hisham. The Claude session that orchestrated today is out of weekly quota; this file is everything it knew that the repo does not already say in one place.

## 1. The situation in ten lines

- **Deadline: tonight, 6 Oct 2026, 23:59 (Riyadh time).** Submission and edits close then.
- **Product:** "Huda" (`app/`, Next.js 16): a reader that guides a non-specialist Arabic reader through a surah. One woven explanation at four depths; stops are questions with answers; terms are taught in place; every sentence is carried by a record (named source, verbatim quote, locator, a scholar's grading quoted by name). "Ask" answers only from verified sentences and book passages. The AI never writes a verse, invents a meaning, grades a narration, or gives a fatwa.
- **Live:** `https://hudan.ahmedothman.online` (Render service `huda`). `origin/main` = `9b9603b`, live since 21:46. 16 surahs published (`app/src/lib/published.ts`: 93, 100–114).
- **Repo:** `ahmed0thman/islamic_ai_ch`, still **PRIVATE**. The rules require a public repo; making it public is the owner's own action.
- **Judged score, the orchestrator's own estimate (not a measurement):** about 3.5 of 5 without the "presentation" criterion; the owner's target is 4. The reference for every number is `docs/07-competition/measured-results.md`.
- **Running:** the final independent reviews of fifteen surahs (task 1), started 21:59. Nothing else.

## 2. Rules you must keep (the owner's standing rules)

1. Reply to the owner in Arabic (Egyptian colloquial is fine), short, result first. One question per message.
2. Before replying to any note from the owner, write it with its time (from `date`) in `docs/08-open/tasks/m-006-three-day-plan.md` (the "owner notes" list); add a run-table row there for every agent or lane you run; keep `docs/08-open/tasks/board.md` current. Decisions go to `docs/decisions.md` with a new number; mark (أ) only what the owner said explicitly, (ب) findings, (ج) your own proposals.
3. Stay on `main`. Commit with explicit paths only: `git commit -m "…" -- <paths>`. Never `git add -A` or `git commit -a`.
4. **Push only with the owner's word, each time.** Every push rebuilds Render (about 3 minutes).
5. Tell the owner before any download or fetch. **Never delete anything without asking.**
6. Secrets: keys live only in `app/.env.local` (git-ignored). Never open, read, print or paste it; load it only with `node --env-file=app/.env.local`. Only variable names may be mentioned. A judge's own key is never logged, stored or echoed, and there is no fallback to the project's keys when it fails.
7. No raw book text in the repo (decision ق-131): numbers, record ids and labels only.
8. Do not commit `docs/08-open/tasks/m-008-rag-render-diagnose.md` (account ids) or `.github/workflows/keepalive.yml` (left out on purpose). Never run the `apply_083_*`, `apply_087_*`, `reweave_*` scripts under `.cache/records/`.
9. Writes to the production Render database need the owner's word. It was filled today (additive only); do not touch it again without asking.
10. Models: Chinese-model lanes never write or change Arabic. Sensitive meaning work (tafsir content, user-facing Arabic copy) was reserved for Claude Opus; with Claude out, do not author new Arabic copy for the product without showing it to the owner first. The reviewer of a text must not be the model that wrote it.
11. Report honestly: failures as measured, nothing rounded up. The owner dislikes "can this be done?" questions: solve, then report; but never claim what was not measured.

## 3. What is in the working tree that is not yours or mine

- `content/ui.ar.json` is **staged** with a one-word change in the landing page («تمشي» → «تتدرّج») made at 21:40, and `app/.env.example` is modified. No agent of the Claude session did this; most likely the owner. Ask him before committing or discarding either.
- At 21:52 four more code files showed uncommitted edits that no agent of the Claude session made: `app/src/app/s/[no]/page.tsx`, `app/src/lib/ask/gather.ts`, `app/src/lib/ask/providers.ts`, `app/src/lib/rag/db.ts`. Someone else is editing the code at the same time. Do not overwrite, stage or discard them; ask the owner whose they are.
- Three local commits are not pushed (docs only): `ca0c68b`, `cd64552`, `74a1eb4`, plus the commit that adds this file.
- Untracked leftovers to leave alone: `.github/`, `presentation/export/*.png` and two `preview-*` folders, `presentation/setup/build_deck.py`, `docs/08-open/cloud-reports/s-13-plain-111.md`, `.playwright-mcp/`.

## 4. Tasks, in order

### Task 1 — final independent reviews of the published surahs (this is Codex's own job)

All 16 surahs are published by the owner's decision ق-141, but only one (106) has a final review that meets the publish rule ق-136.

- Pending Sol confirmation of the last fixes: **100, 101**.
- Final full review failed earlier for lack of Codex quota: **102, 103, 104, 105, 109, 110, 111, 113, 114**.
- Last full review was on 5 Oct with the verdict "do not ship", and the text was edited since: **93, 107, 108, 112**.

**Started at 21:59 by the Claude orchestrator, detached from its session** (owner's word at 21:58): all fifteen surahs in this order, four at a time: 102 103 104 105 109 110 111 113 114 100 101 93 107 108 112. Log: `.cache/pipeline/final-review-2026-10-06.log`; each surah's result lands in `.cache/pipeline/<n>/review.json` (the previous file was copied to `review.before-final*.json`). **Do not start it again while it runs** (`pgrep -f run_surah.py`); read the results, then list the critical and major problems for the owner.

**Owner's rule ق-146 (21:58): never use Sol at high effort.** The reviewer lane is therefore `codex:extract-codex` (Sol, medium, read-only), not `research-codex` (Sol, high); `code-hard` (Sol, extra high) is excluded too.

The command, should a surah need a re-run (review stage only, never `build` or `fix` in the same call):

```
python3 -B tools/pipeline/run_surah.py <surah numbers> --stages review --reviewer codex:extract-codex --parallel 4 --timeout-min 10
```

Before each run copy `.cache/pipeline/<n>/review.json` to `review.before-final.json` (copy, not move). Then read each new `review.json`. The owner's rule (ق-099): no surah is rejected; the review produces a list of problems that get fixed. Fixes used to go to Claude Opus (critical) and Sonnet (major); with Claude out, propose the fix to the owner before applying it, and have a different model than the fixer confirm it. After any content fix: export, run the checks (`tools/pipeline/README.md`), and the app tests. The error log so far is in `docs/07-competition/measured-results.md` (section 6 and the reliability section).

### Task 2 — what only the owner can do (remind him, with numbered steps, no jargon)

1. **Make the repository public** (GitHub → Settings → Danger Zone → Change visibility → Public). Old commits and 18 remote branches still contain books and transcripts that were untracked today; the owner chose untracking over rewriting history (ق-139).
2. **Record the video** (two minutes at most). Script: `presentation/video-script.md`; its placeholder `{{عدد السور}}` must read 16.
3. **Submit through the portal** and keep the confirmation.
4. **Render environment** (he asked for this at 21:11): `HUDA_ASK_PROVIDER` = `gemini`, `GEMINI_API_KEY` = his Google key, `HUDA_ASK_MODEL` = `gemini-3.5-flash-lite`; keep `HUDA_ASK_EFFORT`; then "Save, rebuild and deploy". Not confirmed done. Once done: update `render.yaml` (it says `openai`) and the judge section of `README.md` to say the default is the project's Google key, then ask him for a push.
5. **Look at the updated deck** `presentation/export/huda-deck.pdf` (slides 5 and 8 changed most) and say whether the new strings stand. They were written by the orchestrator, not by him.
6. **Try the sign-in button** on the live site. The build now points to the app's own Arabic page (`/sign-in`), verified from the page configuration only, not by clicking.
7. **Decision ق-108** (legal entity and revenue) is open; `README.md` says "not decided yet".

### Task 3 — small things worth doing if time remains

- Push the pending docs commits (needs his word).
- `presentation/setup/check_deck_text.py` reads the plan from a temporary scratchpad path, not from `presentation/deck-plan.md`: fix the path.
- On slide 8 the value «14 من 14» is set smaller (56 px) than the other three figures; unify if the owner wants.
- The landing page (`/`) has no skip link; the reader pages have one.
- `tools/eval/results-2026-10-06/`: seven scripts were re-run and reproduced their numbers; six were only syntax-checked (they need a database, a server or model calls).
- Open pull request #23 (`cloud/plain-seven`, seven surahs): conflicts with `main`, says of itself "do not merge" before a local export and review, and six of its seven surahs are not published. Leave it open until after the submission.

## 5. What was measured tonight (so you do not repeat it)

Everything is in `docs/07-competition/measured-results.md` with method and limits. Headlines:

- **Content:** 2358 of 2358 sentences have their quote found verbatim in the stored source passage (this proves the wording exists there, not that the sentence is supported by it). Export gates: 302 of 304 pass, 2 warnings, 0 failures. All 1776 records are `candidate`: **zero human review**.
- **"Ask" safety set, twice:** no fabricated verse, hadith or ruling in any answer. After the deterministic pre-check (`app/src/lib/ask/precheck.ts`, commit `e66015c`): critical cases 14 of 14 in both runs by the one-line pass conditions written blind; by the stricter standard (each case's full expected behaviour) items are still missing, for example no notice when a quoted verse does not match the mushaf. Ordinary settled cases 3 of 5: **below the threshold of 4**. Measured on the local build; on the live site only the "compose in the style of the Quran" refusal was checked.
- **"Ask" versus the bare model, 16 questions:** 31 of 31 answer sentences carry a record; the bare model produced 3 verifiable quotes of 29 and wrote 4 verses, one not matching the mushaf.
- **Retrieval, three modes, two identical runs:** on 222 cases hybrid is highest (recall@24 0.458) but absolute numbers are low.
- **Simulated readers (language-model agents, not people) against «المختصر في التفسير»:** round one (4 surahs) Huda 30 vs 24 of 32; round two (8 other surahs, keys written independently) Huda "understanding" 55, reference 53, Huda "glimpse" 43 of 64. **No clear improvement is established.** The human reader test (`docs/06-product/reader-test-2026-10-06.md`) was never run; its messages are ready for the owner to send.
- **Usability audit and fixes** (`f4957b5`), re-measured on the live site at 21:50.
- **Human-review tooling** (`0c6f7ac`): the procedure is executable (`tools/pipeline/README.md`, section 8); nobody has reviewed anything and no reviewer is named.

## 6. Known weaknesses nobody has fixed

- "Ask" declines or misclassifies two ordinary cases (`rasmi-07`, `compose-03`); `rasmi-01` changed from an answer to a refusal after the pre-check for an unknown reason.
- The refusal for "compose like the Quran" shows the generic "out of scope" message: no dedicated Arabic string exists. A string would have to be written and approved by the owner.
- The pre-check is keyword-pattern based and was tested on the 29 cases only.
- The judge-key paths for OpenAI and Anthropic were never tested with a real answer (the accounts at hand have no credit); only Google was. `README.md` says so.
- The "glimpse" level of surah 105 (الفيل) does not say who the people of the elephant were; the reference does.
- Thirteen of the sixteen published surahs have "do not ship" as their last complete independent review (task 1).
- Render's free service sleeps after 15 minutes idle (first load about a minute); the free database expires on 4 Nov.

## 7. Where things are

- Task files: `docs/08-open/tasks/m-006-three-day-plan.md` (owner notes and the run table of every agent today), `m-008-rag.md`, the board `board.md`.
- Decisions made today: ق-136 to ق-145 in `docs/decisions.md`.
- Local servers on this machine: production build on `http://localhost:3241`, development on `http://localhost:3244` (both with "Ask" on the Google key, model `gemini-3.5-flash-lite`, local Postgres `huda_rag`). Bind and call as `localhost`; `127.0.0.1` breaks the app's proxy. Use port 3243 for your own test server.
- The Claude session's scratchpad (briefs, raw eval outputs, the reader-test kits with the reference text) is under `/private/tmp/claude-501/-Users-ahmedhisham-Work-islamic-ai-ch/2d7c259e-3d7e-4767-8734-ac68978dc1ba/scratchpad/`. It is temporary and may disappear; what matters from it was copied into `tools/eval/results-2026-10-06/` and the results document.
- Lanes allowed are the project's 23 in `.delegate/config.json`. OpenCode Go quota is exhausted; Claude on Google (`agy`) is exhausted; Gemini on Google works.

## Run table

| Agent | Model | Start | End | What it did |
|---|---|---|---|---|
| Claude orchestrator | Opus 5.5 | 21:51 | 21:55 | Wrote this handoff at the owner's request |

## Owner notes

- **6 Oct, 21:51:** the Claude weekly limit is almost used up; he asked for the running tasks and a summary of everything understood, so Codex can continue the work.
