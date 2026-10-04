#!/usr/bin/env python3
"""Fetch Shamela books for internal retrieval (standard library only).

Usage: python3 tools/fetch_shamela.py --books 9776,22912,23636 --max-requests 20
Page text stays in the ignored .cache/sources/shamela directory. Resume by
repeating the command. --first-page defaults to the unverified seed ID 1;
--start-page explicitly starts a suffix (use --only-book for one book).
"""

import argparse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import http.client
import math
from pathlib import Path
import random
import re
import signal
import socket
import ssl
import sys
import time
import uuid
from urllib import error, request


ROOT = Path(__file__).resolve().parents[1] / '.cache/sources/shamela'
ENDPOINT = 'https://mcp.shamela.ws/'
TITLES = {9776: 'التحرير والتنوير', 22912: 'الصحيح المسبور',
          23636: 'المفردات في غريب القرآن'}


def tls_context():
    """Verified TLS. python.org builds on macOS ship without a CA bundle,
    so fall back to the system bundle; verification is never disabled."""
    context = ssl.create_default_context()
    if not context.get_ca_certs():
        for bundle in ('/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'):
            if Path(bundle).exists():
                context.load_verify_locations(cafile=bundle)
                break
    return context


TLS = tls_context()


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic_write(path, content, page=False):
    """Leave interrupted temporary files alone; never delete files."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if page and path.exists():
        return False
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    with temporary.open('xb') as handle:
        handle.write(content)
        handle.flush()
        import os
        os.fsync(handle.fileno())
    if page and path.exists():
        return False
    temporary.rename(path)
    return True


def write_json(path, value, page=False):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    return len(data) if atomic_write(path, data, page) else 0


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError('must be a positive integer')
    return number


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--books', required=True, help='comma-separated book IDs')
    parser.add_argument('--root', type=Path, default=ROOT, help='output directory')
    parser.add_argument('--batch', type=positive, choices=range(1, 9), default=1,
                        help='body base pages per request (1-8)')
    parser.add_argument('--delay', type=float, default=4)
    parser.add_argument('--max-requests', type=positive)
    parser.add_argument('--only-book', type=positive)
    parser.add_argument('--start-page', type=positive)
    parser.add_argument('--first-page', type=positive, default=1,
                        help='unverified initial page seed; previous IDs locate the first page')
    args = parser.parse_args()
    try:
        args.books = list(dict.fromkeys(positive(x.strip()) for x in args.books.split(',')))
    except (ValueError, argparse.ArgumentTypeError):
        parser.error('--books must contain positive integer IDs')
    if not math.isfinite(args.delay) or args.delay < 0:
        parser.error('--delay must be finite and nonnegative')
    if args.only_book is not None:
        if args.only_book not in args.books:
            parser.error('--only-book must be included in --books')
        args.books = [args.only_book]
    if args.start_page is not None and len(args.books) != 1:
        parser.error('--start-page requires one selected book')
    return args


class Stop(Exception):
    def __init__(self, reason, code=0):
        super().__init__(reason)
        self.code = code


class Fetcher:
    def __init__(self, args):
        self.args = args
        self.started = now()
        self.manual = False
        self.status = 'يعمل'
        self.run_requests = 0
        self.last_request = None
        self.failures = 0
        self.states = {}
        for book in args.books:
            path = self.book_dir(book) / 'state.json'
            if path.exists():
                state = json.loads(path.read_text(encoding='utf-8'))
            else:
                state = {'book_id': book, 'last_page_id': None,
                         'next_page_id': args.start_page or args.first_page,
                         'finding_first': args.start_page is None,
                         'finished': False, 'pending': {}, 'requests': 0,
                         'errors': 0, 'request_seconds': 0, 'last_errors': []}
            # Reconcile a crash between a page rename and a state update.
            pages = list((self.book_dir(book) / 'pages').glob('*.json'))
            state['pages_saved'] = len(pages)
            state['bytes_saved'] = sum(p.stat().st_size for p in pages)
            self.states[book] = state

    def book_dir(self, book):
        return self.args.root / 'books' / str(book)

    def save(self, book):
        state = self.states[book]
        state['updated_at'] = now()
        write_json(self.book_dir(book) / 'state.json', state)

    def check_stop(self):
        if self.manual:
            raise Stop('أُوقف يدويًا')
        if self.args.max_requests and self.run_requests >= self.args.max_requests:
            raise Stop('بلغ حد الطلبات')

    def sleep(self, seconds):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            self.check_stop()
            time.sleep(min(0.25, max(0, end - time.monotonic())))

    def report(self):
        states = list(self.states.values())
        requests = sum(s['requests'] for s in states)
        pages = sum(s['pages_saved'] for s in states)
        seconds = sum(s['request_seconds'] for s in states)
        lines = ['# تقرير جلب كتب الشاملة', '',
                 f'- وقت بدء التشغيل: {self.started}', f'- آخر تحديث: {now()}',
                 f'- الحالة: {self.status}',
                 '- الإحصاءات تراكمية للكتب المختارة؛ زمن الطلب هو زمن الاتصال دون الانتظار.', '']
        for book, s in self.states.items():
            lines += [f'## {TITLES.get(book, str(book))} ({book})', '',
                      '| الصفحات المحفوظة | آخر جزء | آخر صفحة مطبوعة | الطلبات | الأخطاء | اكتمل |',
                      '|---|---|---|---|---|---|',
                      f"| {s['pages_saved']} | {s.get('last_part', '—')} | "
                      f"{s.get('last_page_number', '—')} | {s['requests']} | "
                      f"{s['errors']} | {'نعم' if s['finished'] else 'لا'} |", '']
        lines += ['## الإجماليات', '', f'- الطلبات: {requests}',
                  f'- الصفحات لكل طلب (pages per request): {pages / requests if requests else 0:.2f}',
                  f"- البايتات المحفوظة: {sum(s['bytes_saved'] for s in states)}",
                  f'- متوسط الثواني لكل طلب: {seconds / requests if requests else 0:.2f}',
                  '', '## آخر عشرة أخطاء', '', '| الوقت | حالة HTTP | السبب |', '|---|---|---|']
        errors = sorted((e for s in states for e in s['last_errors']), key=lambda e: e['time'])[-10:]
        for e in errors:
            message = str(e['error']).replace('|', '/').replace('\n', ' ')[:300]
            lines.append(f"| {e['time']} | {e['http_status'] or '—'} | {message} |")
        atomic_write(self.args.root / 'fetch-report.md', ('\n'.join(lines) + '\n').encode('utf-8'))

    def record(self, book, tool, arguments, elapsed, status, message, size):
        s = self.states[book]
        self.run_requests += 1
        s['requests'] += 1
        s['request_seconds'] += elapsed
        entry = {'time': now(), 'book_id': book, 'tool': tool,
                 'arguments': arguments, 'http_status': status,
                 'seconds': elapsed, 'response_bytes': size, 'error': message}
        if message:
            s['errors'] += 1
            s['last_errors'] = (s['last_errors'] + [entry])[-10:]
        with (self.args.root / 'fetch-log.jsonl').open('a', encoding='utf-8') as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + '\n')
            handle.flush()
        self.save(book)
        if self.run_requests % 25 == 0:
            self.report()

    @staticmethod
    def decode(raw, content_type, rpc_id):
        text = raw.decode('utf-8')
        if 'text/event-stream' in content_type or text.lstrip().startswith('event:') or text.lstrip().startswith('data:'):
            envelopes = []
            for event in re.split(r'\r?\n\r?\n', text):
                data = '\n'.join(line[5:].lstrip() for line in event.splitlines() if line.startswith('data:'))
                if data:
                    envelopes.append(json.loads(data))
            envelope = next((e for e in envelopes if e.get('id') == rpc_id), None)
            if envelope is None:
                raise ValueError('SSE response has no matching JSON-RPC result')
        else:
            envelope = json.loads(text)
        if envelope.get('id') != rpc_id or envelope.get('error'):
            raise ValueError('JSON-RPC error or mismatched ID: ' + str(envelope.get('error')))
        result = envelope['result']
        if result.get('isError'):
            raise ValueError('MCP tool error: ' + str(result.get('content')))
        structured = result.get('structuredContent')
        if structured is None:
            structured = json.loads(next(c['text'] for c in result['content'] if c.get('type') == 'text'))
        if structured.get('ok') is False:
            raise ValueError('MCP failure: ' + str(structured))
        return structured

    @staticmethod
    def retry_after(headers):
        value = headers.get('Retry-After') if headers else None
        if not value:
            return 0
        try:
            return max(0, float(value))
        except ValueError:
            try:
                return max(0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                return 0

    def call(self, book, tool, arguments, allow_partial=False):
        while True:
            self.check_stop()
            if self.last_request is not None:
                self.sleep(max(0, self.args.delay + random.uniform(0, 2)
                               - (time.monotonic() - self.last_request)))
            self.check_stop()
            rpc_id = self.run_requests + 1
            payload = {'jsonrpc': '2.0', 'id': rpc_id, 'method': 'tools/call',
                       'params': {'name': tool, 'arguments': arguments}}
            req = request.Request(ENDPOINT, json.dumps(payload).encode('utf-8'),
                                  headers={'Content-Type': 'application/json',
                                           'Accept': 'application/json, text/event-stream',
                                           'User-Agent': 'IslamicAI-CH/1.0 (internal book retrieval)'}, method='POST')
            started = time.monotonic()
            status, message, size, retry, wait = None, None, 0, False, 0
            result = None
            try:
                with request.urlopen(req, timeout=60, context=TLS) as response:
                    status = response.status
                    raw = response.read()
                    size = len(raw)
                    result = self.decode(raw, response.headers.get('Content-Type', ''), rpc_id)
                    if result.get('errors'):
                        message = 'MCP batch errors: ' + json.dumps(result['errors'], ensure_ascii=False)
            except error.HTTPError as exc:
                status, message = exc.code, str(exc)
                wait = self.retry_after(exc.headers)
                retry = status == 429 or 500 <= status <= 599
                exc.close()
            except (error.URLError, OSError, socket.timeout, http.client.HTTPException) as exc:
                message, retry = str(exc), True
            except (ValueError, KeyError, TypeError, StopIteration) as exc:
                message = 'Invalid API response: ' + str(exc)
            finally:
                self.last_request = time.monotonic()
                self.record(book, tool, arguments, self.last_request - started, status, message, size)
            if message is None or (allow_partial and result is not None):
                self.failures = 0
                return result
            if status == 403:
                raise Stop('يرفض الخادم الطلبات (HTTP 403)', 1)
            if not retry:
                raise Stop('خطأ في الطلب أو استجابة الخادم: ' + message, 1)
            self.failures += 1
            if self.failures >= 5:
                raise Stop('يرفض الخادم الطلبات (stopped: server refusing)', 1)
            self.sleep(max((30, 60, 120, 300)[self.failures - 1], wait))

    @staticmethod
    def validate(source, book, page=None, field='body'):
        if source['book_id'] != book or (page is not None and source['page_id'] != page):
            raise ValueError('API returned the wrong book/page')
        positive(str(source['page_id']))
        if not isinstance(source['text'], str) or not isinstance(source['citation'], dict):
            raise ValueError('Invalid source text/citation')
        navigation = source['navigation']
        for key in ('previous_page_id', 'next_page_id'):
            if key not in navigation or (navigation[key] is not None and
                                         (type(navigation[key]) is not int or navigation[key] < 1)):
                raise ValueError('Missing/invalid navigation ID')
        if field == 'footnotes' and source.get('field') != 'footnotes':
            raise ValueError('Footnote response is not marked footnotes')
        if source.get('truncated') and not source.get('next_cursor'):
            raise ValueError('Truncated source has no continuation cursor')
        return source

    def open_page(self, book, page, field='body', cursor=None):
        arguments = {'book_id': book, 'page_id': page, 'field': field, 'max_chars': 16000}
        if cursor:
            arguments['cursor'] = cursor
        return self.validate(self.call(book, 'shamela_open', arguments), book, page, field)

    def finish_field(self, book, page, field):
        pending = self.states[book]['pending'][str(page)]
        if field not in pending:
            pending[field] = self.open_page(book, page, field)
            self.save(book)
        source = pending[field]
        while source.get('next_cursor'):
            cursor = source['next_cursor']
            history = source.setdefault('_consumed_cursors', [])
            if cursor in history:
                raise ValueError('Cycle in continuation cursors')
            chunk = self.open_page(book, page, field, cursor)
            if chunk.get('next_cursor') == cursor:
                raise ValueError('Continuation cursor did not advance')
            offset = chunk.get('offset')
            if offset is not None and offset != len(source['text']):
                raise ValueError('Continuation offset does not match saved text')
            history.append(cursor)
            source['text'] += chunk['text']
            source['next_cursor'] = chunk.get('next_cursor')
            self.save(book)
        return source

    def fetch_bodies(self, book, page, count):
        # The server caps context pages per call (about seven in total), so a batch
        # asks for consecutive base pages with no context: eight pages per call.
        batch = self.call(book, 'shamela_open_many', {
            'pages': [{'book_id': book, 'page_id': page + i,
                       'field': 'body', 'max_chars': 16000} for i in range(count)],
            'context': 3 if count == 1 else 0,
            'max_total_chars': 56000 if count == 1 else 64000},
            allow_partial=count > 1)
        sources = batch.get('sources', [])
        for source in sources:
            self.validate(source, book)
        # Follow returned links; source array order is not page order.
        by_id = {source['page_id']: source for source in sources}
        current, chain = page, set()
        pending = self.states[book]['pending']
        while current in by_id and current not in chain:
            chain.add(current)
            pending.setdefault(str(current), {}).setdefault('body', by_id[current])
            current = by_id[current]['navigation']['next_page_id']
        if str(page) not in pending:
            if count > 1:
                return self.fetch_bodies(book, page, 1)
            pending[str(page)] = {}
        self.save(book)

    def fetch_footnotes(self, book):
        pending = self.states[book]['pending']
        missing = [int(p) for p, fields in pending.items()
                   if 'footnotes' not in fields and not
                   (self.book_dir(book) / 'pages' / f'{p}.json').exists()]
        for offset in range(0, len(missing), 8):
            pages = missing[offset:offset + 8]
            batch = self.call(book, 'shamela_open_many', {
                'pages': [{'book_id': book, 'page_id': p, 'field': 'footnotes',
                           'max_chars': 16000} for p in pages],
                'context': 0, 'max_total_chars': 56000 if self.args.batch == 1 else 64000})
            for source in batch.get('sources', []):
                self.validate(source, book, field='footnotes')
                if source['page_id'] not in pages:
                    raise ValueError('Unexpected page in footnote batch')
                pending[str(source['page_id'])]['footnotes'] = source
            self.save(book)

    def walk(self, book):
        s = self.states[book]
        if s['finished']:
            return
        seen = set()
        # Seed ID 1 is configurable; use actual previous IDs to locate the start.
        while s.get('finding_first'):
            page = s['next_page_id']
            if page in seen:
                raise ValueError('Cycle while locating the first page')
            seen.add(page)
            source = self.open_page(book, page)
            previous = source['navigation']['previous_page_id']
            if previous is None:
                s['finding_first'] = False
                s['pending'][str(page)] = {'body': source}
            else:
                s['next_page_id'] = previous
            self.save(book)
        seen.clear()
        while not s['finished']:
            if self.manual:
                self.check_stop()
            page = s['next_page_id']
            if page in seen:
                raise ValueError('Cycle in next-page navigation')
            seen.add(page)
            path = self.book_dir(book) / 'pages' / f'{page}.json'
            if path.exists():
                saved = json.loads(path.read_text(encoding='utf-8'))
                if saved['book_id'] != book or saved['page_id'] != page:
                    raise ValueError('Existing page has the wrong identity')
            else:
                if str(page) not in s['pending']:
                    self.fetch_bodies(book, page, self.args.batch)
                body = self.finish_field(book, page, 'body')
                self.fetch_footnotes(book)
                footnotes = self.finish_field(book, page, 'footnotes')
                if body['navigation'] != footnotes['navigation']:
                    raise ValueError('Body/footnote navigation mismatch')
                citation = body['citation']
                # Multi-volume books cite "(part/page)"; single-volume ones "(ص page)".
                # Digits may be Arabic-Indic (int() accepts them). Front matter may
                # carry no printed page at all: keep the page and store None.
                label = citation.get('markdown', '').split('](')[0]
                match = re.search(r'\((\d+)\s*/\s*(\d+)\)', label)
                single = re.search(r'\(ص\s*(\d+)\)', label)
                part = int(match[1]) if match else None
                number = int(match[2]) if match else (int(single[1]) if single else None)
                saved = {'book_id': book, 'page_id': page, 'part': part,
                         'page_number': number, 'text': body['text'],
                         'footnotes': footnotes['text'], 'citation': citation,
                         'prev_id': body['navigation']['previous_page_id'],
                         'next_id': body['navigation']['next_page_id'], 'fetched_at': now()}
                size = write_json(path, saved, page=True)
                if size:
                    s['pages_saved'] += 1
                    s['bytes_saved'] += size
            s['last_page_id'] = page
            s['last_part'], s['last_page_number'] = saved['part'], saved['page_number']
            s['next_page_id'] = saved['next_id']
            s['pending'].pop(str(page), None)
            s['finished'] = saved['next_id'] is None
            self.save(book)


def main():
    args = parse_args()
    args.root.mkdir(parents=True, exist_ok=True)
    # Lock the append-only log so two invocations cannot overwrite a page.
    import fcntl
    with (args.root / 'fetch-log.jsonl').open('a', encoding='utf-8') as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another fetcher is running.', file=sys.stderr)
            return 1
        fetcher = Fetcher(args)

        def interrupted(signum, frame):
            fetcher.manual = True

        signal.signal(signal.SIGINT, interrupted)
        signal.signal(signal.SIGTERM, interrupted)
        code = 0
        try:
            fetcher.report()
            for book in args.books:
                if fetcher.manual:
                    fetcher.check_stop()
                fetcher.walk(book)
            fetcher.status = 'انتهى'
        except Stop as exc:
            fetcher.status, code = 'توقف: ' + str(exc), exc.code
        except Exception as exc:
            fetcher.status, code = 'توقف: خطأ محلي أو استجابة غير متوقعة: ' + str(exc), 1
        finally:
            if fetcher.manual:
                fetcher.status, code = 'توقف: أُوقف يدويًا', 0
            for book in args.books:
                fetcher.save(book)
            fetcher.report()
        print(fetcher.status)
        return code


if __name__ == '__main__':
    sys.exit(main())
