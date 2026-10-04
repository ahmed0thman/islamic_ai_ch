#!/usr/bin/env python3
"""Offline synthetic fixtures; all Arabic text is loaded from the Quran at runtime.

Run: python3 -B tools/test_retrieve.py
Temporary source trees are test-owned; real sources and records are never written.
"""

from contextlib import closing, redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

if __package__:
    from . import build_index, quran_scan, retrieve
else:
    import build_index
    import quran_scan
    import retrieve


class RetrievalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.quran = json.loads(quran_scan.DATA.read_text(encoding="utf-8"))
        cls.ayah1 = next(row for row in cls.quran if row["sura_no"] == 108 and row["aya_no"] == 1)
        cls.ayah3 = next(row for row in cls.quran if row["sura_no"] == 108 and row["aya_no"] == 3)
        cls.other = next(row for row in cls.quran if row["sura_no"] == 2 and row["aya_no"] == 1)
        cls.word = cls.ayah1["aya_text_emlaey"].split()[-1]
        cls.filler = cls.quran[0]["aya_text_emlaey"].split()[0]

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="huda-index-test-"))
        self.db = self.root / "index/sources.sqlite"
        self.pages = self.root / ".cache/sources/shamela/books/22912/pages"
        self.write_page(1, " ".join([self.word] * 5), previous=None, following=2)
        self.write_page(2, self.word + " " + " ".join([self.filler] * 100), previous=1, following=3)
        self.write_page(3, self.ayah3["aya_text_emlaey"], previous=2, following=4,
                        footnotes=self.filler)
        # Both a torn file and valid JSON missing required page fields are expected errors.
        (self.pages / "4.json").write_text('{"book_id":', encoding="utf-8")
        self.write_json(self.pages / "5.json", {"book_id": 22912, "page_id": 5})
        (self.pages / "6.json.partial.tmp").write_text("{", encoding="utf-8")
        self.write_json(self.pages.parent / "state.json", {"finished": False})
        self.raw = "  " + self.word + "\n\u00ac " + self.filler + " \u00a5\n" + self.word
        self.make_project(32, [
            (1, "aya", self.raw, 108, self.ayah1["id"]),
            (2, "aya", self.word, 108, self.ayah3["id"]),
            (3, "aya", self.word, 2, self.other["id"]),
            (4, "aya", None, 108, self.ayah3["id"]),
        ])
        self.make_project(27, [(1, "sura", self.word, 108, None)])
        self.qe_file = self.root / ".cache/sources/quranenc/arabic_mokhtasar.juz-amma-78-114.json"
        self.write_json(self.qe_file, [dict(id=self.ayah1["id"], sura=108, aya=1,
                                          translation=self.word, footnotes="")])
        self.he_file = self.root / ".cache/sources/hadeethenc/hadeethenc_ar-v1.7.0.json"
        self.write_json(self.he_file, [dict(id="10", title=self.filler, hadith_text=self.word,
                                          explanation=self.filler, word_meanings="None", benefits="",
                                          grade=self.filler, takhrij=self.word,
                                          link="https://example.invalid/hadith/10")])
        summary, errors = self.build()
        self.assertEqual(sum(item["errors"] for item in summary), 2)
        self.assertIn("4.json", errors)
        self.assertIn("5.json", errors)

    @staticmethod
    def write_json(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")

    def write_page(self, page_id, text, *, previous=None, following=None, footnotes=""):
        self.write_json(self.pages / f"{page_id}.json", dict(
            book_id=22912, page_id=page_id, part=1, page_number=page_id + 10,
            text=text, footnotes=footnotes, citation={"markdown":
                f"[{self.filler}](https://example.invalid/book/22912/{page_id})"},
            prev_id=previous, next_id=following,
        ))

    def make_project(self, project_id, rows):
        path = self.root / f".cache/sources/surahpedia/p{project_id}/project-{project_id}.sqlite"
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(path)) as connection:
            connection.executescript("""
                CREATE TABLE projects(id INTEGER PRIMARY KEY, title TEXT);
                CREATE TABLE project_contents(
                    id INTEGER PRIMARY KEY, content_type TEXT, content TEXT,
                    sura_id INTEGER, aya_id INTEGER, content_id INTEGER, word_id INTEGER
                );
            """)
            connection.execute("INSERT INTO projects VALUES (?,?)", (project_id, self.filler))
            connection.executemany("INSERT INTO project_contents VALUES (?,?,?,?,?,?,?)",
                                   [(rid, kind, text, surah, ayah, rid, None)
                                    for rid, kind, text, surah, ayah in rows])
            connection.commit()

    def build(self, **options):
        errors = io.StringIO()
        with redirect_stderr(errors):
            summary = build_index.build_index(db=self.db, root=self.root, **options)
        return summary, errors.getvalue()

    def all_rows(self):
        with closing(sqlite3.connect(self.db)) as connection:
            return connection.execute("SELECT id,locator_json,text,text_norm FROM passages ORDER BY id").fetchall()

    def test_cited_forms_and_digits(self):
        name = self.ayah1['sura_name_ar']
        digits = ('1', '\u0661')
        for separator in (':', '/'):
            for digit in digits:
                self.write_page(7, f'[{name}{separator} {digit}]')
                self.build(sources=['shamela'])
                output = retrieve.search_ayah('108:1', source='sahih_masbur', db=self.db)
                self.assertEqual(output['results'][0]['link_kind'], 'cited')

    def test_short_quotes_and_basmala_guard(self):
        links = build_index.QuranLinks()
        short = self.ayah1['aya_text_emlaey']
        self.assertNotIn('108:1', links.quoted(short))
        self.assertNotIn('108:1', links.quoted(short, 93))
        self.assertIn('108:1', links.quoted(short, 107))
        self.assertIn('108:1', links.quoted(short, 108))
        basmala = self.quran[0]['aya_text_emlaey']
        self.assertNotIn('1:1', links.quoted(basmala, 108))
        self.assertIn('1:1', links.quoted(basmala, 1))
        partial = ' '.join(short.split()[:2])
        self.assertNotIn('108:1', links.quoted(partial, 108))

    def test_locators_and_build_sources(self):
        full = retrieve.search_ayah('108:1', source='saadi', db=self.db)['results'][0]
        self.assertEqual(full['locator']['part'], 'body')
        for sid, key in build_index.SOURCE_IDS['quranenc'].items():
            source = build_index.Source(key, 'quranenc', sid, [])
            passage = build_index._passage(source, 'download.json', 1, 'translation', self.word,
                                           unit_kind='ayah-entry')
            locator = json.loads(passage['locator_json'])
            self.assertEqual(locator['table'], 'translations')
            self.assertEqual(locator['file'], f'.cache/sources/quranenc/{sid}/{sid}.sqlite')
        self.make_project(999, [(1, 'aya', self.word, 108, self.ayah1['id'])])
        self.build()
        output = retrieve.search_text(self.word, limit=100, db=self.db)
        self.assertTrue(any(not entry['build_source'] for entry in output['results']))
        filtered = retrieve.search_text(self.word, limit=100, db=self.db, build_sources_only=True)
        self.assertTrue(all(entry['build_source'] for entry in filtered['results']))
        ayahs = retrieve.search_ayah('108:1', limit=100, db=self.db, build_sources_only=True)
        self.assertNotIn('surahpedia_999', [entry['source_id'] for entry in ayahs['results']])

    def test_article_and_prefix_forms(self):
        article = '\u0627\u0644'
        bare = retrieve.normalize(self.word)
        if bare.startswith(article):
            bare = bare[2:]
        self.write_page(7, '\u0648' + article + bare)
        self.build(sources=['shamela'])
        for query in (bare, article + bare, '\u0628' + article + bare):
            output = retrieve.search_text(query, source='sahih_masbur', db=self.db)
            self.assertIn(7, [entry['location']['page_id'] for entry in output['results']])

    def test_surah_rows_stay_after_ayah_results_even_with_quotes(self):
        path = self.root / '.cache/sources/surahpedia/p27/project-27.sqlite'
        with closing(sqlite3.connect(path)) as connection:
            connection.execute('UPDATE project_contents SET content=? WHERE id=1',
                               (self.ayah3['aya_text_emlaey'],))
            connection.commit()
        self.build(sources=['maqasid'])
        results = retrieve.search_ayah('108:3', limit=100, db=self.db)['results']
        self.assertEqual(results[-1]['link_kind'], 'surah')
        self.assertEqual(results[-1]['source_id'], 'maqasid')

    def test_multiword_search_preserves_phrase_order(self):
        tokens = self.ayah3['aya_text_emlaey'].split()
        self.write_page(7, ' '.join(tokens[::-1]))
        self.build(sources=['shamela'])
        output = retrieve.search_text(' '.join(tokens), source='sahih_masbur', db=self.db)
        pages = [entry['location']['page_id'] for entry in output['results']]
        self.assertIn(3, pages)
        self.assertNotIn(7, pages)

    def test_normalization_equivalences(self):
        corpus = " ".join(row["aya_text"] + " " + row["aya_text_emlaey"] for row in self.quran)
        for original, replacement in (
            ("\u0622", "\u0627"), ("\u0623", "\u0627"), ("\u0625", "\u0627"),
            ("\u0671", "\u0627"), ("\u0649", "\u064a"), ("\u0629", "\u0647"),
            ("\u0624", "\u0648"), ("\u0626", "\u064a"), ("\u0621", ""),
        ):
            word = next(word for word in corpus.split() if original in word)
            self.assertEqual(retrieve.normalize(word), retrieve.normalize(word.replace(original, replacement)))
        text = " \n" + self.ayah1["aya_text"] + "\u0640\u06dd\u08f0  \t"
        self.assertEqual(retrieve.normalize(text), retrieve.normalize(self.ayah1["aya_text"]))
        normalized, offsets = retrieve.normalize(text, with_offsets=True)
        self.assertEqual(normalized, retrieve.normalize(text))
        self.assertEqual(len(normalized), len(offsets))

    def test_ayah_native_and_quoted_global_ids(self):
        output = retrieve.search_ayah("108:1", limit=100, db=self.db)
        self.assertGreater(output["total"], 0)
        kinds = [entry["link_kind"] for entry in output["results"]]
        self.assertEqual(kinds, sorted(kinds, key=lambda kind: kind != "native"))
        native = retrieve.search_ayah("108:1", source="saadi", db=self.db)
        self.assertEqual(native["total"], 2)  # Raw row and its exact note substring.
        self.assertTrue(all(entry["link_kind"] == "native" for entry in native["results"]))
        quoted = retrieve.search_ayah("108:3", source="sahih_masbur", db=self.db)
        self.assertEqual(quoted["total"], 1)
        self.assertEqual(quoted["results"][0]["location"]["page_id"], 3)
        self.assertEqual(retrieve.search_ayah("108:3", source="saadi", db=self.db)["total"], 1)

    def test_fts_bm25_ranking_and_literal_queries(self):
        output = retrieve.search_text(self.word, source="sahih_masbur", db=self.db)
        pages = [entry["location"]["page_id"] for entry in output["results"]]
        self.assertLess(pages.index(1), pages.index(2))
        scores = [entry["bm25"] for entry in output["results"]]
        self.assertEqual(scores, sorted(scores))
        # User quotes and FTS operators are treated as phrase text, never syntax.
        quoted = retrieve.search_text('"' + self.word + '"', source="sahih_masbur", db=self.db)
        self.assertEqual(quoted["total"], output["total"])
        self.assertEqual(retrieve.search_text("OR NEAR", db=self.db)["total"], 0)

    def test_near_ayah_filter_boost_and_surah_context(self):
        output = retrieve.search_text(self.word, near_ayah="108:1", limit=100, db=self.db)
        priorities = [entry["near_priority"] for entry in output["results"]]
        self.assertEqual(priorities, sorted(priorities))
        saadi = [entry for entry in output["results"] if entry["source_id"] == "saadi"]
        self.assertEqual({entry["locator"]["row_id"] for entry in saadi}, {1, 2})
        self.assertTrue(any(entry["source_id"] == "maqasid" for entry in output["results"]))
        self.assertEqual(retrieve.search_ayah("108:1", source="maqasid", db=self.db)["results"][0]["link_kind"], "surah")

    def test_verbatim_fields_notes_snippets_and_locators(self):
        output = retrieve.search_ayah("108:1", source="saadi", db=self.db)
        full = next(entry for entry in output["results"] if entry["section"] == "field")
        note = next(entry for entry in output["results"] if entry["section"] == "footnote")
        self.assertEqual(full["text"], self.raw)
        self.assertEqual(note["text"], " " + self.filler + " ")
        self.assertEqual(note["locator"]["part"], "footnote")
        self.assertEqual(note["locator"]["footnote_no"], 0)
        self.assertEqual(full["locator"]["table"], "project_contents")
        self.assertEqual(full["locator"]["key_column"], "id")
        for entry in retrieve.search_text(self.word, limit=100, db=self.db)["results"]:
            self.assertEqual(entry["snippet"], entry["text"][entry["snippet_start"]:entry["snippet_end"]])
        hits = retrieve.search_text(self.word, source="sahih_masbur", db=self.db)["results"]
        long_page = next(entry for entry in hits if entry["location"]["page_id"] == 2)
        self.assertIn(retrieve.normalize(self.word), retrieve.normalize(long_page["snippet"]))
        hadith = retrieve.search_text(self.word, source="hadeethenc", db=self.db)["results"][0]
        self.assertEqual(hadith["metadata"]["grade"], self.filler)
        self.assertEqual(hadith["locator"]["row_id"], "10")
        self.assertEqual(hadith["url"], "https://example.invalid/hadith/10")

    def test_incremental_rerun_and_new_page(self):
        before = self.all_rows()
        summary, _ = self.build()
        self.assertEqual(self.all_rows(), before)
        self.assertEqual(sum(item["updated"] for item in summary), 0)
        self.assertEqual(sum(item["skipped"] for item in summary), 7)
        self.write_page(4, self.word, previous=3, following=5)
        summary, errors = self.build(sources=["22912"])
        self.assertEqual(summary[0]["updated"], 1)
        self.assertEqual(summary[0]["errors"], 1)
        self.assertNotIn("4.json", errors)
        self.assertEqual(len(self.all_rows()), len(before) + 1)

    def test_corrupt_changed_page_preserves_prior_snapshot(self):
        before = self.all_rows()
        (self.pages / "1.json").write_text("{", encoding="utf-8")
        summary, errors = self.build(sources=["shamela"])
        self.assertEqual(summary[0]["errors"], 3)
        self.assertIn("1.json", errors)
        self.assertEqual(self.all_rows(), before)
        self.write_page(1, self.filler, following=2)
        self.build(sources=["shamela"])
        output = retrieve.search_text(self.word, source="sahih_masbur", db=self.db)
        self.assertNotIn(1, [entry["location"]["page_id"] for entry in output["results"]])

    def test_changed_field_prunes_stale_passages_and_links(self):
        self.write_page(3, self.filler, previous=2, following=4, footnotes="")
        self.build(sources=["sahih_masbur"])
        self.assertEqual(retrieve.search_ayah("108:3", source="sahih_masbur", db=self.db)["total"], 0)
        with closing(sqlite3.connect(self.db)) as connection:
            count = connection.execute("SELECT count(*) FROM passages WHERE page_id=3").fetchone()[0]
        self.assertEqual(count, 1)

    def test_neighbours_do_not_skip_missing_pages(self):
        page3 = retrieve.search_ayah("108:3", source="sahih_masbur", db=self.db)["results"][0]
        output = retrieve.get_passage(page3["id"], db=self.db)
        self.assertEqual({entry["location"]["page_id"] for entry in output["neighbours"]["previous"]}, {2})
        self.assertEqual(output["neighbours"]["next"], [])
        self.assertEqual(retrieve.get_passage(-1, db=self.db)["passage"], None)

    def test_ayah_snippet_centres_on_later_quote(self):
        text = " ".join([self.filler] * 80) + " " + self.ayah3["aya_text_emlaey"] + " " + " ".join([self.filler] * 80)
        self.write_page(4, text, previous=3, following=5)
        self.build(sources=["shamela"])
        entries = retrieve.search_ayah("108:3", source="sahih_masbur", db=self.db)["results"]
        hit = next(entry for entry in entries if entry["location"]["page_id"] == 4)
        self.assertGreater(hit["snippet_start"], 0)
        self.assertIn(retrieve.normalize(self.ayah3["aya_text_emlaey"]), retrieve.normalize(hit["snippet"]))
        self.assertEqual(hit["snippet"], text[hit["snippet_start"]:hit["snippet_end"]])

    def test_rebuild_preserves_ids_and_source_files(self):
        before = self.all_rows()
        original = {path: path.read_bytes() for path in (self.root / ".cache/sources").rglob("*") if path.is_file()}
        self.build(rebuild=True)
        self.assertEqual(self.all_rows(), before)
        self.assertEqual({path: path.read_bytes() for path in original}, original)
        with closing(sqlite3.connect(self.db)) as connection:
            self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            connection.execute("INSERT INTO passages_fts(passages_fts,rank) VALUES('integrity-check',1)")

    def test_cli_json_markdown_and_validation(self):
        for format_name in ("json", "md"):
            output = io.StringIO()
            with redirect_stdout(output):
                code = retrieve.main(["--ayah", "108:1", "--db", str(self.db), "--format", format_name])
            self.assertEqual(code, 0)
            if format_name == "json":
                self.assertGreater(json.loads(output.getvalue())["total"], 0)
            else:
                self.assertIn("Snippet:", output.getvalue())
        with self.assertRaises(ValueError):
            retrieve.search_text("*", db=self.db)
        with self.assertRaises(ValueError):
            retrieve.search_ayah("0:1", db=self.db)
        with self.assertRaises(ValueError):
            build_index.build_index(db=self.db, root=self.root, sources=["unavailable"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
