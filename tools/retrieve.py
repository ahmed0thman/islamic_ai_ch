#!/usr/bin/env python3
"""Offline retrieval from the private index; every text and snippet is verbatim.

The public functions return JSON-compatible dictionaries. ``locator`` can be
copied directly to a record's passage_ref. Text searches are literal FTS phrases;
near_ayah restricts them to the ayah's surah and puts exact ayah links first.
"""

import argparse
from contextlib import closing
from functools import lru_cache
import json
from pathlib import Path
import re
import sqlite3
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / ".cache/index/sources.sqlite"
SCHEMA_VERSION = 2
_MARKS = re.compile(
    r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed"
    r"\u0898-\u089f\u08ca-\u08ff\u0640\ufeff]"
)
_FOLD = str.maketrans({
    "\u0622": "\u0627", "\u0623": "\u0627", "\u0625": "\u0627",
    "\u0671": "\u0627", "\u0624": "\u0648", "\u0626": "\u064a",
    "\u0621": "", "\u0649": "\u064a", "\u0629": "\u0647",
})


def normalize(text, *, with_offsets=False):
    """One search normalization, optionally mapping characters to original offsets.

    The offset map is used only for cutting snippets out of the original text.
    It never becomes the returned source text.
    """
    if not with_offsets:
        return " ".join(_MARKS.sub("", text).translate(_FOLD).split())
    chars, offsets = [], []
    for position, char in enumerate(text):
        if _MARKS.fullmatch(char):
            continue
        for folded in char.translate(_FOLD):
            if folded.isspace():
                if chars and chars[-1] != " ":
                    chars.append(" ")
                    offsets.append(position)
            else:
                chars.append(folded)
                offsets.append(position)
    if chars and chars[-1] == " ":
        chars.pop()
        offsets.pop()
    return "".join(chars), offsets


def validate_ayah(ayah):
    match = re.fullmatch(r"([1-9][0-9]*):([1-9][0-9]*)", ayah)
    if not match or not 1 <= int(match[1]) <= 114:
        raise ValueError("ayah must have the form surah:ayah (surah 1-114)")
    return int(match[1])


def _open(db):
    path = Path(db).resolve()
    if not path.is_file():
        raise FileNotFoundError("Index not found; run python3 -B tools/build_index.py")
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    if connection.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
        connection.close()
        raise ValueError("Unsupported index schema; rebuild with the current builder")
    return connection


@lru_cache(maxsize=1)
def _ayah_terms():
    path = ROOT / "tools/data/qurancomplex/hafsData_v2-0.json"
    return {f"{row['sura_no']}:{row['aya_no']}": re.findall(r"\w+", normalize(row["aya_text_emlaey"]))
            for row in json.loads(path.read_text(encoding="utf-8"))}


