#!/usr/bin/env python3
"""Offline walker tests. Temporary outputs are retained, never deleted."""

import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib import error

sys.dont_write_bytecode = True
import fetch_shamela as fetch


BOOK = 1681
IDS = list(range(1, 20)) + list(range(30, 71))
TEMP = Path(tempfile.mkdtemp(prefix='test-fetch-shamela-'))


class Response:
    status = 200
    headers = {'Content-Type': 'application/json'}

    def __init__(self, rpc_id, result):
        self.raw = json.dumps({'jsonrpc': '2.0', 'id': rpc_id,
                               'result': {'structuredContent': result}}).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read(self):
        return self.raw


class FakeMCP:
    def __init__(self, empty_batch=False):
        self.calls = []
        self.empty_batch = empty_batch
        self.partial_errors = 0

    @staticmethod
    def text(page, field):
        if field == 'footnotes':
            return '' if page % 3 == 0 else f'Footnote {page}'
        return 'x' * 33000 if page == 9 else f'Body {page}'

    def source(self, page, field, offset=0, limit=16000):
        index = IDS.index(page) if page in IDS else None
        text = self.text(page, field)
        end = min(len(text), offset + limit)
        source = {'book_id': BOOK, 'page_id': page, 'text': text[offset:end],
                  'citation': {'markdown': f'[Fake (1/{page})](offline:{page})'},
                  'navigation': {
                      'previous_page_id': IDS[index - 1] if index else None,
                      'next_page_id': IDS[index + 1] if index is not None and
                      index + 1 < len(IDS) else None},
                  'offset': offset, 'next_cursor': str(end) if end < len(text) else None}
        if field == 'footnotes':
            source['field'] = field
        if source['next_cursor']:
            source['truncated'] = True
        return source

    def __call__(self, req, **kwargs):
        rpc = json.loads(req.data)
        tool, args = rpc['params']['name'], rpc['params']['arguments']
        self.calls.append((tool, args))
        if tool == 'shamela_open':
            result = self.source(args['page_id'], args['field'],
                                 int(args.get('cursor', 0)), args['max_chars'])
        else:
            assert tool == 'shamela_open_many'
            assert 1 <= len(args['pages']) <= 8
            assert 0 <= args['context'] <= 3
            assert 500 <= args['max_total_chars'] <= 64000
            if self.empty_batch and len(args['pages']) > 1 and args['pages'][0]['field'] == 'body':
                self.empty_batch = False
                return Response(rpc['id'], {'sources': [self.source(1000, 'body')],
                                            'errors': [{'error': 'missing guessed pages'}]})
            sources, errors, included = [], [], set()
            remaining = args['max_total_chars']
            for base in args['pages']:
                page, field = base['page_id'], base['field']
                if page not in IDS:
                    errors.append({'page_id': page, 'error': 'not found'})
                    continue
                index = IDS.index(page)
                context = args['context']
                candidates = [page] + IDS[max(0, index - context):index] + IDS[index + 1:index + context + 1]
                for candidate in candidates:
                    if candidate in included or remaining <= 0:
                        continue
                    source = self.source(candidate, field, limit=min(base['max_chars'], remaining))
                    sources.append(source)
                    included.add(candidate)
                    remaining -= len(source['text'])
            if args['pages'][0]['field'] == 'body':
                sources.append(self.source(1000, 'body'))
            self.partial_errors += bool(errors)
            result = {'sources': list(reversed(sources)), 'errors': errors}
        return Response(rpc['id'], result)


