#!/usr/bin/env python3
"""Build/update one private, offline SQLite FTS5 index using only the stdlib.

Input files are read only. Completed JSON pages are independent transactions;
corrupt/changing pages are reported and retried next time. Rebuild refreshes all
selected inputs and the FTS index without removing any source or database file.
"""

import argparse
import ast
from contextlib import closing
from dataclasses import dataclass, field
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys

if __package__:
    from . import quran_scan
    from .retrieve import DEFAULT_DB, ROOT, SCHEMA_VERSION, normalize
else:
    import quran_scan
    from retrieve import DEFAULT_DB, ROOT, SCHEMA_VERSION, normalize


# Existing pipeline IDs, with distinct IDs for editions absent from its registry.
SOURCE_IDS = {
    "shamela": {"22912": "sahih_masbur", "23636": "mufradat"},
    "surahpedia": {"2": "ibn_kathir", "13": "falih", "19": "asbab",
                   "20": "fadail", "27": "maqasid", "32": "saadi", "77": "tabari"},
    "quranenc": {"arabic_mokhtasar": "mokhtasar", "arabic_moyassar": "moyassar",
                 "arabic_seraj": "seraj"},
}
_FOOTNOTE = re.compile(r"\s*\u00ac([^\u00a5]*)\u00a5")
_REGISTRY_FILE = Path(".cache/records/108/build_records_v2.py")


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _registry(root):
    """Read the SOURCES expression as data, without importing/executing the pipeline."""
    path = root / _REGISTRY_FILE
    if not path.exists():
        return {}

    def value(node):
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Dict):
            return {value(k): value(v) for k, v in zip(node.keys, node.values)}
        if isinstance(node, ast.Name) and node.id == "MUSHAF":
            return "tools/data/qurancomplex/hafsData_v2-0.json"
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id == "dict" and not node.args:
                return {item.arg: value(item.value) for item in node.keywords}
            if node.func.id in ("_sp", "_qe"):
                return {}  # Disk paths come from discovered files, not executable helpers.
        raise ValueError("Unsupported SOURCES registry expression: " + type(node).__name__)

    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "SOURCES" for target in node.targets
        ):
            return value(node.value)
    raise ValueError("SOURCES not found in " + str(_REGISTRY_FILE))


@dataclass
class Source:
    source_id: str
    platform: str
    platform_id: str
    paths: list
    metadata: dict = field(default_factory=dict)
    notes: set = field(default_factory=set)
    errors: int = 0
    skipped: int = 0
    empty: int = 0
    updated: int = 0


def discover_sources(root):
    registry = _registry(root)
    registered = {(data["platform"], str(data.get("platform_book_id", ""))): (sid, data)
                  for sid, data in registry.items()}
    catalogs = {}
    for path in sorted((root / ".cache/sources/surahpedia").glob("projects*.json")):
        catalog = json.loads(path.read_text(encoding="utf-8"))
        catalogs.update({str(item["id"]): item for item in catalog["data"]})

    def make(platform, platform_id, paths):
        sid, metadata = registered.get((platform, platform_id), (
            SOURCE_IDS.get(platform, {}).get(platform_id, platform + "_" + platform_id), {},
        ))
        source = Source(sid, platform, platform_id, paths, dict(metadata))
        if not metadata:
            source.notes.add("no pipeline registry entry; author unknown unless present in source metadata")
        if platform == "surahpedia":
            source.metadata.setdefault("title", catalogs.get(platform_id, {}).get("title"))
        return source

    sources = []
    for directory in sorted((root / ".cache/sources/shamela/books").glob("[0-9]*")):
        if directory.is_dir():
            paths = sorted((directory / "pages").glob("*.json"), key=lambda p: int(p.stem))
            sources.append(make("shamela", directory.name, paths))
    for path in sorted((root / ".cache/sources/surahpedia").glob("p[0-9]*/*.sqlite")):
        source = make("surahpedia", path.parent.name[1:], [path])
        if not source.metadata.get("title"):
            try:
                with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)) as reader:
                    project = reader.execute("SELECT title FROM projects LIMIT 1").fetchone()
                    if project:
                        source.metadata["title"] = project[0]
            except sqlite3.Error:
                pass  # The normal input transaction reports corrupt databases.
        sources.append(source)
    for path in sorted((root / ".cache/sources/quranenc").glob("*.juz-amma-78-114.json")):
        sources.append(make("quranenc", path.name.split(".")[0], [path]))
    path = root / ".cache/sources/hadeethenc/hadeethenc_ar-v1.7.0.json"
    if path.exists():
        sid, metadata = registered.get(("hadeethenc", ""), ("hadeethenc", {}))
        sources.append(Source(sid, "hadeethenc", "", [path], dict(metadata)))
    return sorted(sources, key=lambda source: source.source_id)