def _snippet(text, terms=(), width=240, *, allow_partial=False):
    start = 0
    if terms:
        normalized, offsets = normalize(text, with_offsets=True)
        pattern = r"[^\w]+".join(re.escape(term) for term in terms)
        hit = re.search(r"(?<!\w)" + pattern + r"(?!\w)", normalized, re.I)
        if not hit and allow_partial:
            # Quotation links also include partial ayahs of three or more words.
            for position in range(len(terms) - 2):
                pattern = r"[^\w]+".join(re.escape(term) for term in terms[position:position + 3])
                hit = re.search(r"(?<!\w)" + pattern + r"(?!\w)", normalized, re.I)
                if hit:
                    break
        if not hit:
            hit = re.search(r"(?<!\w)" + re.escape(terms[0]) + r"(?!\w)", normalized, re.I)
        if hit:
            start = max(0, offsets[hit.start()] - width // 3)
            end = max(start + width, offsets[hit.end() - 1] + 1)
            while end < len(text) and _MARKS.fullmatch(text[end]):
                end += 1
            return text[start:end], start, min(end, len(text))
    return text[start:start + width], start, min(start + width, len(text))


@lru_cache(maxsize=1)
def build_sources():
    if __package__:
        from .build_index import _registry
    else:
        from build_index import _registry
    return set(_registry(ROOT))


def source_filter(where, parameters, only):
    if only:
        ids = sorted(build_sources())
        where += ' AND p.source_id IN (' + ','.join('?' for _ in ids) + ')'
        parameters.extend(ids)
    return where


def word_forms(word):
    article = '\u0627\u0644'
    prefixes = ('', '\u0648', '\u0641', '\u0628', '\u0643', '\u0644', '\u0648\u0628', '\u0641\u0628', '\u0648\u0644', '\u0641\u0644')
    bases = {word}
    for prefix in prefixes:
        for lead in (prefix, prefix + article):
            if lead and word.startswith(lead) and len(word) - len(lead) >= 2:
                bases.add(word[len(lead):])
        if prefix.endswith('\u0644') and word.startswith(prefix + '\u0644'):
            bases.add(word[len(prefix) + 1:])
    return sorted({p + a + base for base in bases if base for p in prefixes for a in ('', article)} |
                  {p + '\u0644' + base for base in bases for p in prefixes if p.endswith('\u0644')})


def _result(connection, row, terms=(), *, allow_partial=False):
    links = [dict(link) for link in connection.execute(
        "SELECT ayah_key, link_kind FROM passage_ayahs_v2 WHERE passage_id=? "
        "ORDER BY CASE link_kind WHEN 'native' THEN 0 WHEN 'cited' THEN 1 WHEN 'quoted' THEN 2 ELSE 3 END, ayah_key",
        (row["id"],),
    )]
    snippet, start, end = _snippet(row["text"], terms, allow_partial=allow_partial)
    result = {
        "id": row["id"], "source_id": row["source_id"],
        "build_source": row["source_id"] in build_sources(),
        "source_title": row["source_title"], "author": row["author"],
        "unit_kind": row["unit_kind"], "section": row["section"],
        "locator": json.loads(row["locator_json"]),
        "location": {key: row[key] for key in (
            "book_id", "part", "printed_page", "page_id", "row_id", "surah_no",
        )},
        "url": row["url"], "text": row["text"], "snippet": snippet,
        "snippet_start": start, "snippet_end": end, "ayah_links": links,
        "metadata": json.loads(row["metadata_json"]),
    }
    for key in ("link_kind", "bm25", "near_priority"):
        if key in row.keys():
            result[key] = row[key]
    return result


def _bounds(limit, offset):
    if not isinstance(limit, int) or limit < 1 or not isinstance(offset, int) or offset < 0:
        raise ValueError("limit must be positive and offset nonnegative")


def search_ayah(ayah, *, source=None, limit=10, offset=0, db=DEFAULT_DB, build_sources_only=False):
    """Return linked passages, native links first, plus the full match count."""
    validate_ayah(ayah)
    _bounds(limit, offset)
    terms = _ayah_terms().get(ayah, ())
    where = "a.ayah_key=?"
    parameters = [ayah]
    if source:
        where += " AND p.source_id=?"
        parameters.append(source)
    where = source_filter(where, parameters, build_sources_only)
    with closing(_open(db)) as connection:
        # A passage can have both native and quoted links to the same ayah.
        joins = "FROM passages p JOIN passage_ayahs_v2 a ON a.passage_id=p.id WHERE " + where
        total = connection.execute("SELECT count(DISTINCT p.id) " + joins, parameters).fetchone()[0]
        rank = "CASE WHEN max(a.link_kind='surah') THEN 3 ELSE min(CASE a.link_kind WHEN 'native' THEN 0 WHEN 'cited' THEN 1 WHEN 'quoted' THEN 2 ELSE 3 END) END"
        rows = connection.execute(
            "SELECT p.*, CASE (" + rank + ") "
            "WHEN 0 THEN 'native' WHEN 1 THEN 'cited' WHEN 2 THEN 'quoted' ELSE 'surah' END AS link_kind " + joins +
            " GROUP BY p.id ORDER BY " + rank + ", p.source_id, p.row_order, p.id LIMIT ? OFFSET ?",
            parameters + [limit, offset],
        ).fetchall()
        return {"query": {"ayah": ayah, "source": source}, "total": total,
                "returned": len(rows),
                "results": [_result(connection, row, terms, allow_partial=True) for row in rows]}


def search_text(text, *, source=None, near_ayah=None, limit=10, offset=0, db=DEFAULT_DB, build_sources_only=False):
    """Search a normalized literal phrase by bm25, optionally within one surah."""
    _bounds(limit, offset)
    terms = re.findall(r"\w+", normalize(text))
    if not terms:
        raise ValueError("text query must contain at least one word")
    forms = [word_forms(term) for term in terms]
    phrase = ' AND '.join('(' + ' OR '.join('"' + form + '"' for form in group) + ')' for group in forms)
    where = "passages_fts MATCH ?"
    parameters = [phrase]
    priority = "0"
    priority_parameters = []
    if source:
        where += " AND p.source_id=?"
        parameters.append(source)
    if near_ayah:
        surah = validate_ayah(near_ayah)
        where += (
            " AND (p.surah_no=? OR EXISTS (SELECT 1 FROM passage_ayahs_v2 n "
            "WHERE n.passage_id=p.id AND n.ayah_key LIKE ?))"
        )
        parameters += [surah, str(surah) + ":%"]
        priority = ("CASE WHEN EXISTS (SELECT 1 FROM passage_ayahs_v2 n "
                    "WHERE n.passage_id=p.id AND n.ayah_key=?) THEN 0 ELSE 1 END")
        priority_parameters = [near_ayah]
    where = source_filter(where, parameters, build_sources_only)
    with closing(_open(db)) as connection:
        if len(forms) > 1:
            pattern = re.compile(r'(?<!\w)' + r'[^\w]+'.join(
                '(?:' + '|'.join(map(re.escape, group)) + ')' for group in forms) + r'(?!\w)')
            connection.create_function('phrase_match', 1, lambda value: bool(pattern.search(value)))
            where += ' AND phrase_match(p.text_norm)'
        joins = "FROM passages_fts JOIN passages p ON p.id=passages_fts.rowid WHERE " + where
        total = connection.execute("SELECT count(*) " + joins, parameters).fetchone()[0]
        rows = connection.execute(
            "SELECT p.*, bm25(passages_fts) AS bm25, " + priority + " AS near_priority " +
            joins + " ORDER BY near_priority, bm25, p.id LIMIT ? OFFSET ?",
            priority_parameters + parameters + [limit, offset],
        ).fetchall()
        return {"query": {"text": text, "source": source, "near_ayah": near_ayah},
                "total": total, "returned": len(rows),
                "results": [_result(connection, row, terms) for row in rows]}


def get_passage(passage_id, *, db=DEFAULT_DB):
    """Return one passage and both available adjacent page bodies/footnotes.

    Shamela navigation IDs take precedence over numeric order: missing pages
    never cause a jump across a gap. Other units use adjacent source rows.
    """
    with closing(_open(db)) as connection:
        row = connection.execute("SELECT * FROM passages WHERE id=?", (passage_id,)).fetchone()
        if row is None:
            return {"passage": None, "neighbours": {"previous": [], "next": []}}
        neighbours = {}
        for direction, operator, order in (("previous", "<", "DESC"), ("next", ">", "ASC")):
            if row["book_id"] is not None:
                page = row["prev_page_id" if direction == "previous" else "next_page_id"]
                adjacent = connection.execute(
                    "SELECT * FROM passages WHERE source_id=? AND book_id=? AND page_id=? "
                    "ORDER BY CASE section WHEN 'body' THEN 0 ELSE 1 END, id",
                    (row["source_id"], row["book_id"], page),
                ).fetchall() if page is not None else []
            else:
                next_order = connection.execute(
                    "SELECT row_order FROM passages WHERE source_id=? AND row_order " + operator +
                    " ? ORDER BY row_order " + order + " LIMIT 1",
                    (row["source_id"], row["row_order"]),
                ).fetchone()
                adjacent = connection.execute(
                    "SELECT * FROM passages WHERE source_id=? AND row_order=? ORDER BY id",
                    (row["source_id"], next_order[0]),
                ).fetchall() if next_order else []
            neighbours[direction] = [_result(connection, item) for item in adjacent]
        return {"passage": _result(connection, row), "neighbours": neighbours}


def _markdown(output):
    if "results" in output:
        lines = [f"Returned {output['returned']} of {output['total']} passages."]
        entries = [("Passage", entry) for entry in output["results"]]
    else:
        lines = []
        entries = [("Passage", output["passage"])] if output["passage"] else []
        for direction, neighbours in output["neighbours"].items():
            entries += [(direction.title(), entry) for entry in neighbours]
    for label, entry in entries:
        lines += ["", f"## {label} {entry['id']} ({entry['source_id']}; {entry.get('link_kind', 'context')})", "",
                  json.dumps(entry["locator"], ensure_ascii=False), "",
                  "Snippet:", entry["snippet"], "", "Text:", entry["text"]]
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--ayah")
    mode.add_argument("--text")
    mode.add_argument("--id", type=int)
    parser.add_argument("--build-sources-only", action="store_true")
    parser.add_argument("--source", help="exact source_id from the build summary")
    parser.add_argument("--near-ayah", help="text search: restrict to this surah, exact ayah first")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--format", choices=("json", "md"), default="json")
    args = parser.parse_args(argv)
    if args.near_ayah and args.text is None:
        parser.error("--near-ayah requires --text")
    if args.source and args.id is not None:
        parser.error("--source is available for --ayah or --text")
    try:
        if args.ayah:
            output = search_ayah(args.ayah, source=args.source, limit=args.limit,
                                 offset=args.offset, db=args.db, build_sources_only=args.build_sources_only)
        elif args.text is not None:
            output = search_text(args.text, source=args.source, near_ayah=args.near_ayah,
                                 limit=args.limit, offset=args.offset, db=args.db, build_sources_only=args.build_sources_only)
        else:
            output = get_passage(args.id, db=args.db)
            if args.build_sources_only:
                if output['passage'] and not output['passage']['build_source']:
                    output['passage'] = None
                output['neighbours'] = {k: [e for e in v if e['build_source']] for k, v in output['neighbours'].items()}
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(f"Retrieval failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(output, ensure_ascii=False, indent=2) if args.format == "json"
          else _markdown(output), end="\n" if args.format == "json" else "")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
