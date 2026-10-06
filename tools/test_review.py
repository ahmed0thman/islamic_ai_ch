#!/usr/bin/env python3
"""Review-sheet tests: marks survive an export, apply_review sets review_status, a rejected record is not shown.
All mutable data stays in TemporaryDirectory; nothing under content/ or .cache/ is read for writing."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
import apply_review
import export_content as exporter
import review_sheet
from test_export_content import fixtures

TOOLS = Path(__file__).resolve().parent


class ReviewBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.content, self.records = root / "content", root / "records"
        self.nasij, self.private = fixtures()
        exporter.write_json(self.content / "ui.ar.json", exporter.read_json(exporter.PROJECT / "content/ui.ar.json"))
        self.sheet_path = self.records / "108/review.md"
        self.save()

    def save(self):
        # The builder's format (indent 1, no trailing newline), so apply_review accepts the file.
        path = self.records / "108/records.v2.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.private, **apply_review.RECORDS_FORMAT), encoding="utf-8")
        exporter.write_json(self.content / "nasij/108.json", self.nasij)

    def export(self, *extra):
        self.save()
        return subprocess.run([sys.executable, "-B", str(TOOLS / "export_content.py"), "108",
                               "--records-root", str(self.records), "--content-root", str(self.content), *extra],
                              capture_output=True, text=True)

    def apply(self, *extra):
        return subprocess.run([sys.executable, "-B", str(TOOLS / "apply_review.py"), "108",
                               "--records-root", str(self.records), *extra], capture_output=True, text=True)

    def sheet(self):
        return self.sheet_path.read_text(encoding="utf-8")

    def mark(self, ident, char, note=None, reviewer="مراجع اختبار", date="2026-10-06"):
        """Edit the sheet the way a reviewer does: tick a box, write a note, fill the header."""
        out, current = [], None
        for line in self.sheet().splitlines():
            if line == "Reviewer:" and reviewer:
                line = f"Reviewer: {reviewer}"
            if line == "Date:" and date:
                line = f"Date: {date}"
            if line.startswith("- ["):
                current = line.split("] ", 1)[1]
                if current == ident:
                    line = f"- [{char}] {ident}"
            if note is not None and current == ident and line == "  Note:":
                line = f"  Note: {note}"
            out.append(line)
        self.sheet_path.write_text("\n".join(out) + "\n", encoding="utf-8")

    def stored(self):
        return {r["id"]: r for r in json.loads((self.records / "108/records.v2.json").read_text(encoding="utf-8"))["records"]}


class SheetContentTests(ReviewBase):
    def test_sheet_shows_badge_state_and_grading(self):
        narration = self.private["records"][-1]  # 108-all, in the "all" tier
        narration["state"] = "report_unjudged"
        narration["evidence"][0]["icon"] = "hadith"
        narration["evidence"][0]["rulings"] = [{"id": "x", "kind": "ruling", "wording": "حسن", "grader": "حاكم اختبار",
                                                "source_id": "book", "locus": "footnote"}]
        second = deepcopy(narration["evidence"][0])
        second.update(id="108-all-e2", rulings=[])
        narration["evidence"].append(second)
        self.assertEqual(self.export().returncode, 0)
        sheet = self.sheet()
        ui = exporter.read_json(exporter.PROJECT / "content/ui.ar.json")
        self.assertIn("  Badge: " + ui["badges"]["thabit"]["label"], sheet)
        self.assertIn("  State: " + ui["states"]["report_unjudged"]["label"], sheet)
        self.assertIn("  Grading [108-all-e1]: حسن; حاكم اختبار; كتاب اختبار", sheet)
        self.assertIn("  Grading [108-all-e2]: reported, not judged", sheet)
        self.assertIn("Reviewer:\nDate:\n", sheet)

    def test_scholar_record_has_no_grading_line(self):
        self.export()
        self.assertNotIn("Grading", self.sheet())


class CarryOverTests(ReviewBase):
    def test_marks_survive_reexport(self):
        self.export()
        self.mark("108-all", "x", note="تمت المقابلة")
        before = self.sheet()
        self.assertIn("- [x] 108-all", before)
        self.assertIn("  Note: تمت المقابلة", before)
        self.assertEqual(self.export().returncode, 0)
        self.assertEqual(self.sheet(), before)

    def test_rejection_header_and_note_survive_after_records_change(self):
        self.export()
        self.mark("108-all", "r", note="الاقتباس لا يطابق الصفحة")
        self.private["records"][-1]["claim"] = "دعوى معدلة"
        self.assertEqual(self.export("--check-only").returncode, 0)
        self.assertEqual(self.export().returncode, 0)
        sheet = review_sheet.parse_sheet(self.sheet())
        self.assertEqual(sheet.reviewer, "مراجع اختبار")
        self.assertEqual(sheet.date, "2026-10-06")
        self.assertEqual(sheet.marks["108-all"].status, "rejected")
        self.assertEqual(sheet.marks["108-all"].note, "الاقتباس لا يطابق الصفحة")
        self.assertIn("Claim: دعوى معدلة", self.sheet())

    def test_mark_of_record_that_left_the_sheet_is_kept(self):
        self.export()
        self.mark("108-all", "x", note="ملاحظة باقية")
        self.private["records"] = [r for r in self.private["records"] if r["id"] != "108-all"]
        self.assertEqual(self.export().returncode, 0)
        sheet = self.sheet()
        self.assertIn(review_sheet.ORPHAN_HEADING, sheet)
        parsed = review_sheet.parse_sheet(sheet)
        self.assertEqual(parsed.marks["108-all"].note, "ملاحظة باقية")

    def test_sheet_in_the_old_format_still_loads(self):
        old = "# Surah 108 — human review\n\n## all (1)\n\n- [x] 108-all\n  Claim: دعوى\n  Used: not used in exported text\n"
        self.sheet_path.write_text(old, encoding="utf-8")
        self.assertEqual(self.export().returncode, 0)
        self.assertEqual(review_sheet.parse_sheet(self.sheet()).marks["108-all"].status, "reviewed")

    def test_unreadable_sheet_stops_export_and_is_not_overwritten(self):
        self.sheet_path.write_text("- [?] 108-all\n", encoding="utf-8")
        result = self.export()
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("unknown mark", result.stdout)
        self.assertEqual(self.sheet(), "- [?] 108-all\n")
        self.assertFalse((self.content / "export/surah-108.json").exists())

    def test_check_only_does_not_touch_the_sheet(self):
        self.export()
        self.mark("108-all", "x")
        before = self.sheet()
        self.assertEqual(self.export("--check-only").returncode, 0)
        self.assertEqual(self.sheet(), before)


class ApplyReviewTests(ReviewBase):
    def setUp(self):
        super().setUp()
        self.export()
        self.mark("108-all", "x", note="مطابق")
        self.mark("108-s1", "r", note="لا يطابق")

    def records_bytes(self):
        return (self.records / "108/records.v2.json").read_bytes()

    def test_dry_run_writes_nothing(self):
        before = self.records_bytes()
        result = self.apply()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("108-all: None -> reviewed", result.stdout)
        self.assertIn("108-s1: None -> rejected", result.stdout)
        self.assertEqual(self.records_bytes(), before)

    def test_check_only_validates_and_writes_nothing(self):
        before = self.records_bytes()
        result = self.apply("--check-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("marked=2", result.stdout)
        self.assertNotIn("->", result.stdout)
        self.assertEqual(self.records_bytes(), before)

    def test_write_sets_status_reviewer_date_and_note(self):
        result = self.apply("--write")
        self.assertEqual(result.returncode, 0, result.stderr)
        stored = self.stored()
        self.assertEqual(stored["108-all"]["review_status"], "reviewed")
        self.assertEqual(stored["108-all"]["reviewed_by"], "مراجع اختبار")
        self.assertEqual(stored["108-all"]["reviewed_on"], "2026-10-06")
        self.assertEqual(stored["108-all"]["review_note"], "مطابق")
        self.assertEqual(stored["108-s1"]["review_status"], "rejected")
        self.assertNotIn("review_status", stored["108-s2"])  # unmarked records are untouched
        # writing the same sheet again changes nothing
        again = self.apply("--write")
        self.assertIn("would change=0", again.stdout)

    def test_sheet_without_reviewer_is_refused(self):
        self.sheet_path.write_text(self.sheet().replace("Reviewer: مراجع اختبار", "Reviewer:"), encoding="utf-8")
        before = self.records_bytes()
        for flags in ([], ["--check-only"], ["--write"]):
            result = self.apply(*flags)
            self.assertEqual(result.returncode, 1)
            self.assertIn("no reviewer name", result.stderr)
        self.assertEqual(self.records_bytes(), before)

    def test_bad_date_unknown_id_and_bare_rejection_are_refused(self):
        original = self.sheet()
        cases = {
            "not a valid": original.replace("Date: 2026-10-06", "Date: 6/10/2026"),
            "not found in the records": original.replace("- [x] 108-all", "- [x] 108-zzz"),
            "needs a note": original.replace("  Note: لا يطابق", "  Note:"),
            "unknown mark": original.replace("- [x] 108-all", "- [?] 108-all"),
        }
        before = self.records_bytes()
        for expected, text in cases.items():
            self.sheet_path.write_text(text, encoding="utf-8")
            result = self.apply("--write")
            self.assertEqual(result.returncode, 1, expected)
            self.assertIn(expected, result.stderr)
        self.assertEqual(self.records_bytes(), before)

    def test_write_and_check_only_together_are_refused(self):
        self.assertEqual(self.apply("--write", "--check-only").returncode, 2)

    def test_file_in_another_format_is_not_rewritten(self):
        path = self.records / "108/records.v2.json"
        path.write_text(json.dumps(self.private, ensure_ascii=False, indent=4), encoding="utf-8")
        before = self.records_bytes()
        result = self.apply("--write")
        self.assertEqual(result.returncode, 1)
        self.assertIn("builder's format", result.stderr)
        self.assertEqual(self.records_bytes(), before)

    def test_applied_status_reaches_the_public_record(self):
        self.apply("--write")
        # 108-all is not used by the woven text, so use it there to see it exported
        self.nasij["levels"][0]["blocks"][0]["segments"][-1]["records"] = ["108-all"]
        self.private = json.loads((self.records / "108/records.v2.json").read_text(encoding="utf-8"))
        self.assertEqual(self.export().returncode, 0)
        value = exporter.read_json(self.content / "export/surah-108.json")
        self.assertEqual(value["records"]["108-all"]["review_status"], "reviewed")
        self.assertEqual(value["records"]["108-r1"]["review_status"], "candidate")


class RejectedNotDisplayedTests(ReviewBase):
    def set_status(self, status):
        self.private["records"][0]["review_status"] = status  # 108-r1, the record the text marks

    def test_rejected_record_in_the_text_refuses_the_surah(self):
        self.set_status("rejected")
        result = self.export()
        self.assertEqual(result.returncode, 1)
        self.assertIn("108 C17 FAIL", result.stdout)
        self.assertIn("108-r1 was rejected by the reviewer", result.stdout)
        self.assertFalse((self.content / "export/surah-108.json").exists())
        self.assertEqual(self.export("--check-only").returncode, 1)

    def test_candidate_and_reviewed_keep_working(self):
        for status in ("candidate", "reviewed"):
            self.set_status(status)
            self.assertEqual(self.export().returncode, 0, status)
            self.assertEqual(exporter.read_json(self.content / "export/surah-108.json")["records"]["108-r1"]["review_status"], status)

    def test_rejected_record_that_the_text_does_not_use_is_allowed(self):
        self.private["records"][1]["review_status"] = "rejected"  # 108-s0, unused
        self.assertEqual(self.export().returncode, 0)

    def test_rejected_record_used_as_a_quote_or_term_is_refused(self):
        self.private["records"][1]["review_status"] = "rejected"
        paragraph = self.nasij["levels"][1]["blocks"][0]
        paragraph["segments"].insert(0, {"t": "quote", "v": "هذا اقتباس اختبار", "record": "108-s0"})
        result = self.export()
        self.assertEqual(result.returncode, 1)
        self.assertIn("C17 FAIL", result.stdout)

    def test_unknown_review_status_is_refused(self):
        self.set_status("verified")
        result = self.export()
        self.assertEqual(result.returncode, 1)
        self.assertIn("unknown review_status", result.stdout)


if __name__ == "__main__":
    unittest.main()
