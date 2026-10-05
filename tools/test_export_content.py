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
        review = self.records / "108/review.md"
        review_before = review.read_bytes() if review.exists() else None
        # A previous passing case may already have published this surah.
        expected_index = sorted(
            value["surah"]["no"]
            for path in (self.content / "export").glob("surah-*.json")
            if not (value := exporter.read_json(path))["fixture"]
        )
        private_before = json.dumps(self.private, ensure_ascii=False, indent=2) + "\n"
        result = self.run_export()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"{code} FAIL", result.stdout)
        for check in exporter.CHECKS:
            self.assertIn(f"108 {check} ", result.stdout)
        self.assertEqual((self.content / "export/surah-108.json").read_bytes(), before)
        self.assertEqual((self.records / "108/records.v2.json").read_text(), private_before)
        if review_before is None:
            self.assertFalse(review.exists())
        else:
            self.assertEqual(review.read_bytes(), review_before)
        self.assertEqual([s["no"] for s in exporter.read_json(self.content / "export/index.json")["surahs"]], expected_index)

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

    def test_C6_transmission_without_quote(self):
        self.paragraph()["role"] = "transmission"
        self.refused("C6")

    def test_C6_transmission_with_quote_passes(self):
        self.paragraph()["role"] = "transmission"
        self.paragraph()["segments"].insert(0, {"t": "quote", "v": "اقتباس اختبار حرفي", "record": "108-r1"})
        result = self.run_export()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

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


