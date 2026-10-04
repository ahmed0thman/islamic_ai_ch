#!/usr/bin/env python3
"""Find Quran quotations inside an Arabic ASR transcript and show where they diverge.

Usage:
  python3 tools/quran_scan.py <transcript.md> [--min 3] [--out citations.md]

The transcript is expected in the repo's transcript format: one paragraph per line,
each starting with an `[HH:MM:SS]` timestamp. Every run of >= --min consecutive
words that matches the mushaf (after normalization) is reported with its
surah:ayah reference, plus a word-level comparison of a few words on either side
of the match, which is where ASR usually garbled the quotation.

The mushaf is the King Fahd Complex Hafs text (ق-038), matched on its
`aya_text_emlaey` field. Tanzil's simple-clean text stays in data/ for comparison
only; the scan no longer reads it.

Output is a review aid, not an auto-fixer: every divergence still goes through the
transcript-cleanup triage in .claude/rules/transcript-cleanup.md.
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).parent / "data" / "qurancomplex" / "hafsData_v2-0.json"

_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\ufeff]")
_NON_ARABIC = re.compile(r"[^\u0621-\u064A\s]")
_MAP = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي",
                      "ؤ": "و", "ئ": "ي", "ء": ""})
# Everyday formulae that happen to occur in the mushaf; a match that is exactly one
# of these is speech, not a citation.
FORMULAE = {tuple(p.split()) for p in (
    "ان شا الله", "ما شا الله", "ان لا اله الا", "لا اله الا", "لا شريك له",
    "لا حول ولا", "الله عليه وسلم", "رسول الله اليكم", "الحمد لله الذي",
    "قول قولي هذا", "بسم الله الرحمن",
)}

# The Complex's emlaey text writes some words apart or together where transcripts
# (and the Tanzil text this tool used before) do not; ayah_words() follows the transcripts:
#  - the vocative يا is joined to its noun (ياأيها، وياقوم). Three words start with
#    يا without being vocatives; the Uthmani text spells them with a full alif.
_VOCATIVE = re.compile(r"^(و?يا)(.+)$")
NOT_VOCATIVE = {"يابس", "يابسات", "ياسين"}
#  - interrogative hamza + waw stands apart as أو (أو لم for أَوَلَمۡ). It is rejoined
#    only where the Uthmani text of the same ayah has the joined word, since أو on its
#    own is also the conjunction "or" (أو لا يستطيع، 2:282).
_AWA = "أَوَ"
# Spellings that differ between the Complex text and transcripts. Both sides get the
# same matching key; the report still shows each side's own words.
FOLD = (
    ("سماوات", "سموات"),  # the Complex writes السموات
    ("لاتخذت", "لتخذت"),  # the Complex follows the rasm in 18:77
    ("داوود", "داود"),
    ("حيي", "حي"),  # the Complex writes يحي and لمحي where the rasm has one ya (30:50)
)


def normalize(text: str) -> list[str]:
    """Match YouTube's Arabic ASR orthography: no diacritics, bare alif, ه for ة, ي for ى."""
    text = _DIACRITICS.sub("", text).translate(_MAP)
    text = _NON_ARABIC.sub(" ", text)
    return text.split()


def key(word: str) -> str:
    """Matching key: FOLD, the hamza seat (أإذا in Tanzil, أئذا in the Complex), and the
    alif after a final waw (ندعو in transcripts, ندعوا in the Complex)."""
    for a, b in FOLD:
        word = word.replace(a, b)
    if word.startswith("اا") and len(word) > 2:
        word = "اي" + word[2:]
    return word[:-1] if word.endswith("وا") else word


def ayah_words(emlaey: str, uthmani: str) -> list[str]:
    """One ayah's words, split and joined the way transcripts write them."""
    words = []
    for w in emlaey.split():
        m = _VOCATIVE.match(w)
        words += [m[1], m[2]] if m and w not in NOT_VOCATIVE else [w]
    joined = {normalize(w)[0] for w in uthmani.split() if w.startswith(_AWA)}
    out = []
    for w in words:
        if out and out[-1] == "أو" and normalize(out[-1] + w)[0] in joined:
            out[-1] += w
        else:
            out.append(w)
    return normalize(" ".join(out))


# Two apparent slips in the Complex's aya_text_emlaey field (the rasm field is right).
# Corrected here, at load time and for matching only; hafsData_v2-0.json is untouched
# (ق-133 asks whether to tell the Complex).
EMLAEY_FIXES = {
    (16, 12): (("اليل", "الليل"),),     # an-Nahl 12: one lam missing
    (24, 33): (("يكرهن", "يكرههن"),),   # an-Nur 33: one ha missing
}


def load_quran():
    words, refs = [], []  # one flat word stream across the whole mushaf
    names = {}
    for a in json.loads(DATA.read_text()):
        s = a["sura_no"]
        names[s] = a["sura_name_ar"]
        # Unlike Tanzil, the Complex text does not prefix ayah 1 with the basmala.
        emlaey = a["aya_text_emlaey"]
        for bad, good in EMLAEY_FIXES.get((s, a["aya_no"]), ()):
            emlaey = re.sub(rf"(?<!\S){bad}(?!\S)", good, emlaey)
        for i, token in enumerate(ayah_words(emlaey, a["aya_text"])):
            words.append(token)
            refs.append((s, a["aya_no"], i))
    return words, refs, names


def build_index(keys, n):
    idx = defaultdict(list)
    for i in range(len(keys) - n + 1):
        idx[tuple(keys[i:i + n])].append(i)
    return idx


def scan(line_keys, qkeys, index, n):
    """Greedy left-to-right: longest mushaf match starting at each transcript position."""
    hits, i = [], 0
    while i <= len(line_keys) - n:
        best = None
        for start in index.get(tuple(line_keys[i:i + n]), ()):
            k = n
            while (i + k < len(line_keys) and start + k < len(qkeys)
                   and line_keys[i + k] == qkeys[start + k]):
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
    qkeys = [key(w) for w in qwords]
    index = build_index(qkeys, args.min)
    ts_re = re.compile(r"^\[(\d\d:\d\d:\d\d)\]\s*(.*)")

    rows = []
    for lineno, line in enumerate(Path(args.transcript).read_text().splitlines(), 1):
        m = ts_re.match(line)
        if not m:
            continue
        ts, body = m.groups()
        lw = normalize(body)
        for i, qs, k in scan([key(w) for w in lw], qkeys, index, args.min):
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