class QuranLinks:
    """Reuse quran_scan's orthography, matching keys, greedy scan and formula guard."""

    def __init__(self):
        raw = quran_scan.DATA.read_bytes()
        self.digest = hashlib.sha256(raw).hexdigest()
        rows = json.loads(raw)
        self.by_id = {int(row["id"]): (int(row["sura_no"]), int(row["aya_no"])) for row in rows}
        words, self.refs, _ = quran_scan.load_quran()
        self.keys = [quran_scan.key(word) for word in words]
        self.index = quran_scan.build_index(self.keys, 3)

    def quoted(self, text):
        words = quran_scan.normalize(text)
        found = set()
        for start, qstart, length in quran_scan.scan(
            [quran_scan.key(word) for word in words], self.keys, self.index, 3,
        ):
            if tuple(words[start:start + length]) not in quran_scan.FORMULAE:
                found.update(f"{surah}:{ayah}" for surah, ayah, _ in self.refs[qstart:qstart + length])
        return found


def check_fts5():
    with closing(sqlite3.connect(":memory:")) as connection:
        try:
            connection.execute("CREATE VIRTUAL TABLE fts_check USING fts5(text)")
        except sqlite3.OperationalError as exc:
            raise RuntimeError("FTS5 is unavailable in this Python sqlite3 build; use an FTS5-enabled Python") from exc


def _schema(connection):
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version not in (0, SCHEMA_VERSION):
        raise ValueError("Unsupported existing index schema")
    connection.executescript("""
        PRAGMA foreign_keys=ON;
        PRAGMA temp_store=MEMORY;
        CREATE TABLE IF NOT EXISTS inputs (
            file TEXT PRIMARY KEY, source_id TEXT NOT NULL, signature TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS passages (
            id INTEGER PRIMARY KEY,
            passage_key TEXT NOT NULL UNIQUE,
            source_id TEXT NOT NULL, source_title TEXT NOT NULL, author TEXT,
            unit_kind TEXT NOT NULL CHECK(unit_kind IN ('page','ayah-entry','hadith')),
            book_id INTEGER, part INTEGER, printed_page INTEGER, page_id INTEGER,
            row_id TEXT NOT NULL, row_order INTEGER NOT NULL,
            section TEXT NOT NULL CHECK(section IN ('body','footnote','field')),
            file TEXT NOT NULL, field TEXT NOT NULL, footnote_no INTEGER,
            prev_page_id INTEGER, next_page_id INTEGER, surah_no INTEGER,
            url TEXT, locator_json TEXT NOT NULL, metadata_json TEXT NOT NULL,
            text TEXT NOT NULL, text_norm TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS passages_source ON passages(source_id, row_order);
        CREATE INDEX IF NOT EXISTS passages_file ON passages(file);
        CREATE INDEX IF NOT EXISTS passages_page ON passages(source_id, book_id, page_id);
        CREATE TABLE IF NOT EXISTS passage_ayahs (
            passage_id INTEGER NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
            ayah_key TEXT NOT NULL,
            link_kind TEXT NOT NULL CHECK(link_kind IN ('native','quoted')),
            PRIMARY KEY(passage_id, ayah_key, link_kind)
        );
        CREATE INDEX IF NOT EXISTS passage_ayahs_lookup ON passage_ayahs(ayah_key, link_kind, passage_id);
        CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(
            text_norm, content='passages', content_rowid='id', tokenize='unicode61'
        );
        CREATE TRIGGER IF NOT EXISTS passages_insert AFTER INSERT ON passages BEGIN
            INSERT INTO passages_fts(rowid, text_norm) VALUES(new.id, new.text_norm);
        END;
        CREATE TRIGGER IF NOT EXISTS passages_delete AFTER DELETE ON passages BEGIN
            INSERT INTO passages_fts(passages_fts, rowid, text_norm) VALUES('delete', old.id, old.text_norm);
        END;
        CREATE TRIGGER IF NOT EXISTS passages_update AFTER UPDATE ON passages BEGIN
            INSERT INTO passages_fts(passages_fts, rowid, text_norm) VALUES('delete', old.id, old.text_norm);
            INSERT INTO passages_fts(rowid, text_norm) VALUES(new.id, new.text_norm);
        END;
    """)
    connection.execute(f"PRAGMA user_version={SCHEMA_VERSION}")


