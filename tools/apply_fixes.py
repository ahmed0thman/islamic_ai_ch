#!/usr/bin/env python3
"""Apply a reviewed list of ASR fixes to a transcript, fail-closed, and log them.

Usage:
  python3 tools/apply_fixes.py <transcript.md> <fixes.json> [--dry-run]

fixes.json is a list of objects:
  {"line": 34, "old": "نون والقلم يسترون", "new": "نون والقلم وما يسطرون",
   "count": 1, "class": "quran", "reason": "القلم 68:1"}

- `line` is the 1-based line in the transcript; the fix is applied only on that line.
- `count` is how many times `old` must occur on that line (default 1). Any mismatch
  aborts the whole batch before anything is written — a wrong edit is worse than none.
- Every applied fix is appended to `asr-notes.md` next to the transcript, so the
  ledger is produced by the same step that edits the file.
"""
import argparse
import json
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("fixes")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    path = Path(args.transcript)
    lines = path.read_text().split("\n")
    fixes = json.loads(Path(args.fixes).read_text())

    errors = []
    for n, f in enumerate(fixes):
        i = f["line"] - 1
        want = f.get("count", 1)
        got = lines[i].count(f["old"]) if 0 <= i < len(lines) else 0
        if got != want:
            errors.append(f"fix #{n} line {f['line']}: expected {want}× {f['old']!r}, found {got}")
            continue
        lines[i] = lines[i].replace(f["old"], f["new"])
    if errors:
        print("Aborted, nothing written:\n  " + "\n  ".join(errors), file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print(f"OK: {len(fixes)} fixes would apply cleanly")
        return

    path.write_text("\n".join(lines))
    notes = path.parent / "asr-notes.md"
    rows = [f"| {f['line']} | {f.get('class', '')} | {f['old']} | {f['new']} | "
            f"{f.get('count', 1)} | {f.get('reason', '')} |" for f in fixes]
    header = ("\n| line | class | was | now | × | reason |\n"
              "|---|---|---|---|---|---|\n")
    with notes.open("a") as fh:
        fh.write(header + "\n".join(rows) + "\n")
    print(f"Applied {len(fixes)} fixes → {path}; logged in {notes}")


if __name__ == "__main__":
    main()
