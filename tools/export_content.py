#!/usr/bin/env python3
"""Export verified private records and nasij. Offline, standard library only.

--check-only performs all validation/mapping without writing anything. Refused
surahs preserve existing exports. Review samples cover the entire private file,
use the surah number as seed, and round 20% upward (minimum five, pool permitting).
"""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import random
import sys

from quran_scan import normalize, key

PROJECT = Path(__file__).resolve().parent.parent
QURAN = PROJECT / "tools/data/qurancomplex/hafsData_v2-0.json"
ICON_MAP = {"ayah": "ayah", "hadith": "hadith", "athar": "athar",
            "scholar": "scholar", "ijtihad_link": "link", "hidaya": "hidaya"}
CHECKS = {
    "C1": "ayah keys exist", "C2": "system text contains no Quran",
    "C3": "record references exist", "C4": "paragraphs have markers",
    "C5": "claims have build permission", "C6": "transmissions and verbatim quotes",
    "C7": "record depth restrictions", "C8": "display refusals excluded",
    "C9": "four nonempty levels", "C10": "held blocks excluded",
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def text(value, label, nonempty=False):
    require(isinstance(value, str) and (not nonempty or bool(value.strip())),
            f"{label}: expected {'nonempty ' if nonempty else ''}string")
    return value


def unique_map(items, label):
    require(isinstance(items, list), f"{label}: expected list")
    result = {}
    for item in items:
        require(isinstance(item, dict), f"{label}: expected object")
        ident = text(item.get("id"), f"{label}.id", True)
        require(ident not in result, f"{label}: duplicate id {ident}")
        result[ident] = item
    return result


def validate_shape(nasij, private, no):
    """Fail closed on malformed input rather than skipping unknown constructs."""
    require(isinstance(nasij, dict) and nasij.get("surah") == no, "nasij surah mismatch")
    require(isinstance(private, dict) and private.get("meta", {}).get("surah") == no,
            "private records surah mismatch")
    require(private["meta"].get("schema_version") == 2, "expected private schema version 2")
    records = unique_map(private.get("records"), "records")
    sources = unique_map(private.get("sources"), "sources")
    require(isinstance(nasij.get("levels"), list), "levels: expected list")
    require(isinstance(nasij.get("held", []), list), "held: expected list")

    def block_shape(block):
        require(isinstance(block, dict), "block: expected object")
        kind = block.get("type")
        if kind == "heading":
            text(block.get("text"), "heading.text", True)
        elif kind == "ayah":
            require(isinstance(block.get("keys"), list) and block["keys"], "ayah.keys: expected nonempty list")
            for ref in block["keys"]:
                text(ref, "ayah key", True)
        elif kind == "paragraph":
            require(block.get("role") in ("claim", "transmission"), "unknown paragraph role")
            require(isinstance(block.get("segments"), list) and block["segments"], "segments: expected nonempty list")
            for seg in block["segments"]:
                require(isinstance(seg, dict), "segment: expected object")
                t = seg.get("t")
                require(t in ("text", "ayah", "quote", "mark"), f"unknown segment type {t!r}")
                if t in ("text", "quote"):
                    text(seg.get("v"), "segment.v", t == "quote")
                if t == "ayah":
                    text(seg.get("key"), "segment.key", True)
                if t == "quote":
                    text(seg.get("record"), "quote.record", True)
                if t == "mark":
                    require(isinstance(seg.get("records"), list) and seg["records"], "mark.records: expected nonempty list")
                    for ident in seg["records"]:
                        text(ident, "mark record", True)
        else:
            raise ValueError(f"unknown block type {kind!r}")

    for level in nasij["levels"]:
        require(isinstance(level, dict) and type(level.get("depth")) is int, "level.depth: expected integer")
        require(isinstance(level.get("blocks"), list), "level.blocks: expected list")
        for block in level["blocks"]:
            block_shape(block)
    for held in nasij.get("held", []):
        require(isinstance(held, dict) and type(held.get("depth")) is int and isinstance(held.get("block"), dict), "invalid held entry")
        # Held content is not validated as publishable text: it may be unfinished.
    return records, sources


def run_checks(nasij, records, quran, no):
    counts = {c: [0, []] for c in CHECKS}
    uses = defaultdict(list)
    ayah_refs = set()

    def check(c, ok, reason):
        counts[c][0] += 1
        if not ok:
            counts[c][1].append(reason)

    windows = set()
    for ref, ayah in quran.items():
        if ayah["sura_no"] == no:
            words = [key(w) for w in normalize(ayah["aya_text"])]
            windows.update(tuple(words[i:i + 4]) for i in range(len(words) - 3))

    def check_text(value, where):
        words = [key(w) for w in normalize(value)]
        found = next((" ".join(words[i:i + 4]) for i in range(len(words) - 3)
                      if tuple(words[i:i + 4]) in windows), None)
        check("C2", "﴿" not in value and "﴾" not in value and found is None,
              f"{where}: Quran brackets or four-word match {found!r}")

    levels = nasij["levels"]
    check("C9", len(levels) == 4 and sorted(l["depth"] for l in levels) == [0, 1, 2, 3]
          and all(l["blocks"] for l in levels), "expected exactly depths 0..3 with nonempty blocks")
    held = [h["block"] for h in nasij.get("held", [])]
    for level in levels:
        depth = level["depth"]
        for bnum, block in enumerate(level["blocks"], 1):
            where = f"level {depth}, block {bnum}"
            check("C10", block not in held, f"{where}: block is also listed under held")
            if block["type"] == "heading":
                check_text(block["text"], where)
            refs = block.get("keys", []) if block["type"] == "ayah" else []
            if block["type"] == "paragraph":
                segments = block["segments"]
                check("C4", any(s["t"] == "mark" for s in segments), f"{where}: no marker")
                # Also scan adjacent system-text segments together to prevent splitting a citation.
                pending = []
                for seg in segments + [{"t": "end"}]:
                    if seg["t"] == "text":
                        pending.append(seg["v"])
                    else:
                        if pending:
                            check_text("".join(pending), where)
                            pending = []
                for snum, seg in enumerate(segments, 1):
                    location = f"{where}, segment {snum}, role {block['role']}"
                    if seg["t"] == "ayah":
                        refs.append(seg["key"])
                    ids = seg.get("records", []) if seg["t"] == "mark" else [seg["record"]] if seg["t"] == "quote" else []
                    for ident in ids:
                        check("C3", ident in records, f"{location}: unknown record {ident}")
                        uses[ident].append(location)
                        if ident not in records:
                            continue
                        r = records[ident]
                        display = r.get("display", {})
                        if block["role"] == "claim":
                            check("C5", r.get("build_permission", {}).get("decision") == "نعم", f"{location}: {ident} build permission is not نعم")
                        else:
                            check("C6", display.get("decision") == "نعم", f"{location}: {ident} display permission is not نعم")
                        if seg["t"] == "quote":
                            check("C6", any(seg["v"] in e.get("quote", "") for e in r["evidence"]),
                                  f"{location}: quote is not an exact substring of {ident} evidence")
                        minimum = r.get("depth_min")
                        check("C7", type(minimum) is int and 0 <= minimum <= depth and
                              (display.get("depth") != "depth3" or depth == 3),
                              f"{location}: {ident} violates depth_min/depth3")
                        check("C8", display.get("decision") == "نعم", f"{location}: {ident} display permission is not نعم")
            for ref in refs:
                ayah_refs.add(ref)
                check("C1", ref in quran, f"{where}: unknown ayah {ref}")
    for ident in uses.keys() & records.keys():
        r = records[ident]
        for owner in [r] + r["evidence"]:
            for ref in owner.get("ayah_keys") or []:
                check("C1", ref in quran, f"{ident}: unknown record/evidence ayah {ref}")
    return counts, uses, ayah_refs


def trim_quote(quote):
    """Count the truncation suffix itself within the 200-character limit."""
    if len(quote) <= 200:
        return quote
    prefix = quote[:197]
    # If character 198 continues a word, retreat to the preceding whitespace.
    if not quote[197].isspace():
        ends = [i for i, ch in enumerate(prefix) if ch.isspace()]
        prefix = prefix[:ends[-1]] if ends else ""
    return prefix.rstrip() + "«…»"


def public_record(r, sources, ui, quran):
    ident = r["id"]
    text(r.get("claim"), f"{ident}.claim", True)
    require(r.get("build_permission", {}).get("decision") in ("نعم", "معلّق", "لا"), f"{ident}: unknown build decision")
    require(r.get("display", {}).get("decision") in ("نعم", "لا"), f"{ident}: unknown display decision")
    require(r["display"].get("depth") in ("from_depth_min", "depth3"), f"{ident}: unknown display depth")
    require(r.get("review_tier") in ("all", "sample", "none"), f"{ident}: unknown review tier")
    badge = r.get("badge") or None
    require(badge is None or badge in ui["badges"], f"{ident}: unknown badge {badge!r}")
    evidence = unique_map(r.get("evidence"), f"{ident}.evidence")
    supported = r.get("claim_supported_by")
    require(isinstance(supported, list) and supported and all(e in evidence for e in supported), f"{ident}: invalid claim_supported_by")
    icons = set()
    out = []
    for eid, e in evidence.items():
        require(e.get("icon") in ICON_MAP, f"{eid}: unknown evidence icon")
        icon = ICON_MAP[e["icon"]]
        require(icon in ui["icon_order"] and icon in ui["icons"], f"{eid}: icon missing in UI")
        if eid in supported:
            icons.add(icon)
        source = sources.get(e.get("source_id"))
        require(source is not None or icon == "ayah", f"{eid}: source missing")
        if icon == "ayah" and source is None:
            source = next((s for s in sources.values() if s.get("platform") == "qurancomplex"), {})
        source = source or {}
        quote = e.get("quote") or ""
        if icon == "ayah":
            require(bool(e.get("ayah_keys")), f"{eid}: ayah evidence has no keys")
            quote = "\n".join(quran[ref]["aya_text"] for ref in e["ayah_keys"])
        text(quote, f"{eid}.quote", icon != "ayah")
        title = text(source.get("title", ""), f"{eid}.source_title", icon != "ayah")
        author = text(e.get("sayer") or source.get("author", ""), f"{eid}.author", icon != "ayah")
        locator = text(e.get("locator") or (", ".join(e["ayah_keys"]) if icon == "ayah" else ""), f"{eid}.locator", icon != "ayah")
        url = e.get("page_url") or None
        require(url is None or isinstance(url, str), f"{eid}: invalid page_url")
        strength = e.get("link_strength") or None
        if strength == "not_assessed":
            strength = "unrated"
        require(strength is None or strength in ("strong", "medium", "weak", "unrated") and strength in ui["link_strength"], f"{eid}: unknown link_strength")
        rulings = []
        for ruling in e.get("rulings", []):
            # Notes and narrator comments are not rulings (record-schema 2.4).
            require(ruling.get("kind") in ("ruling", "note", "narrator"), f"{eid}: unknown ruling kind")
            if ruling["kind"] != "ruling":
                continue
            rs = sources.get(ruling.get("source_id"))
            require(rs is not None, f"{eid}: ruling source missing")
            ref = ruling.get("passage_ref") or {}
            # No private file paths or invented Arabic labels in the public output.
            coordinates = {k: ref[k] for k in ("row_id", "part", "footnote_no") if ref.get(k) is not None}
            where = " | ".join(str(v) for v in (rs["title"], ruling.get("locus", ""),
                              e["locator"] if ruling.get("link") == "same_passage" else "",
                              json.dumps(coordinates, ensure_ascii=False, sort_keys=True)) if v)
            rulings.append({"text": text(ruling.get("wording"), "ruling.wording", True),
                            "ruler": text(ruling.get("grader") or "", "ruling.grader"), "where": where})
        out.append({"icon": icon, "source_title": title, "author": author,
                    "locator": locator, "quote": trim_quote(quote), "url": url,
                    "rulings": rulings, "link_strength": strength})
    status = ""
    if r["build_permission"]["decision"] != "نعم" or r["display"]["depth"] == "depth3":
        reasons = []
        for field in ("display", "build_permission"):
            reason = text(r[field].get("reason"), f"{ident}.{field}.reason", True)
            if reason not in reasons:
                reasons.append(reason)
        status = "\n".join(reasons)
    return {"id": ident, "icons": [i for i in ui["icon_order"] if i in icons],
            "badge": badge, "claim": r["claim"], "status_text": status,
            "depth_min": r["depth_min"], "evidence": out}


def review_text(records, sources, uses, no):
    pools = {tier: sorted((r for r in records.values() if r.get("review_tier") == tier), key=lambda r: r["id"])
             for tier in ("all", "sample")}
    sample = pools["sample"]
    size = min(len(sample), max(5, math.ceil(len(sample) * .2)))
    pools["sample"] = sorted(random.Random(no).sample(sample, size), key=lambda r: r["id"])
    lines = [f"# Surah {no} — human review", "", f"Seed: {no}; sample: {size}/{len(sample)} (20%, rounded up; minimum 5 where available).", ""]
    for tier, selected in pools.items():
        lines += [f"## {tier} ({len(selected)})", ""]
        for r in selected:
            lines += [f"- [ ] {r['id']}", f"  Claim: {r['claim']}"]
            for e in r["evidence"]:
                source = sources.get(e.get("source_id"), {})
                lines += [f"  Source: {source.get('title', '')}; {e.get('sayer') or source.get('author', '')}; {e.get('locator', '')}",
                          f"  Quote: {e.get('quote') or ''}"]
            lines += ["  Used: " + "; ".join(uses.get(r["id"], ["not used in exported text"])), ""]
    return "\n".join(lines) + "\n"


def export_surah(no, records_root, content_root, quran, ui, check_only=False):
    try:
        private = read_json(records_root / str(no) / "records.v2.json")
        nasij = read_json(content_root / "nasij" / f"{no}.json")
        records, sources = validate_shape(nasij, private, no)
        counts, uses, refs = run_checks(nasij, records, quran, no)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print(f"{no} INPUT FAIL checked=1 failed=1: {exc}")
        return False
    for code, (count, failures) in counts.items():
        print(f"{no} {code} {'FAIL' if failures else 'PASS'} checked={count} failed={len(failures)}: {CHECKS[code]}" +
              ("; " + "; ".join(failures) if failures else ""))
    if any(failures for _, failures in counts.values()):
        return False
    try:
        own = sorted((a for a in quran.values() if a["sura_no"] == no), key=lambda a: a["aya_no"])
        require(bool(own), f"unknown surah {no}")
        mapped = {ident: public_record(records[ident], sources, ui, quran) for ident in sorted(uses)}
        ayahs = own + [quran[ref] for ref in sorted(refs, key=lambda k: tuple(map(int, k.split(":")))) if quran[ref]["sura_no"] != no]
        output = {"schema": 1, "fixture": False,
                  "surah": {"no": no, "name": own[0]["sura_name_ar"], "ayah_count": len(own)},
                  "ayahs": [{"key": f"{a['sura_no']}:{a['aya_no']}", "no": a["aya_no"], "text": a["aya_text"]} for a in ayahs],
                  "levels": sorted(nasij["levels"], key=lambda l: l["depth"]), "records": mapped}
        review = review_text(records, sources, uses, no)
    except (ValueError, TypeError, KeyError) as exc:
        print(f"{no} MAP FAIL checked=1 failed=1: {exc}")
        return False
    print(f"{no} MAP PASS checked={len(mapped)} failed=0: {len(ayahs)} ayahs; {len(mapped)} records")
    if not check_only:
        # All checks and mapping finish before either file is written.
        (records_root / str(no) / "review.md").write_text(review, encoding="utf-8")
        write_json(content_root / "export" / f"surah-{no}.json", output)
    return True


def rebuild_index(content_root):
    entries = []
    for path in sorted((content_root / "export").glob("surah-*.json")):
        value = read_json(path)
        require(isinstance(value, dict) and type(value.get("fixture")) is bool, f"{path}: fixture flag missing/invalid")
        if value["fixture"]:
            continue
        surah = value["surah"]
        require(path.name == f"surah-{surah['no']}.json", f"{path}: surah filename mismatch")
        entries.append({k: surah[k] for k in ("no", "name", "ayah_count")})
    write_json(content_root / "export/index.json", {"surahs": sorted(entries, key=lambda s: s["no"])})


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("surahs", nargs="+", type=int)
    parser.add_argument("--check-only", action="store_true", help="validate only; no export, review or index writes")
    parser.add_argument("--records-root", type=Path, default=PROJECT / ".cache/records")
    parser.add_argument("--content-root", type=Path, default=PROJECT / "content")
    args = parser.parse_args(argv)
    try:
        ui = read_json(args.content_root / "ui.ar.json")
        quran = {f"{a['sura_no']}:{a['aya_no']}": a for a in read_json(QURAN)}
        success = True
        for no in dict.fromkeys(args.surahs):
            success = export_surah(no, args.records_root, args.content_root, quran, ui, args.check_only) and success
        if not args.check_only:
            rebuild_index(args.content_root)
        return 0 if success else 1
    except (OSError, ValueError, TypeError, KeyError) as exc:
        # An I/O failure stops the run; never delete existing data to recover.
        print(f"STOP FAIL checked=1 failed=1: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
