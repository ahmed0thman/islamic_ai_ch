#!/usr/bin/env python3
"""Offline exporter regression tests; all mutable data stays in TemporaryDirectory."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
import export_content as exporter


def record(ident="108-r1", tier="sample"):
    return {
        "id": ident, "sura_no": 108, "kind": "claim", "ayah_keys": ["108:1"],
        "claim": "دعوى اختبار", "claim_kind": "quote", "claim_supported_by": [ident + "-e1"],
        "build_permission": {"decision": "نعم", "reason": "سبب اختبار"},
        "display": {"decision": "نعم", "depth": "from_depth_min", "reason": "سبب عرض"},
        "badge": "thabit", "depth_min": 0, "review_tier": tier,
        "evidence": [{"id": ident + "-e1", "icon": "scholar", "source_id": "book",
                      "sayer": "قائل اختبار", "locator": "موضع اختبار", "page_url": None,
                      "quote": "هذا اقتباس اختبار حرفي في المصدر", "rulings": []}],
    }


def fixtures():
    paragraph = {"type": "paragraph", "role": "claim", "segments": [
        {"t": "text", "v": "شرح اختبار."}, {"t": "ayah", "key": "108:1"},
        {"t": "mark", "records": ["108-r1"]}]}
    nasij = {"surah": 108, "levels": [
        {"depth": d, "blocks": [deepcopy(paragraph)]} for d in range(4)],
        "held": [{"depth": 1, "block": {"type": "heading", "text": "عنوان محجوز"}, "reason": "اختبار"}]}
    private = {"meta": {"schema_version": 2, "surah": 108},
               "sources": [{"id": "book", "title": "كتاب اختبار", "author": "مؤلف اختبار"}],
               "records": [record()] + [record(f"108-s{i}") for i in range(30)] + [record("108-all", "all")]}
    return nasij, private


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.content = root / "content"
        self.records = root / "records"
        self.nasij, self.private = fixtures()
        self.fixture = {"schema": 1, "fixture": True, "surah": {"no": 108, "name": "fixture", "ayah_count": 3}}
        exporter.write_json(self.content / "ui.ar.json", exporter.read_json(exporter.PROJECT / "content/ui.ar.json"))
        exporter.write_json(self.content / "export/surah-108.json", self.fixture)
        exporter.write_json(self.content / "export/surah-111.json", {"fixture": False, "surah": {"no": 111, "name": "test", "ayah_count": 5}})
        self.save()

    def save(self):
        exporter.write_json(self.records / "108/records.v2.json", self.private)
        exporter.write_json(self.content / "nasij/108.json", self.nasij)

    def run_export(self, *extra):
        self.save()
        result = subprocess.run([sys.executable, "-B", str(exporter.PROJECT / "tools/export_content.py"),
                                 "108", "--records-root", str(self.records),
                                 "--content-root", str(self.content), *extra], capture_output=True, text=True)
        return result

    def refused(self, code):
        before = (self.content / "export/surah-108.json").read_bytes()
        private_before = json.dumps(self.private, ensure_ascii=False, indent=2) + "\n"
        result = self.run_export()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"{code} FAIL", result.stdout)
        for check in exporter.CHECKS:
            self.assertIn(f"108 {check} ", result.stdout)
        self.assertEqual((self.content / "export/surah-108.json").read_bytes(), before)
        self.assertEqual((self.records / "108/records.v2.json").read_text(), private_before)
        self.assertFalse((self.records / "108/review.md").exists())
        self.assertEqual([s["no"] for s in exporter.read_json(self.content / "export/index.json")["surahs"]], [111])

    def paragraph(self, depth=0):
        return self.nasij["levels"][depth]["blocks"][0]

    def test_valid_export_and_review(self):
        before = (self.records / "108/records.v2.json").read_bytes()
        result = self.run_export()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.records / "108/records.v2.json").read_bytes(), before)
        value = exporter.read_json(self.content / "export/surah-108.json")
        self.assertFalse(value["fixture"])
        self.assertEqual(value["levels"], self.nasij["levels"])
        self.assertEqual(set(value["records"]), {"108-r1"})
        self.assertEqual(value["records"]["108-r1"]["status_text"], "")
        self.assertEqual(value["records"]["108-r1"]["icons"], ["scholar"])
        quran = exporter.read_json(exporter.QURAN)
        self.assertEqual([a["text"] for a in value["ayahs"]], [a["aya_text"] for a in quran if a["sura_no"] == 108])
        self.assertNotIn("held", value)
        self.assertEqual([s["no"] for s in exporter.read_json(self.content / "export/index.json")["surahs"]], [108, 111])
        review = (self.records / "108/review.md").read_text()
        self.assertIn("## all (1)", review)
        self.assertIn("## sample (7)", review)
        self.assertIn("not used in exported text", review)
        self.assertIn("Claim: دعوى اختبار", review)
        self.assertIn("Quote: هذا اقتباس اختبار", review)
        self.assertEqual(self.run_export().returncode, 0)
        self.assertEqual((self.records / "108/review.md").read_text(), review)

    def test_C1(self):
        self.paragraph()["segments"][1]["key"] = "108:99"
        self.refused("C1")

    def test_C1_block_and_evidence(self):
        self.nasij["levels"][0]["blocks"].append({"type": "ayah", "keys": ["999:1"]})
        self.private["records"][0]["evidence"][0]["ayah_keys"] = ["1:999"]
        self.refused("C1")

    def test_C2(self):
        self.paragraph()["segments"][0]["v"] = "إن شانئك هو الأبتر"
        self.refused("C2")

    def test_C2_brackets_and_heading(self):
        self.nasij["levels"][0]["blocks"].append({"type": "heading", "text": "﴾"})
        self.refused("C2")

    def test_C2_split(self):
        self.paragraph()["segments"][0:1] = [{"t": "text", "v": "إن شانئك "}, {"t": "text", "v": "هو الأبتر"}]
        self.refused("C2")

    def test_C3(self):
        self.paragraph()["segments"][-1]["records"] = ["missing"]
        self.refused("C3")

    def test_C3_quote(self):
        self.paragraph()["segments"].append({"t": "quote", "v": "اختبار", "record": "missing"})
        self.refused("C3")

    def test_C4(self):
        self.paragraph()["segments"] = self.paragraph()["segments"][:-1]
        self.refused("C4")

    def test_C5(self):
        self.private["records"][0]["build_permission"]["decision"] = "معلّق"
        self.refused("C5")

    def test_C6(self):
        self.paragraph()["role"] = "transmission"
        self.paragraph()["segments"].insert(0, {"t": "quote", "v": "اقتباس مختلف", "record": "108-r1"})
        self.refused("C6")

    def test_C6_display(self):
        self.paragraph()["role"] = "transmission"
        self.private["records"][0]["display"]["decision"] = "لا"
        self.refused("C6")

    def test_C7(self):
        self.private["records"][0]["display"]["depth"] = "depth3"
        self.refused("C7")

    def test_C7_minimum(self):
        self.private["records"][0]["depth_min"] = 1
        self.refused("C7")

    def test_C8(self):
        self.private["records"][0]["display"]["decision"] = "لا"
        self.refused("C8")

    def test_C9(self):
        self.nasij["levels"] = self.nasij["levels"][:-1]
        self.refused("C9")

    def test_C9_empty(self):
        self.nasij["levels"][2]["blocks"] = []
        self.refused("C9")

    def test_C9_duplicate_depth(self):
        self.nasij["levels"][2]["depth"] = 1
        self.refused("C9")

    def test_C10(self):
        self.nasij["levels"][0]["blocks"].append(deepcopy(self.nasij["held"][0]["block"]))
        self.refused("C10")

    def test_cross_surah_keys(self):
        self.paragraph()["segments"][1]["key"] = "1:1"
        self.assertEqual(self.run_export().returncode, 0)
        value = exporter.read_json(self.content / "export/surah-108.json")
        self.assertIn("1:1", [a["key"] for a in value["ayahs"]])
        self.assertEqual(value["surah"]["ayah_count"], 3)

    def test_transmission_exact_status_and_mapping(self):
        r = self.private["records"][0]
        r["build_permission"]["decision"] = "معلّق"
        r["display"]["depth"] = "depth3"
        r["depth_min"] = 3
        for depth in range(3):
            self.nasij["levels"][depth]["blocks"] = [{"type": "heading", "text": "عنوان اختبار"}]
        p = self.paragraph(3)
        p["role"] = "transmission"
        p["segments"].insert(0, {"t": "quote", "v": "اقتباس اختبار حرفي", "record": r["id"]})
        e = r["evidence"][0]
        e["quote"] += " كلمة" * 70
        e["icon"] = "ijtihad_link"
        e["link_strength"] = "not_assessed"
        e["rulings"] = [{"kind": "ruling", "wording": "لفظ اختبار", "grader": "حاكم اختبار",
                         "locus": "footnote", "source_id": "book", "link": "same_passage",
                         "passage_ref": {"file": ".cache/sources/secret", "row_id": 42, "part": "footnote", "footnote_no": 2}},
                        {"kind": "note", "wording": "ملاحظة"}]
        # Non-supporting evidence must not add marker icons.
        e2 = deepcopy(e)
        e2.update(id="other-evidence", icon="hadith", link_strength=None, rulings=[])
        r["evidence"].append(e2)
        result = self.run_export()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        out = exporter.read_json(self.content / "export/surah-108.json")["records"][r["id"]]
        self.assertEqual(out["icons"], ["link"])
        self.assertEqual(out["status_text"], "سبب عرض\nسبب اختبار")
        self.assertEqual(out["evidence"][0]["link_strength"], "unrated")
        self.assertLessEqual(len(out["evidence"][0]["quote"]), 200)
        self.assertTrue(out["evidence"][0]["quote"].endswith("«…»"))
        self.assertEqual(len(out["evidence"][0]["rulings"]), 1)
        self.assertNotIn(".cache", json.dumps(out))

    def test_check_only_writes_nothing(self):
        snapshot = {p.relative_to(self.tmp.name): p.read_bytes() for p in Path(self.tmp.name).rglob("*") if p.is_file()}
        result = self.run_export("--check-only")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        after = {p.relative_to(self.tmp.name): p.read_bytes() for p in Path(self.tmp.name).rglob("*") if p.is_file()}
        self.assertEqual(snapshot, after)

    def test_mapping_refusal_and_malformed_input(self):
        self.private["records"][0]["claim_supported_by"] = ["missing"]
        self.refused("MAP")
        self.paragraph()["segments"].append({"t": "unknown"})
        result = self.run_export()
        self.assertEqual(result.returncode, 1)
        self.assertIn("INPUT FAIL", result.stdout)

    def test_small_review_pool_and_trim_boundaries(self):
        self.private["records"] = [self.private["records"][0]]
        self.assertEqual(self.run_export().returncode, 0)
        self.assertIn("## sample (1)", (self.records / "108/review.md").read_text())
        self.assertEqual(exporter.trim_quote("x" * 201), "«…»")
        self.assertEqual(exporter.trim_quote("x" * 196 + " " + "y" * 10), "x" * 196 + "«…»")


if __name__ == "__main__":
    unittest.main(verbosity=2)
