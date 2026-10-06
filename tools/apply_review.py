#!/usr/bin/env python3
"""Carry a marked review sheet into the private records. Offline, standard library only.

Reads `.cache/records/<no>/review.md` and sets each marked record's `review_status` to `reviewed`
([x]) or `rejected` ([r]), with `reviewed_by` and `reviewed_on` taken from the sheet header. A sheet with
no reviewer name (or no valid date) is refused, and so is a rejection without a note.

Default is a dry run that lists the changes. `--check-only` validates the sheet and writes nothing.
`--write` is the only mode that changes `records.v2.json`, and only after every check has passed.
A record left unmarked keeps whatever status it has: unmarking a box does not undo an applied review.
"""
import argparse
import json
import os
from pathlib import Path
import sys

import review_sheet
from review_sheet import REJECTED, SheetError

PROJECT = Path(__file__).resolve().parent.parent
# `records.v2.json` is written by the records builder with these options (no trailing newline).
RECORDS_FORMAT = dict(ensure_ascii=False, indent=1)


class RecordsFormatError(ValueError):
    """The records file would not be reproduced byte for byte, so a write would rewrite all of it."""


def records_path(root, no):
    return root / str(no) / "records.v2.json"


def read_records(path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text), text


def validate_sheet(sheet, records):
    """Refuse a sheet the records cannot honestly take. Returns nothing; raises SheetError."""
    if not sheet.reviewer.strip():
        raise SheetError("the sheet header has no reviewer name (line `Reviewer:`); nothing was applied")
    if not review_sheet.valid_date(sheet.date):
        raise SheetError(f"the sheet header date {sheet.date!r} is not a valid YYYY-MM-DD date (line `Date:`)")
    unknown = sorted(i for i in sheet.marks if i not in records)
    if unknown:
        raise SheetError("marked records not found in the records file: " + ", ".join(unknown))
    bare = sorted(i for i, m in sheet.marks.items() if m.status == REJECTED and not m.note)
    if bare:
        raise SheetError("a rejection needs a note (line `Note:`) giving the reason: " + ", ".join(bare))


def plan_changes(sheet, records):
    """[(id, old_status, new_status)] for every marked record whose stored review fields differ."""
    changes = []
    for ident, mark in sorted(sheet.marks.items()):
        r = records[ident]
        wanted = (mark.status, sheet.reviewer.strip(), sheet.date, mark.note)
        stored = (r.get("review_status"), r.get("reviewed_by"), r.get("reviewed_on"), r.get("review_note", ""))
        if wanted != stored:
            changes.append((ident, r.get("review_status"), mark.status))
    return changes


def apply_changes(sheet, records):
    """Set the review fields on the in-memory records (the note field is removed when the note is empty)."""
    for ident, mark in sheet.marks.items():
        r = records[ident]
        r.update(review_status=mark.status, reviewed_by=sheet.reviewer.strip(), reviewed_on=sheet.date)
        if mark.note:
            r["review_note"] = mark.note
        else:
            r.pop("review_note", None)


def write_records(path, data, original_text):
    """Write atomically, and only if an unchanged re-serialisation reproduces the file (no format drift)."""
    plain = json.loads(original_text)
    if json.dumps(plain, **RECORDS_FORMAT) != original_text:
        raise RecordsFormatError(f"{path}: not in the builder's format; refusing to rewrite the whole file")
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, **RECORDS_FORMAT), encoding="utf-8")
    os.replace(tmp, path)


def run(args):
    path = records_path(args.records_root, args.surah)
    sheet_path = args.sheet or args.records_root / str(args.surah) / "review.md"
    data, original = read_records(path)
    sheet = review_sheet.parse_sheet(sheet_path.read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in data["records"]}
    validate_sheet(sheet, by_id)
    changes = plan_changes(sheet, by_id)
    mode = "write" if args.write else "check-only" if args.check_only else "dry-run"
    print(f"{args.surah} {mode}: reviewer={sheet.reviewer.strip()!r} date={sheet.date} "
          f"marked={len(sheet.marks)} would change={len(changes)}")
    if not args.check_only:
        for ident, old, new in changes:
            print(f"  {ident}: {old} -> {new}")
    if args.write and changes:
        apply_changes(sheet, by_id)
        write_records(path, data, original)
        print(f"{args.surah} wrote {len(changes)} changes to {path}")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("surah", type=int)
    parser.add_argument("--sheet", type=Path, help="default: <records-root>/<surah>/review.md")
    parser.add_argument("--records-root", type=Path, default=PROJECT / ".cache/records")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check-only", action="store_true", help="validate the sheet; list nothing, write nothing")
    mode.add_argument("--write", action="store_true", help="change records.v2.json (default is a dry run)")
    args = parser.parse_args(argv)
    try:
        return run(args)
    except (OSError, ValueError, KeyError) as exc:
        print(f"{args.surah} REFUSED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