def _stat(path):
    stat = path.stat()
    return stat.st_mtime_ns, stat.st_size


def _read_json(path):
    before = _stat(path)
    content = json.loads(path.read_bytes())
    if _stat(path) != before:
        raise ValueError("file changed during read; retry on next build")
    return content


def _locator(file, row, field_name, *, table=None, key="id", part="field", footnote_no=None):
    return dict(file=file, table=table, key_column=key, row_id=row, field=field_name,
                part=part, footnote_no=footnote_no)


def _passage(source, file, row, field_name, text, *, unit_kind, row_order=None,
             section="field", table=None, key="id", native=None, footnote_no=None,
             book_id=None, part=None, printed_page=None, page_id=None,
             prev_page_id=None, next_page_id=None, surah_no=None, url=None, metadata=None):
    if not isinstance(text, str):
        raise ValueError("non-string source text")
    locator = _locator(file, row, field_name, table=table, key=key,
                       part="footnote" if footnote_no is not None else "field",
                       footnote_no=footnote_no)
    return dict(
        passage_key=_json([source.source_id, file, row, field_name, footnote_no]),
        source_id=source.source_id, source_title=source.metadata.get("title") or source.source_id,
        author=source.metadata.get("author"), unit_kind=unit_kind,
        book_id=book_id, part=part, printed_page=printed_page, page_id=page_id,
        row_id=str(row), row_order=int(row if row_order is None else row_order),
        section=section, file=file, field=field_name, footnote_no=footnote_no,
        prev_page_id=prev_page_id, next_page_id=next_page_id,
        surah_no=surah_no, url=url, locator_json=_json(locator),
        metadata_json=_json(metadata or {}), text=text, text_norm=normalize(text),
        native=native,
    )


def _shamela_metadata(source):
    if not source.paths:
        return
    # First-page metadata is optional; an interrupted first page cannot stop later pages.
    try:
        first = _read_json(source.paths[0])
    except (OSError, ValueError):
        return
    citation = first.get("citation", {}).get("markdown", "")
    title = re.match(r"\[([^\]]+)\]", citation)
    if title:
        source.metadata.setdefault("title", title[1])
    author = re.search(r"^\u0627\u0644\u0645\u0624\u0644\u0641:\s*(.+)$", first.get("text", ""), re.M)
    if author:
        source.metadata.setdefault("author", author[1])
    state_path = source.paths[0].parents[1] / "state.json"
    try:
        state = _read_json(state_path)
        if not state.get("finished"):
            source.notes.add("book still fetching; only saved page snapshots indexed")
    except (OSError, ValueError):
        source.notes.add("completion state unavailable; only saved page snapshots indexed")


def _shamela(source, path, file):
    page = _read_json(path)
    if not isinstance(page, dict) or page.get("book_id") != int(source.platform_id):
        raise ValueError("wrong or missing book identity")
    if type(page.get("page_id")) is not int or page["page_id"] != int(path.stem):
        raise ValueError("wrong or missing page identity")
    if any(key not in page for key in ("part", "page_number", "text", "footnotes", "prev_id", "next_id")):
        raise ValueError("incomplete page fields")
    for key in ("part", "page_number", "prev_id", "next_id"):
        if page[key] is not None and (type(page[key]) is not int or page[key] < 1):
            raise ValueError("invalid numeric page locator: " + key)
    if not isinstance(page.get("citation", {}), dict):
        raise ValueError("invalid page citation")
    citation = page.get("citation", {}).get("markdown", "")
    link = re.search(r"\]\((https?://[^)]+)\)", citation)
    for field_name, section in (("text", "body"), ("footnotes", "footnote")):
        yield _passage(
            source, file, page["page_id"], field_name, page[field_name], unit_kind="page",
            key="page_id", section=section, book_id=page["book_id"], page_id=page["page_id"],
            part=page["part"], printed_page=page["page_number"],
            prev_page_id=page["prev_id"], next_page_id=page["next_id"],
            url=link[1] if link else None,
        )


