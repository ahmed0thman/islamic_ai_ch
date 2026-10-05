#!/usr/bin/env python3
"""Checks tools/retrieve.py normalize() against tools/data/normalize-cases.json.

The TypeScript twin (app/src/lib/ask/normalize.test.ts) reads the same file.
Run: python3 -B -m unittest tools/test_normalize_cases.py
"""

import json
from pathlib import Path
import sys
import unittest

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import retrieve  # noqa: E402

CASES = json.loads((TOOLS / "data/normalize-cases.json").read_text(encoding="utf-8"))["cases"]


class NormalizeCases(unittest.TestCase):
    def test_there_are_twenty_cases(self):
        self.assertEqual(len(CASES), 20)

    def test_every_case(self):
        for case in CASES:
            with self.subTest(source=case["source"]):
                self.assertEqual(retrieve.normalize(case["input"]), case["expected"])

    def test_idempotent(self):
        for case in CASES:
            with self.subTest(source=case["source"]):
                self.assertEqual(retrieve.normalize(case["expected"]), case["expected"])


if __name__ == "__main__":
    unittest.main()