class ContentShapeTests(unittest.TestCase):
    setUp = ExportTests.setUp
    save = ExportTests.save
    run_export = ExportTests.run_export
    refused = ExportTests.refused
    paragraph = ExportTests.paragraph
    def details(self):
        block = {"type": "details", "title": [
            {"t": "text", "v": "Short answer"}, {"t": "term", "v": "Term", "record": "108-s0"},
            {"t": "mark", "records": ["108-r1"]}], "blocks": [deepcopy(self.paragraph())]}
        self.nasij["levels"][0]["blocks"].append(block)
        return block

    def term(self, role="claim"):
        self.paragraph()["role"] = role
        segment = {"t": "term", "v": "Term", "record": "108-s0"}
        self.paragraph()["segments"].insert(0, segment)
        return segment

    def passes(self):
        result = self.run_export()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        value = exporter.read_json(self.content / "export/surah-108.json")
        self.assertEqual(value["levels"], self.nasij["levels"])
        return value

    def input_refused(self):
        result = self.run_export("--check-only")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("INPUT FAIL", result.stdout)

    def quran_text(self):
        return next(a["aya_text"] for a in exporter.read_json(exporter.QURAN)
                    if a["sura_no"] == 108 and len(exporter.normalize(a["aya_text"])) >= 4)

    def test_question_kind_and_answer(self):
        question = {"type": "heading", "kind": "question", "text": "Question?"}
        self.nasij["levels"][0]["blocks"].insert(0, question)
        self.passes()
        for kind in ("other", None):
            with self.subTest(kind=kind):
                question["kind"] = kind
                self.input_refused()
        question["kind"] = "question"
        self.nasij["levels"][0]["blocks"].reverse()
        self.input_refused()

    def test_question_C2(self):
        question = {"type": "heading", "kind": "question", "text": "Question?"}
        self.nasij["levels"][0]["blocks"].insert(0, question)
        self.passes()
        question["text"] = self.quran_text()
        self.refused("C2")

    def test_details_title_segment_types(self):
        block = self.details()
        self.passes()
        for segment in ({"t": "ayah", "key": "108:1"},
                        {"t": "quote", "v": "Quote", "record": "108-r1"}):
            with self.subTest(segment=segment):
                block["title"][0] = segment
                self.input_refused()

    def test_details_title_C2(self):
        block = self.details()
        self.passes()
        block["title"][0]["v"] = self.quran_text()
        self.refused("C2")

    def test_details_title_C3(self):
        block = self.details()
        self.passes()
        block["title"][-1]["records"] = ["missing"]
        self.refused("C3")

    def test_details_title_C4(self):
        block = self.details()
        self.passes()
        block["title"].pop()
        self.refused("C4")

    def test_details_title_ends_with_mark(self):
        block = self.details()
        self.passes()
        block["title"].append({"t": "text", "v": "Trailing text"})
        self.refused("C4")

    def test_details_title_permissions_and_depth(self):
        for code, field, value in (("C5", "build_permission", None), ("C8", "display", None),
                                   ("C7", "depth_min", 1), ("C7", "display", "depth3")):
            with self.subTest(code=code, field=field, value=value):
                self.nasij, self.private = fixtures()
                block = self.details()
                block["title"][-1]["records"] = ["108-s1", "108-s2"]
                self.passes()
                r = next(r for r in self.private["records"] if r["id"] == "108-s2")
                if field == "depth_min":
                    r[field] = value
                else:
                    r[field]["depth" if value == "depth3" else "decision"] = value
                self.refused(code)

    def test_details_inner_blocks_only_paragraphs(self):
        block = self.details()
        self.passes()
        for inner in ({"type": "heading", "text": "Heading"}, {"type": "ayah", "keys": ["108:1"]},
                      deepcopy(block)):
            with self.subTest(type=inner["type"]):
                block["blocks"] = [inner]
                self.input_refused()

    def test_details_inner_claim_checks(self):
        for code in ("C1", "C2", "C3", "C4", "C5", "C7", "C8"):
            with self.subTest(code=code):
                self.nasij, self.private = fixtures()
                block = self.details()
                inner = block["blocks"][0]
                inner["segments"][-1]["records"] = ["108-s1"]
                r = next(r for r in self.private["records"] if r["id"] == "108-s1")
                self.passes()
                if code == "C1": inner["segments"][1]["key"] = "108:99"
                elif code == "C2": inner["segments"][0]["v"] = self.quran_text()
                elif code == "C3": inner["segments"][-1]["records"] = ["missing"]
                elif code == "C4": inner["segments"].pop()
                elif code == "C5": r["build_permission"]["decision"] = None
                elif code == "C7": r["depth_min"] = 1
                elif code == "C8": r["display"]["decision"] = None
                self.refused(code)

    def test_details_inner_transmission(self):
        block = self.details()
        inner = block["blocks"][0]
        inner["role"] = "transmission"
        inner["segments"][-1]["records"] = ["108-s1"]
        r = next(r for r in self.private["records"] if r["id"] == "108-s1")
        inner["segments"].insert(0, {"t": "quote", "v": r["evidence"][0]["quote"], "record": r["id"]})
        self.passes()
        allowed = r["build_permission"]["decision"]
        r["build_permission"]["decision"] = None
        records, _ = exporter.validate_shape(self.nasij, self.private, 108)
        quran = {f"{a['sura_no']}:{a['aya_no']}": a for a in exporter.read_json(exporter.QURAN)}
        counts, _, _ = exporter.run_checks(self.nasij, records, quran, 108)
        self.assertTrue(all(not failures for _, failures in counts.values()), counts)
        r["build_permission"]["decision"] = allowed
        inner["segments"][0]["v"] = "Not verbatim"
        self.refused("C6")
        inner["segments"][0]["v"] = r["evidence"][0]["quote"]
        r["display"]["decision"] = None
        self.refused("C6")

    def test_term_C2(self):
        term = self.term()
        self.passes()
        term["v"] = self.quran_text()
        self.refused("C2")

    def test_term_C2_adjacent_text(self):
        term = self.term()
        self.passes()
        words = self.quran_text().split()
        term["v"] = " ".join(words[:2]) + " "
        self.paragraph()["segments"][1]["v"] = " ".join(words[2:])
        self.refused("C2")

    def test_term_C3(self):
        term = self.term()
        self.passes()
        term["record"] = "missing"
        self.refused("C3")

    def test_term_not_a_marker(self):
        self.term()
        self.passes()
        self.paragraph()["segments"].pop()
        self.refused("C4")

    def test_term_permissions_and_depth_in_both_roles(self):
        for role in ("claim", "transmission"):
            for code, field, value in (("C5", "build_permission", None), ("C8", "display", None),
                                       ("C7", "depth_min", 1), ("C7", "display", "depth3")):
                with self.subTest(role=role, code=code, value=value):
                    self.nasij, self.private = fixtures()
                    self.term(role)
                    if role == "transmission":
                        self.paragraph()["segments"].insert(
                            0, {"t": "quote", "v": "اقتباس اختبار حرفي في المصدر", "record": "108-r1"})
                    self.passes()
                    r = next(r for r in self.private["records"] if r["id"] == "108-s0")
                    if field == "depth_min": r[field] = value
                    else: r[field]["depth" if value == "depth3" else "decision"] = value
                    self.refused(code)

    def test_held_new_shapes_excluded(self):
        block = self.details()
        question = {"type": "heading", "kind": "question", "text": "Question?"}
        shapes = [question, deepcopy(block), {"type": "paragraph", "role": "claim", "segments": [
            {"t": "term", "v": "Held term", "record": "missing"}]}]
        self.nasij["levels"][0]["blocks"].remove(block)
        for shape in shapes:
            self.nasij["held"].append({"depth": 0, "block": shape, "reason": "Held"})
        value = self.passes()
        self.assertNotIn("missing", value["records"])
        self.assertNotIn("108-s0", value["records"])
        for shape in shapes[:2]:
            with self.subTest(type=shape["type"]):
                self.nasij["levels"][0]["blocks"].insert(0, shape)
                self.refused("C10")
                self.nasij["levels"][0]["blocks"].remove(shape)
        held_term = shapes[2]
        self.nasij["levels"][0]["blocks"].append(held_term)
        self.refused("C10")

    def test_held_inner_paragraph_excluded(self):
        block = self.details()
        self.passes()
        self.nasij["held"].append({"depth": 0, "block": deepcopy(block["blocks"][0]), "reason": "Held"})
        self.refused("C10")


