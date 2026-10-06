#!/usr/bin/env python3
"""Human-review sheet: the shared format of `.cache/records/<no>/review.md`. Standard library only.

The exporter writes the sheet (`export_content.review_text`) and `apply_review.py` reads it, so both
use the labels, marks and parser defined here. A mark is a checkbox: `[ ]` not reviewed, `[x]`
reviewed, `[r]` rejected. The reviewer's name and date sit in the header; the note of a record sits on
its own `Note:` line. Sheets written before this format (no header lines, no `Note:` lines) still parse.
"""
from dataclasses import dataclass, field
import datetime
import re

# Statuses of a private record's `review_status`. `candidate` is the only value any record has today.
CANDIDATE, REVIEWED, REJECTED = "candidate", "reviewed", "rejected"
REVIEW_STATUSES = (CANDIDATE, REVIEWED, REJECTED)

# The character inside the checkbox, and the status it stands for (None = not reviewed).
MARK_STATUS = {" ": None, "x": REVIEWED, "r": REJECTED}
STATUS_MARK = {status: char for char, status in MARK_STATUS.items()}

REVIEWER_LABEL, DATE_LABEL, NOTE_LABEL = "Reviewer:", "Date:", "Note:"
ORPHAN_HEADING = "## marks of records no longer in this sheet"

RECORD_LINE = re.compile(r"^- \[(.)\] (\S+)\s*$")
NOTE_LINE = re.compile(r"^  " + re.escape(NOTE_LABEL) + r"[ \t]?(.*)$")
HEADER_LINE = re.compile(r"^(Reviewer|Date):[ \t]*(.*?)\s*$")


class SheetError(ValueError):
    """The sheet cannot be read or does not meet the rules for applying it."""


@dataclass
class Mark:
    status: str  # REVIEWED or REJECTED (an unmarked box is not stored)
    note: str = ""


@dataclass
class Sheet:
    reviewer: str = ""
    date: str = ""
    marks: dict = field(default_factory=dict)  # record id -> Mark
    notes: dict = field(default_factory=dict)  # record id -> note of an unmarked record


def parse_sheet(text):
    """Read reviewer, date, marks and notes. Unknown mark characters and duplicate ids are refused."""
    sheet = Sheet()
    current = None
    for number, line in enumerate(text.splitlines(), 1):
        record = RECORD_LINE.match(line)
        if record:
            char, ident = record.groups()
            if char.lower() not in MARK_STATUS:
                raise SheetError(f"line {number}: unknown mark [{char}] for {ident} (use [ ], [x] or [r])")
            if ident in sheet.notes or ident in sheet.marks:
                raise SheetError(f"line {number}: record {ident} appears twice")
            status = MARK_STATUS[char.lower()]
            current = ident
            if status:
                sheet.marks[ident] = Mark(status)
            else:
                sheet.notes[ident] = ""
            continue
        if current is None:
            header = HEADER_LINE.match(line)
            if header:
                setattr(sheet, header.group(1).lower(), header.group(2))
            continue
        note = NOTE_LINE.match(line)
        if note and note.group(1).strip():
            if current in sheet.marks:
                sheet.marks[current].note = note.group(1).strip()
            else:
                sheet.notes[current] = note.group(1).strip()
    return sheet


def mark_of(sheet, ident):
    """(status or None, note) carried for one record id."""
    if sheet is None:
        return None, ""
    if ident in sheet.marks:
        return sheet.marks[ident].status, sheet.marks[ident].note
    return None, sheet.notes.get(ident, "")


def record_head(ident, sheet):
    """The checkbox line and, written last by the caller's layout, the note line of one record."""
    status, note = mark_of(sheet, ident)
    return f"- [{STATUS_MARK[status]}] {ident}", f"  {NOTE_LABEL} {note}".rstrip()


def orphan_lines(sheet, shown_ids):
    """Marks and notes of records the new sheet no longer lists: they are kept, never dropped."""
    if sheet is None:
        return []
    ids = sorted(i for i in [*sheet.marks, *sheet.notes] if i not in shown_ids and
                 (i in sheet.marks or sheet.notes[i]))
    lines = []
    for ident in ids:
        head, note = record_head(ident, sheet)
        lines += [head, note, ""]
    return [ORPHAN_HEADING, "", *lines] if lines else []


def valid_date(value):
    try:
        return datetime.date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False