def _surahpedia(source, path, file, quran):
    # These downloaded databases are snapshots. Immutable read-only mode avoids
    # source locks, journals and sidecar writes.
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro&immutable=1", uri=True)) as reader:
        reader.row_factory = sqlite3.Row
        project = reader.execute("SELECT title FROM projects LIMIT 1").fetchone()
        if project and not source.metadata.get("title"):
            source.metadata["title"] = project["title"]
        for row in reader.execute("SELECT * FROM project_contents ORDER BY id"):
            if row["content"] is None:
                source.empty += 1
                continue
            native, surah = None, row["sura_id"]
            if row["aya_id"] is not None:
                # aya_id is a global Quran row ID, not a local ayah number.
                surah, ayah = quran.by_id[int(row["aya_id"])]
                if row["sura_id"] is not None and surah != row["sura_id"]:
                    raise ValueError("aya_id/sura_id disagree at row " + str(row["id"]))
                native = f"{surah}:{ayah}"
            kind = "page" if row["content_type"] == "page" else "ayah-entry"
            if row["content_type"] == "sura":
                source.notes.add("whole-surah rows: surah context retained; no invented native ayah links")
            metadata = {key: row[key] for key in ("content_type", "content_id", "word_id", "aya_id")}
            metadata["project_id"] = int(source.platform_id)
            common = dict(unit_kind=kind, table="project_contents", native=native,
                          surah_no=surah, metadata=metadata)
            # Keep the complete field byte-for-byte, including inline note markers.
            # A body made by removing markers would no longer be verbatim.
            yield _passage(source, file, row["id"], "content", row["content"], **common)
            notes = list(_FOOTNOTE.finditer(row["content"]))
            if notes:
                source.notes.add("inline footnotes: full raw fields plus exact note substrings (zero-based footnote_no)")
            for number, note in enumerate(notes):
                yield _passage(source, file, row["id"], "content", note[1],
                               section="footnote", footnote_no=number, **common)


def _json_rows(source, path, file):
    rows = _read_json(path)
    if not isinstance(rows, list):
        raise ValueError("expected a JSON row list")
    seen = set()
    for order, row in enumerate(rows):
        row_id = row["id"]
        if str(row_id) in seen:
            raise ValueError("duplicate row id " + str(row_id))
        seen.add(str(row_id))
        if source.platform == "quranenc":
            surah, ayah = int(row["sura"]), int(row["aya"])
            for field_name in ("translation", "footnotes"):
                yield _passage(source, file, row_id, field_name, row[field_name],
                               unit_kind="ayah-entry", section="body" if field_name == "translation" else "footnote",
                               native=f"{surah}:{ayah}", surah_no=surah)
        else:
            metadata = {key: row.get(key) for key in ("title", "grade", "takhrij")}
            for field_name in ("hadith_text", "explanation", "word_meanings", "benefits", "grade", "takhrij", "title"):
                text = row.get(field_name)
                if text is None or text == "None":
                    source.empty += 1
                    continue
                yield _passage(source, file, row_id, field_name, text, unit_kind="hadith",
                               row_order=order, section="body" if field_name == "hadith_text" else "field",
                               url=row.get("link"), metadata=metadata)


def _save_passage(connection, passage, quran):
    native = passage.pop("native")
    columns = list(passage)
    names = ",".join(columns)
    updates = ",".join(f"{name}=excluded.{name}" for name in columns if name != "passage_key")
    connection.execute(
        f"INSERT INTO passages ({names}) VALUES ({','.join('?' for _ in columns)}) "
        f"ON CONFLICT(passage_key) DO UPDATE SET {updates}", list(passage.values()),
    )
    passage_id = connection.execute("SELECT id FROM passages WHERE passage_key=?", (passage["passage_key"],)).fetchone()[0]
    connection.execute("DELETE FROM passage_ayahs WHERE passage_id=?", (passage_id,))
    links = [(passage_id, ayah, "quoted") for ayah in sorted(quran.quoted(passage["text"]))]
    if native:
        links.append((passage_id, native, "native"))
    connection.executemany("INSERT INTO passage_ayahs VALUES (?,?,?)", links)
    return passage_id


