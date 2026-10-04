#!/usr/bin/env python3
"""Offline orchestration; all model work is dispatched through fleet relays."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from datetime import datetime, timezone
import json
import io
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[2]
STOP = threading.Event()
EXPORT_LOCK = threading.Lock()
SCORES = ('support', 'attribution', 'quote_fidelity', 'narration_handling', 'reader_pull')
SAMPLED = ('sentences', 'titles', 'terms', 'narrations', 'depth_items')
FINDING_KINDS = {'unsupported', 'attribution', 'quote', 'narration', 'opening', 'review-status', 'other'}
IGNORED_REVIEW_KINDS = {'review-status'}
DECISIONS = {'\u0646\u0639\u0645': 'yes', '\u0645\u0639\u0644\u0651\u0642': 'pending', '\u0644\u0627': 'no'}


def now():
    return datetime.now(timezone.utc).isoformat()


def read(path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def save(path, data):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def counts(items, key):
    result = Counter(DECISIONS.get(item.get(key, {}).get('decision'), 'unknown') for item in items)
    return {k: result[k] for k in ('yes', 'pending', 'no', 'unknown')}


def content_counts(root, no):
    records = read(root / f'.cache/records/{no}/records.v2.json', {}).get('records', [])
    nasij = read(root / f'content/nasij/{no}.json', {})
    evidence = [e for r in records for e in r.get('evidence', []) if e.get('icon') in ('hadith', 'athar')]
    terms, depth_items, words = set(), 0, []
    stops = {str(i): 0 for i in range(4)}
    def walk(blocks, depth):
        nonlocal depth_items
        for b in blocks:
            if b.get('type') == 'paragraph' and b.get('title'):
                stops[str(depth)] += 1
            if b.get('type') == 'details':
                depth_items += 1
                walk(b.get('blocks', []), depth)
            segments = b.get('segments', []) + (b.get('title', []) if isinstance(b.get('title'), list) else [])
            for s in segments:
                if s.get('t') == 'term':
                    terms.add(s.get('record', s.get('v')))
                if depth == 0 and s.get('t') in ('text', 'quote', 'term'):
                    words.append(s.get('v', ''))
            if depth == 0:
                if b.get('type') == 'heading':
                    words.append(b.get('text', ''))
                if isinstance(b.get('title'), str):
                    words.append(b['title'])
    for level in nasij.get('levels', []):
        walk(level.get('blocks', []), level['depth'])
    return dict(records=counts(records, 'build_permission'), display=counts(records, 'display'),
                narration_evidence=counts(evidence, 'build_permission'), stops=stops,
                passages=len(nasij.get('passages', [])), terms=len(terms), held=len(nasij.get('held', [])),
                depth_items=depth_items, level0_words=len(re.findall(r'\b\w+\b',
                    re.sub(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]', '', ' '.join(words)))))


def parse_review(report, no):
    blocks = re.findall(r'```json\s*\n(.*?)```', report, re.S | re.I)
    if not blocks:
        raise ValueError('missing fenced JSON')
    d = json.loads(blocks[-1])
    if not isinstance(d, dict) or type(d.get('surah')) is not int or d['surah'] != no:
        raise ValueError('wrong surah')
    for group, keys, maximum in (('scores', SCORES, 5), ('sampled', SAMPLED, None)):
        if not isinstance(d.get(group), dict) or set(d[group]) != set(keys):
            raise ValueError('invalid ' + group)
        if any(type(v) is not int or v < 0 or (maximum is not None and v > maximum) for v in d[group].values()):
            raise ValueError('invalid numbers')
    if d.get('verdict') not in ('ship', 'fix-then-ship', 'do-not-ship') or not isinstance(d.get('findings'), list):
        raise ValueError('invalid verdict/findings')
    for f in d['findings']:
        if not isinstance(f, dict) or f.get('severity') not in ('critical', 'major', 'minor'):
            raise ValueError('invalid severity')
        # Older reviewer reports did not include kind.
        if 'kind' in f and (not isinstance(f['kind'], str) or f['kind'] not in FINDING_KINDS):
            raise ValueError('invalid finding kind')
        if type(f.get('level')) is not int or not 0 <= f['level'] <= 3:
            raise ValueError('invalid level')
        if any(not isinstance(f.get(k), str) for k in ('where', 'problem', 'fix')):
            raise ValueError('invalid finding text')
        if not isinstance(f.get('records'), list) or any(not isinstance(x, str) for x in f['records']):
            raise ValueError('invalid records')
    return d


def systemic_finding(finding):
    return (finding['kind'] in IGNORED_REVIEW_KINDS if 'kind' in finding
            else 'completion status' in finding['where'].casefold())


def systemic_count(review):
    return sum(systemic_finding(f) for f in review['findings'])


def fixable_findings(review):
    return [f for f in review['findings'] if not systemic_finding(f)]


def needs_review_fix(review):
    findings = fixable_findings(review)
    return (any(f['severity'] in ('critical', 'major') for f in findings) or
            (review['verdict'] != 'ship' and (findings or not review['findings'])))


def review_passed(review):
    return not any(f['severity'] in ('critical', 'major') for f in fixable_findings(review))


def usage_limited(text):
    return bool(re.search(r'usage[ _-]*limit|rate[ _-]*limit|quota|hit (?:your |the )?limit|'
                          r'limit (?:reached|exceeded)|insufficient_quota', text, re.I))


def relay_usage_limited(out, diagnostics):
    if usage_limited(diagnostics):
        return True
    stderr = out / 'stderr.txt'
    if stderr.is_file() and usage_limited(stderr.read_text(encoding='utf-8')):
        return True
    events = out / 'events.jsonl'
    if events.is_file():
        # Codex can leave finalMessage and stderr empty on usage exhaustion.
        # Inspect error events only, not the source text sampled by the reviewer.
        with events.open(encoding='utf-8') as stream:
            for line in stream:
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                if isinstance(event, dict) and event.get('type') in ('error', 'turn.failed'):
                    if usage_limited(json.dumps(event, ensure_ascii=False)):
                        return True
    return False


class DispatchLog(io.StringIO):
    """Capture dispatch diagnostics while keeping the run log live."""
    def __init__(self, log):
        super().__init__()
        self.log = log

    def write(self, text):
        self.log.write(text)
        return super().write(text)

    def flush(self):
        self.log.flush()
        super().flush()


def lane_command(spec, brief, root, out, timeout, review=False):
    implementer, lane = spec.split(':', 1)
    config = read(root / '.delegate/config.json')['lanes']
    if implementer not in ('claude', 'codex') or lane not in config or config[lane]['implementer'] != implementer:
        raise ValueError('invalid or mismatched lane: ' + spec)
    relay = Path.home() / f'.agents/skills/{implementer}-delegate/scripts/relay.mjs'
    command = ['node', str(relay), '--lane', lane, '--brief', str(brief), '--cd', str(root),
               '--timeout', f'{timeout}m', '--out-dir', str(out)]
    if review:
        command.append('--read-only')
    return command


def execute(command, root, log, timeout):
    log.write('$ ' + shlex.join(command) + '\n'); log.flush()
    process = subprocess.Popen(command, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               start_new_session=True)
    def drain():
        for chunk in iter(lambda: process.stdout.read(4096), b''):
            log.write(chunk.decode('utf-8', errors='replace')); log.flush()
    thread = threading.Thread(target=drain)
    thread.start()
    deadline = time.monotonic() + timeout * 60 + 30
    aborted = False
    while process.poll() is None:
        if STOP.wait(.1) or time.monotonic() > deadline:
            aborted = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
            break
    process.wait(); thread.join(); process.stdout.close()
    return 130 if aborted else process.returncode


def run_surah(no, args, *, root=ROOT, command_factory=lane_command, executor=execute):
    if STOP.is_set():
        return dict(surah=no, status='failed-dispatch')
    directory = root / f'.cache/pipeline/{no}'
    directory.mkdir(parents=True, exist_ok=True)
    previous = read(directory / 'eval.json', {})
    if previous.get('status') == 'passed' and not args.force and args.stages not in ('review', 'review,fix'):
        print(f'{no}: skipped (passed)'); return previous
    rows = [r for r in read(root / 'tools/data/qurancomplex/hafsData_v2-0.json') if int(r['sura_no']) == no]
    if not rows:
        raise ValueError(f'unknown surah: {no}')
    values = dict(surah_no=str(no), surah_name=rows[0]['sura_name_ar'], ayah_count=str(len(rows)), gate_output='')
    stages = args.stages.split(',')
    evaluation = dict(surah=no, ayah_count=len(rows), builder=args.builder, reviewer=args.reviewer,
                      started_at=now(), stages={}, fix_rounds=0, review_fix_rounds=0,
                      review_rounds=[], gates=[], review_status='not-run', systemic=0, status='failed-dispatch')
    if 'build' not in stages:
        # Retain build results and review history when working on existing files.
        for key in ('builder', 'build_status', 'fix_rounds', 'systemic'):
            if key in previous:
                evaluation[key] = previous[key]
        evaluation['stages'] = {k: v for k, v in previous.get('stages', {}).items()
                                if k == 'build' or k.startswith('fix-review')}
        evaluation['gates'] = previous.get('gates', [])
        evaluation['review_rounds'] = previous.get('review_rounds', [])
        if 'review' in previous:
            evaluation['review'] = previous['review']
    cached_review = None
    if stages == ['review', 'fix'] and not args.dry_run:
        review_path = directory / 'review.json'
        inputs = [root / f'content/nasij/{no}.json',
                  root / f'.cache/records/{no}/draft.v2.json']
        if (review_path.is_file() and all(p.is_file() for p in inputs) and
                all(review_path.stat().st_mtime_ns > p.stat().st_mtime_ns for p in inputs)):
            try:
                cached_review = parse_review('```json\n' + review_path.read_text(encoding='utf-8') + '\n```', no)
            except (ValueError, TypeError, KeyError):
                pass  # Invalid cached reviews must be replaced by a real review.
    serial = 0
    dispatch_limited = False
    def brief(stage, output=''):
        values['gate_output'] = output[-6000:]
        filename = 'fix-review.ar.md' if stage == 'fix-review' else f"{stage}-surah.{'en' if stage == 'review' else 'ar'}.md"
        template = root / 'tools/pipeline/prompts' / filename
        text = template.read_text(encoding='utf-8')
        for key, value in values.items():
            text = text.replace('{{' + key + '}}', value)
        path = directory / f'brief-{stage}.md'
        path.write_text(text, encoding='utf-8')
        return path
    def dispatch(stage, log, output=''):
        nonlocal serial, dispatch_limited
        dispatch_limited = False
        if STOP.is_set():
            return False, ''
        serial += 1
        out = directory / f'dispatch-{time.time_ns()}-{serial}'
        command = command_factory(args.reviewer if stage == 'review' else args.builder,
                                  brief(stage, output), root, out, args.timeout_min, stage == 'review')
        if args.dry_run:
            print(shlex.join(command)); return True, ''
        capture = DispatchLog(log)
        rc = executor(command, root, capture, args.timeout_min)
        result = read(out / 'result.json', {})
        ok = rc == 0 and result.get('status') == 'completed' and result.get('exitCode', 0) == 0 and not result.get('readOnlyViolation')
        dispatch_limited = not ok and not result.get('readOnlyViolation') and relay_usage_limited(
            out, capture.getvalue() + json.dumps(result, ensure_ascii=False))
        return ok, result.get('finalMessage', '')
    def gates(log):
        output, results = [], []
        paths = [root / f'.cache/records/{no}/records.v2.json', root / f'content/nasij/{no}.json']
        results.append(dict(gate='files', passed=all(p.is_file() for p in paths),
                            first_failing_lines=[f'Missing: {p.relative_to(root)}' for p in paths if not p.is_file()]))
        for label, command in [('records', ['python3', '-B', '.cache/records/108/check_v2.py', str(no)]),
                               ('export-check', ['python3', '-B', 'tools/export_content.py', str(no), '--check-only'])]:
            if args.dry_run:
                print(shlex.join(command)); continue
            # Gate output is also needed verbatim for the repair brief.
            capture = io.StringIO()
            rc = executor(command, root, capture, args.timeout_min)
            text = capture.getvalue()
            log.write('$ ' + shlex.join(command) + '\n' + text); log.flush()
            lines = text.splitlines()
            failing = [line for line in lines if re.search(r'FAIL|ERROR|Error|Traceback|missing', line, re.I)]
            results.append(dict(gate=label, passed=rc == 0, exit_code=rc,
                                first_failing_lines=(failing or lines)[:8] if rc else []))
            if rc:
                output.append(label + '\n' + text)
        output[:0] = results[0]['first_failing_lines']
        evaluation['gates'].append(results)
        return all(r['passed'] for r in results), '\n'.join(output)
    def stage_start(stage):
        evaluation['stages'][stage] = dict(started_at=now())
        return time.monotonic()
    def stage_end(stage, start):
        evaluation['stages'][stage].update(ended_at=now(), minutes=round((time.monotonic()-start)/60, 4))
    def export(log):
        command = ['python3', '-B', 'tools/export_content.py', str(no)]
        if args.dry_run:
            print(shlex.join(command)); return True
        # The exporter also updates its shared export/index.json.
        with EXPORT_LOCK:
            rc = 130 if STOP.is_set() else executor(command, root, log, args.timeout_min)
        if rc != 0:
            evaluation['status'] = 'failed-gates'
        return rc == 0
    with (directory / 'run.log').open('a', encoding='utf-8') as log:
        try:
            passed = False
            if 'build' in stages:
                start = stage_start('build')
                ok, _ = dispatch('build', log)
                if ok:
                    passed, output = gates(log)
                    for _ in range(args.max_fix_rounds):
                        if passed or args.dry_run or STOP.is_set():
                            break
                        evaluation['fix_rounds'] += 1
                        ok, _ = dispatch('fix', log, output)
                        if not ok:
                            break
                        passed, output = gates(log)
                    evaluation['status'] = 'passed' if passed else ('failed-gates' if ok else 'failed-dispatch')
                    if passed or args.dry_run:
                        passed = export(log)
                stage_end('build', start)
                evaluation['build_status'] = evaluation['status']
            else:
                passed, _ = gates(log)
                evaluation['status'] = 'passed' if passed else 'failed-gates'
                evaluation.setdefault('build_status', evaluation['status'])
            if 'review' in stages and (passed or args.dry_run):
                while True:
                    round_no = len(evaluation['review_rounds'])
                    stage = 'review' if round_no == 0 else f'review-{round_no}'
                    if cached_review is not None:
                        review = cached_review
                        cached_review = None
                        round_result = dict(round=round_no, reused=True)
                        evaluation['review_rounds'].append(round_result)
                    else:
                        start = stage_start(stage)
                        ok, report = dispatch('review', log)
                        stage_end(stage, start)
                        if args.dry_run:
                            break
                        (directory / 'review.txt').write_text(report, encoding='utf-8')
                        (directory / f'review-{round_no}.txt').write_text(report, encoding='utf-8')
                        round_result = dict(round=round_no, **evaluation['stages'][stage])
                        evaluation['review_rounds'].append(round_result)
                        if not ok:
                            status = 'review-pending' if dispatch_limited else 'failed-dispatch'
                            evaluation.update(status=status, review_status='pending' if dispatch_limited else 'failed')
                            round_result['status'] = status
                            break
                        try:
                            review = parse_review(report, no)
                        except (ValueError, TypeError, KeyError):
                            evaluation.update(review_status='unparsed', status='review-unparsed')
                            round_result['status'] = 'review-unparsed'
                            break
                    save(directory / 'review.json', review)
                    round_result.update(review, status='parsed', systemic=systemic_count(review))
                    evaluation['systemic'] = systemic_count(review)
                    evaluation['review_status'] = 'parsed'
                    evaluation['review'] = dict(scores=review['scores'], verdict=review['verdict'], systemic=systemic_count(review),
                        findings={s: sum(f['severity'] == s for f in review['findings']) for s in ('critical', 'major', 'minor')})
                    evaluation['status'] = 'passed' if review_passed(review) else 'review-failed'
                    if (stages == ['review'] or not needs_review_fix(review) or STOP.is_set() or
                            evaluation['review_fix_rounds'] >= args.max_review_rounds):
                        break
                    evaluation['review_fix_rounds'] += 1
                    fix_stage = f"fix-review-{evaluation['review_fix_rounds']}"
                    start = stage_start(fix_stage)
                    values['findings_json'] = json.dumps(fixable_findings(review), ensure_ascii=False, indent=2)
                    ok, _ = dispatch('fix-review', log)
                    if ok:
                        passed, _ = gates(log)
                        evaluation['status'] = 'passed' if passed else 'failed-gates'
                        if passed:
                            passed = export(log)
                    else:
                        passed = False
                        evaluation['status'] = 'failed-dispatch'
                    stage_end(fix_stage, start)
                    evaluation['build_status'] = evaluation['status']
                    if not passed:
                        break
        except (OSError, ValueError, subprocess.SubprocessError) as exc:
            evaluation['error'] = str(exc)
            evaluation['status'] = 'failed-dispatch'
            log.write(str(exc) + '\n')
        finally:
            if not args.dry_run:
                for timing in evaluation['stages'].values():
                    if 'ended_at' not in timing:
                        timing.update(ended_at=now(), minutes=(datetime.now(timezone.utc)-datetime.fromisoformat(timing['started_at'])).total_seconds()/60)
                try:
                    evaluation['content'] = content_counts(root, no)
                except (ValueError, TypeError, KeyError) as exc:
                    evaluation['content_error'] = str(exc)
                    evaluation['status'] = 'failed-gates'
                if STOP.is_set():
                    evaluation['status'] = 'failed-dispatch'
                    evaluation['interrupted'] = True
                evaluation['ended_at'] = now()
                evaluation['minutes'] = sum(t['minutes'] for t in evaluation['stages'].values())
                save(directory / 'eval.json', evaluation)
    print(f"{no}: {'dry-run' if args.dry_run else evaluation['status']}")
    return evaluation


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('surahs', type=int, nargs='+')
    p.add_argument('--builder', default='claude:think-pro')
    p.add_argument('--reviewer', default='codex:review')
    p.add_argument('--stages', default='build,review',
                   help='build, review, build,review, or review,fix (repair existing files without rebuilding)')
    p.add_argument('--max-fix-rounds', type=int, default=2)
    p.add_argument('--max-review-rounds', type=int, default=1,
                   help='Maximum builder repairs after review (review-only never dispatches the builder)')
    p.add_argument('--parallel', type=int, default=1)
    p.add_argument('--timeout-min', type=int, default=60)
    p.add_argument('--force', action='store_true')
    p.add_argument('--dry-run', action='store_true')
    return p


def main(argv=None):
    p = parser(); args = p.parse_args(argv)
    if args.parallel < 1 or args.timeout_min < 1 or args.max_fix_rounds < 0 or args.max_review_rounds < 0:
        p.error('invalid concurrency, timeout or fix limit')
    if args.stages not in ('build', 'review', 'review,fix', 'build,review') or any(not 1 <= n <= 114 for n in args.surahs):
        p.error('invalid stages or surah')
    for spec in (args.builder, args.reviewer):
        try:
            lane_command(spec, Path('brief'), ROOT, Path('out'), args.timeout_min)
        except (ValueError, KeyError) as exc:
            p.error(str(exc))
    STOP.clear()
    previous_handler = signal.signal(signal.SIGINT, lambda *_: STOP.set())
    try:
        with ThreadPoolExecutor(max_workers=args.parallel) as pool:
            futures = [pool.submit(run_surah, n, args) for n in dict.fromkeys(args.surahs)]
            evaluations = [f.result() for f in futures]
        return 130 if STOP.is_set() else int(not args.dry_run and any(e['status'] != 'passed' for e in evaluations))
    finally:
        signal.signal(signal.SIGINT, previous_handler)


if __name__ == '__main__':
    sys.exit(main())