class WalkerTests(unittest.TestCase):
    def run_walker(self, name, batch, limit=None, responder=None, first=1):
        root = TEMP / name
        responder = responder or FakeMCP()
        argv = ['fetch_shamela.py', '--books', str(BOOK), '--batch', str(batch),
                '--root', str(root), '--first-page', str(first), '--delay', '0']
        if limit:
            argv += ['--max-requests', str(limit)]
        order = []
        original = fetch.write_json

        def write_json(path, value, page=False):
            size = original(path, value, page)
            if page and size:
                order.append(value['page_id'])
            return size

        with patch.object(sys, 'argv', argv), \
                patch.object(fetch.request, 'urlopen', responder), \
                patch.object(fetch.Fetcher, 'sleep', lambda self, seconds: None), \
                patch.object(fetch.signal, 'signal'), \
                patch.object(fetch, 'now', return_value='2026-01-01T00:00:00+00:00'), \
                patch.object(fetch, 'write_json', write_json), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            code = fetch.main()
        self.assertEqual(code, 0, output.getvalue())
        return root, responder, order

    def saved(self, root):
        directory = root / 'books' / str(BOOK)
        pages = {int(p.stem): json.loads(p.read_text()) for p in (directory / 'pages').glob('*.json')}
        self.assertEqual(set(pages), set(IDS))
        state = json.loads((directory / 'state.json').read_text())
        self.assertTrue(state['finished'])
        self.assertEqual(state['pages_saved'], len(IDS))
        self.assertEqual(state['pending'], {})
        chain, page = [], IDS[0]
        while page is not None:
            self.assertNotIn(page, chain)
            chain.append(page)
            page = pages[page]['next_id']
        self.assertEqual(chain, IDS)
        self.assertIn('pages per request', (root / 'fetch-report.md').read_text())
        self.assertTrue((root / 'fetch-log.jsonl').exists())
        return [pages[p] for p in IDS]

    def test_batch_equivalence_and_request_reduction(self):
        one, slow, order_one = self.run_walker('single', 1)
        eight, fast, order_eight = self.run_walker('batch', 8)
        self.assertEqual(order_one, IDS)
        self.assertEqual(order_eight, IDS)
        self.assertEqual(self.saved(one), self.saved(eight))
        self.assertLess(len(fast.calls), len(slow.calls))
        self.assertGreater(fast.partial_errors, 0)
        self.assertTrue(any(a.get('cursor') for _, a in fast.calls))
        body_calls = [a for _, a in slow.calls if a.get('context') == 3]
        self.assertTrue(all(len(a['pages']) == 1 and a['max_total_chars'] == 56000 for a in body_calls))
        print(f'60 pages: batch 1 = {len(slow.calls)} requests; batch 8 = {len(fast.calls)} requests')

    def test_interrupted_and_cross_mode_resume(self):
        reference, _, _ = self.run_walker('reference', 1)
        for initial, resumed in ((1, 1), (8, 8), (1, 8), (8, 1)):
            for limit in (1, 4, 5, 6, 8, 10):
                with self.subTest(initial=initial, resumed=resumed, limit=limit):
                    name = f'resume-{initial}-{resumed}-{limit}'
                    root, _, before = self.run_walker(name, initial, limit)
                    state = json.loads((root / 'books' / str(BOOK) / 'state.json').read_text())
                    self.assertFalse(state['finished'])
                    root, _, after = self.run_walker(name, resumed)
                    self.assertEqual(before + after, IDS)
                    self.assertEqual(self.saved(reference), self.saved(root))

    def test_empty_chain_falls_back_to_single_request(self):
        root, responder, order = self.run_walker('fallback', 8, responder=FakeMCP(True))
        self.assertEqual(order, IDS)
        self.saved(root)
        body_calls = [a for _, a in responder.calls if a.get('pages') and a['pages'][0]['field'] == 'body']
        self.assertEqual(len(body_calls[0]['pages']), 8)
        self.assertEqual(len(body_calls[1]['pages']), 1)
        self.assertEqual(body_calls[0]['pages'][0], body_calls[1]['pages'][0])

    def test_previous_links_locate_first_page(self):
        root, _, order = self.run_walker('locate-first', 8, first=3)
        self.assertEqual(order, IDS)
        self.saved(root)

    def test_crash_after_page_rename_resumes(self):
        original = fetch.atomic_write

        def interrupted_write(path, content, page=False):
            result = original(path, content, page)
            if page:
                raise fetch.Stop('simulated interruption after rename')
            return result

        with patch.object(fetch, 'atomic_write', interrupted_write):
            root, _, _ = self.run_walker('rename-crash', 1)
        root, _, order = self.run_walker('rename-crash', 8)
        self.assertEqual(order, IDS[1:])
        self.saved(root)

    def test_http_stop_conditions(self):
        for status, expected in ((403, 1), (503, 5)):
            with self.subTest(status=status):
                args = type('Args', (), {'books': [BOOK], 'root': TEMP / f'http-{status}',
                                       'batch': 8, 'start_page': None, 'first_page': 1,
                                       'max_requests': None, 'delay': 0})()
                args.root.mkdir()
                fetcher = fetch.Fetcher(args)
                failure = error.HTTPError('offline:', status, 'fake failure', {}, None)
                with patch.object(fetch.request, 'urlopen', side_effect=failure) as http, \
                        patch.object(fetch.Fetcher, 'sleep', lambda self, seconds: None):
                    with self.assertRaises(fetch.Stop):
                        fetcher.call(BOOK, 'shamela_open_many', {}, allow_partial=True)
                self.assertEqual(http.call_count, expected)


if __name__ == '__main__':
    print(f'Temporary outputs retained at {TEMP}')
    unittest.main(verbosity=2)