def build_index(*, db=DEFAULT_DB, sources=None, rebuild=False, root=ROOT):
    """Return per-source summaries; input errors are recoverable and are not cached."""
    check_fts5()
    root, db = Path(root).resolve(), Path(db).resolve()
    # Never accidentally put raw text in a tracked project directory or source tree.
    if db.is_relative_to(ROOT) and not db.is_relative_to(ROOT / ".cache/index"):
        raise ValueError("a database inside the project must be under .cache/index/")
    for protected in (root / ".cache/sources", root / ".cache/records"):
        if db.is_relative_to(protected):
            raise ValueError("database cannot be inside sources or records")
    available = discover_sources(root)
    requested = {item for group in (sources or []) for item in group.split(",") if item}
    aliases = lambda source: {source.source_id, source.platform, source.platform_id,
                              "p" + source.platform_id if source.platform == "surahpedia" else ""}
    unknown = requested - set().union(*(aliases(source) for source in available))
    if unknown:
        raise ValueError("unknown/unavailable sources: " + ", ".join(sorted(unknown)))
    selected = [source for source in available if not requested or requested & aliases(source)]
    quran = QuranLinks()
    db.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not db.exists():
        descriptor = os.open(db, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
    summaries = []
    with closing(sqlite3.connect(db)) as connection:
        _schema(connection)
        for source in selected:
            if source.platform == "shamela":
                _shamela_metadata(source)
            for path in source.paths:
                file = path.relative_to(root).as_posix()
                try:
                    before = _stat(path)
                    signature = _json([before, quran.digest, source.metadata, SCHEMA_VERSION])
                    cached = connection.execute("SELECT signature FROM inputs WHERE file=?", (file,)).fetchone()
                    if not rebuild and cached and cached[0] == signature:
                        source.skipped += 1
                        continue
                    connection.execute("SAVEPOINT input_file")
                    if source.platform == "shamela":
                        passages = _shamela(source, path, file)
                    elif source.platform == "surahpedia":
                        passages = _surahpedia(source, path, file, quran)
                    else:
                        passages = _json_rows(source, path, file)
                    kept = set()
                    for passage in passages:
                        if not passage["text"].strip():
                            source.empty += 1
                            continue
                        kept.add(_save_passage(connection, passage, quran))
                    if _stat(path) != before:
                        raise ValueError("file changed during indexing; retry on next build")
                    stale = [(row[0],) for row in connection.execute("SELECT id FROM passages WHERE file=?", (file,))
                             if row[0] not in kept]
                    connection.executemany("DELETE FROM passages WHERE id=?", stale)
                    # Metadata may have been learned from a database's projects table.
                    signature = _json([before, quran.digest, source.metadata, SCHEMA_VERSION])
                    connection.execute("INSERT INTO inputs VALUES (?,?,?) ON CONFLICT(file) DO UPDATE SET "
                                       "source_id=excluded.source_id,signature=excluded.signature",
                                       (file, source.source_id, signature))
                    connection.execute("RELEASE input_file")
                    connection.commit()
                    source.updated += 1
                except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as exc:
                    connection.rollback()
                    source.errors += 1
                    # Error details never echo malformed text or raw SQLite values.
                    reason = str(exc) if isinstance(exc, (ValueError, OSError, sqlite3.Error)) else type(exc).__name__
                    print(f"Input error: {file}: {reason}", file=sys.stderr)
            count = connection.execute("SELECT count(*) FROM passages WHERE source_id=?", (source.source_id,)).fetchone()[0]
            links = connection.execute("SELECT count(*) FROM passage_ayahs a JOIN passages p ON p.id=a.passage_id "
                                       "WHERE p.source_id=?", (source.source_id,)).fetchone()[0]
            summaries.append(dict(source_id=source.source_id, passages=count, ayah_links=links,
                                  skipped=source.skipped, errors=source.errors, updated=source.updated,
                                  empty=source.empty, notes=sorted(source.notes)))
        if rebuild:
            connection.execute("INSERT INTO passages_fts(passages_fts) VALUES('rebuild')")
        connection.commit()
    return summaries


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", nargs="+", help="source IDs, platforms, book IDs or pN; comma/space separated")
    parser.add_argument("--rebuild", action="store_true", help="refresh every selected input and rebuild FTS; preserve database file")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args(argv)
    try:
        summaries = build_index(db=args.db, sources=args.sources, rebuild=args.rebuild)
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as exc:
        print(f"Build failed: {exc}", file=sys.stderr)
        return 1
    print("source_id\tpassages\tayah_links\tskipped\terrors\tupdated\tempty")
    for summary in summaries:
        print("\t".join(str(summary[key]) for key in (
            "source_id", "passages", "ayah_links", "skipped", "errors", "updated", "empty",
        )), flush=True)
        for note in summary["notes"]:
            print(f"Note [{summary['source_id']}]: {note}", file=sys.stderr)
    print("skipped = unchanged input files; empty = absent/empty fields or rows in processed inputs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
