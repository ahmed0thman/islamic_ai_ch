#!/usr/bin/env python3
"""Find Quran quotations inside an Arabic ASR transcript and show where they diverge.

Usage:
  python3 tools/quran_scan.py <transcript.md> [--min 3] [--out citations.md]

The transcript is expected in the repo's transcript format: one paragraph per line,
each starting with an `[HH:MM:SS]` timestamp. Every run of >= --min consecutive
words that matches the mushaf (after normalization) is reported with its
surah:ayah reference, plus a word-level comparison of a few words on either side
of the match, which is where ASR usually garbled the quotation.

Output is a review aid, not an auto-fixer: every divergence still goes through the
transcript-cleanup triage in .claude/rules/transcript-cleanup.md.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).parent / "data" / "quran-simple-clean.json"

_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\ufeff]")
_NON_ARABIC = re.compile(r"[^\u0621-\u064A\s]")
_MAP = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي",
                      "ؤ": "و", "ئ": "ي", "ء": ""})
BASMALA = "بسم الله الرحمن الرحيم".split()
# Everyday formulae that happen to occur in the mushaf; a match that is exactly one
# of these is speech, not a citation.
FORMULAE = {tuple(p.split()) for p in (
    "ان شا الله", "ما شا الله", "ان لا اله الا", "لا اله الا", "لا شريك له",
    "لا حول ولا", "الله عليه وسلم", "رسول الله اليكم", "الحمد لله الذي",
    "قول قولي هذا", "بسم الله الرحمن",
)}


def normalize(text: str) -> list[str]:
    """Match YouTube's Arabic ASR orthography: no diacritics, bare alif, ه for ة, ي for ى."""
    text = _DIACRITICS.sub("", text).translate(_MAP)
    text = _NON_ARABIC.sub(" ", text)
    return text.split()


def load_quran():
    surahs = json.loads(DATA.read_text())["data"]["surahs"]
    words, refs = [], []  # one flat word stream across the whole mushaf
    names = {}
    for s in surahs:
        names[s["number"]] = s["name"].replace("سُورَةُ ", "")
        for a in s["ayahs"]:
            w = normalize(a["text"])
            # Tanzil prefixes ayah 1 of every surah (except 1 and 9) with the basmala.
            if a["numberInSurah"] == 1 and s["number"] not in (1, 9) and w[:4] == BASMALA:
                w = w[4:]
            for i, token in enumerate(w):
                words.append(token)
                refs.append((s["number"], a["numberInSurah"], i))
    return words, refs, names


def build_index(words, n):
    idx = defaultdict(list)
    for i in range(len(words) - n + 1):
        idx[tuple(words[i:i + n])].append(i)
    return idx


def scan(line_words, qwords, index, n):
    """Greedy left-to-right: longest mushaf match starting at each transcript position."""
    hits, i = [], 0
    while i <= len(line_words) - n:
        best = None
        for start in index.get(tuple(line_words[i:i + n]), ()):
            k = n
            while (i + k < len(line_words) and start + k < len(qwords)
                   and line_words[i + k] == qwords[start + k]):
                k += 1
            if best is None or k > best[1]:
                best = (start, k)
        if best:
            hits.append((i, best[0], best[1]))
            i += best[1]
        else:
            i += 1
    return hits


def fmt_ref(refs, names, start, length):
    s1, a1, _ = refs[start]
    s2, a2, _ = refs[start + length - 1]
    if (s1, a1) == (s2, a2):
        return f"{names[s1]} {s1}:{a1}"
    if s1 == s2:
        return f"{names[s1]} {s1}:{a1}-{a2}"
    return f"{names[s1]} {s1}:{a1} → {names[s2]} {s2}:{a2}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcript")
    ap.add_argument("--min", type=int, default=3, help="minimum consecutive matching words")
    ap.add_argument("--ctx", type=int, default=4, help="words of context to compare on each side")
    ap.add_argument("--out", help="write markdown here instead of stdout")
    args = ap.parse_args()

    qwords, refs, names = load_quran()
    index = build_index(qwords, args.min)
    ts_re = re.compile(r"^\[(\d\d:\d\d:\d\d)\]\s*(.*)")

    rows = []
    for lineno, line in enumerate(Path(args.transcript).read_text().splitlines(), 1):
        m = ts_re.match(line)
        if not m:
            continue
        ts, body = m.groups()
        lw = normalize(body)
        for i, qs, k in scan(lw, qwords, index, args.min):
            if tuple(lw[i:i + k]) in FORMULAE:
                continue
            ref = fmt_ref(refs, names, qs, k)
            c = args.ctx
            before_t = " ".join(lw[max(0, i - c):i])
            before_q = " ".join(qwords[max(0, qs - c):qs])
            after_t = " ".join(lw[i + k:i + k + c])
            after_q = " ".join(qwords[qs + k:qs + k + c])
            rows.append((lineno, ts, ref, k, " ".join(lw[i:i + k]),
                         before_t, before_q, after_t, after_q))

    out = [f"# Quran citations — {args.transcript}", "",
           f"min run = {args.min} words · {len(rows)} matches", "",
           "Divergence columns: transcript words vs mushaf words just outside the match. "
           "A near-miss there is the usual shape of an ASR-garbled quotation.", "",
           "| line | time | ref | n | matched | before: transcript / mushaf | after: transcript / mushaf |",
           "|---|---|---|---|---|---|---|"]
    for r in rows:
        lineno, ts, ref, k, matched, bt, bq, at, aq = r
        out.append(f"| {lineno} | {ts} | {ref} | {k} | {matched} | {bt} / **{bq}** | {at} / **{aq}** |")
    text = "\n".join(out) + "\n"
    if args.out:
        Path(args.out).write_text(text)
        print(f"{len(rows)} matches → {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