class MapTests(unittest.TestCase):
    setUp = ExportTests.setUp
    save = ExportTests.save
    run_export = ExportTests.run_export
    refused = ExportTests.refused
    paragraph = ExportTests.paragraph
    details = ContentShapeTests.details
    quran_text = ContentShapeTests.quran_text
    def stop(self, paragraph=None):
        paragraph = self.paragraph() if paragraph is None else paragraph
        paragraph["title"] = self.paragraph()["segments"][0]["v"]
        return paragraph

    def exported(self):
        result = self.run_export()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return exporter.read_json(self.content / "export/surah-108.json")

    def passage(self):
        self.nasij["passages"] = [
            {"id": "p1", "from": "108:1", "to": "108:1",
             "title": self.paragraph()["segments"][0]["v"], "records": ["108-s0"]},
            {"id": "p2", "from": "108:2", "to": "108:3",
             "title": self.paragraph()["segments"][0]["v"], "records": ["108-r1"]}]
        self.stop()["passage"] = "p1"

    def test_C11_titles(self):
        p = self.stop()
        title = p["title"]
        self.assertEqual(self.exported()["levels"][0]["blocks"][0]["title"], title)
        for bad in ("", "  ", " ".join([title.split()[0]] * 9), None, [], self.quran_text()):
            with self.subTest(title=bad):
                p["title"] = bad
                self.refused("C11")
        p["title"] = title
        heading = {"type": "heading", "text": title, "title": title}
        self.nasij["levels"][0]["blocks"].append(heading)
        self.refused("C11")

    def test_C12_inference_and_explicit_ayahs(self):
        p = self.stop()
        p["segments"].insert(0, {"t": "term", "v": p["title"], "record": "108-s0"})
        self.private["records"][0]["ayah_keys"] = ["108:3", "1:1", "108:1"]
        self.private["records"][1]["ayah_keys"] = ["108:2", "108:1"]
        out = self.exported()
        self.assertEqual(out["levels"][0]["blocks"][0]["ayahs"], ["108:1", "108:2", "108:3"])
        self.assertEqual(out["records"]["108-r1"]["ayah_keys"], ["108:3", "1:1", "108:1"])
        p["ayahs"] = ["108:2"]
        self.assertEqual(self.exported()["levels"][0]["blocks"][0]["ayahs"], ["108:2"])
        for bad in ([], ["108:99"], ["1:1"], "108:1", [None]):
            with self.subTest(ayahs=bad):
                p["ayahs"] = bad
                self.refused("C12")

    def test_C12_no_inferred_ayah(self):
        self.stop()
        self.exported()
        self.private["records"][0]["ayah_keys"] = ["1:1"]
        self.refused("C12")

    def test_C12_explicit_ayah_must_be_carried(self):
        p = self.stop()
        p["ayahs"] = ["108:1"]
        self.exported()
        p["ayahs"] = ["108:2"]
        result = self.run_export()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("W12 WARN", result.stdout)

    def test_C12_empty_carried_union_skips_membership(self):
        self.stop()
        self.private["records"][0]["ayah_keys"] = ["1:1"]
        self.paragraph()["segments"][-1]["records"] = ["108-s1"]
        self.private["records"][1]["ayah_keys"] = []
        self.paragraph()["ayahs"] = ["108:1"]
        self.exported()

    def test_C13_passages_and_records(self):
        self.passage()
        out = self.exported()
        self.assertEqual(out["passages"], self.nasij["passages"])
        self.assertIn("108-s0", out["records"])
        original = deepcopy(self.nasij["passages"])
        changes = [("id", "p1"), ("from", "108:3"), ("from", "108:1"),
                   ("to", "108:2"), ("to", "108:1"), ("from", "1:1"),
                   ("records", ["missing"]), ("records", [])]
        for field, value in changes:
            with self.subTest(field=field, value=value):
                self.nasij["passages"] = deepcopy(original)
                self.nasij["passages"][1][field] = value
                self.refused("C13")
        self.nasij["passages"] = deepcopy(original)
        self.nasij["passages"].reverse()
        self.refused("C13")
        for bad in ([], None, [{}]):
            self.nasij["passages"] = bad
            self.refused("C13")
        self.nasij["passages"] = original
        self.private["records"][1]["display"]["decision"] = None
        self.refused("C13")

    def test_C13_passage_build_permission(self):
        self.passage()
        self.exported()
        self.private["records"][0]["build_permission"]["decision"] = "معلّق"
        self.refused("C13")
        self.private["records"][0]["build_permission"]["decision"] = "نعم"
        self.private["records"][1]["build_permission"]["decision"] = None
        self.refused("C13")

    def test_C13_block_membership(self):
        self.passage()
        self.exported()
        for ident in ("missing", None, "p2"):
            self.paragraph()["passage"] = ident
            self.refused("C13")
        self.paragraph().pop("passage")
        self.refused("C13")
        self.paragraph()["passage"] = "p1"
        heading = {"type": "heading", "text": self.paragraph()["title"], "passage": "p1"}
        self.nasij["levels"][0]["blocks"].append(heading)
        self.exported()
        heading["passage"] = "missing"
        self.refused("C13")

    def test_C14_nested_and_depth_limits(self):
        self.stop()
        p = deepcopy(self.paragraph())
        for depth in (0, 1, 2):
            with self.subTest(depth=depth):
                self.nasij["levels"][depth]["blocks"] = [deepcopy(p) for _ in range(11)]
                block = self.details()
                if depth != 0:
                    self.nasij["levels"][0]["blocks"].remove(block)
                    self.nasij["levels"][depth]["blocks"].append(block)
                block["blocks"] = [deepcopy(p)]
                self.exported()
                block["blocks"].append(deepcopy(p))
                self.refused("C14")
                self.nasij["levels"][depth]["blocks"] = [deepcopy(p)]
        self.nasij["levels"][3]["blocks"] = [deepcopy(p) for _ in range(20)]
        self.exported()

    def test_nested_and_held_map_fields(self):
        block = self.details()
        inner = self.stop(block["blocks"][0])
        out = self.exported()
        self.assertEqual(out["levels"][0]["blocks"][-1]["blocks"][0]["ayahs"], ["108:1"])
        held = deepcopy(inner)
        held.update(title=None, ayahs=["missing"], passage="missing")
        self.nasij["held"].append({"depth": 0, "block": held, "reason": "Held"})
        out = self.exported()
        self.assertNotIn(held, out["levels"][0]["blocks"])
        inner["ayahs"] = ["108:99"]
        self.refused("C12")


if __name__ == "__main__":
    unittest.main(verbosity=2)
