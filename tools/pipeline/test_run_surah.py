#!/usr/bin/env python3
"""Offline runner tests. Fixtures are retained under tools/pipeline/.cache/."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

import run_surah as runner
import report


class RunnerTests(unittest.TestCase):
    def setUp(self):
        runner.STOP.clear()
        base = runner.ROOT / 'tools/pipeline/.cache/test-fixtures'
        base.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(dir=base))
        self.put('tools/data/qurancomplex/hafsData_v2-0.json', [
            dict(sura_no=99, sura_name_ar='Fixture', aya_no=i) for i in (1, 2)])
        self.put('.delegate/config.json', dict(lanes={
            'think-pro': dict(implementer='claude'), 'review': dict(implementer='codex')}))
        for stage, language in (('build', 'ar'), ('fix', 'ar'), ('review', 'en')):
            self.write(f'tools/pipeline/prompts/{stage}-surah.{language}.md',
                       '{{surah_no}} {{surah_name}} {{ayah_count}}\n{{gate_output}}')
        self.write('tools/pipeline/prompts/fix-review.ar.md',
                   '{{surah_no}} {{surah_name}}\n{{findings_json}}')
        self.write('.cache/records/108/check_v2.py',
                   "from pathlib import Path\nimport sys\nready=Path('ready').exists()\nprint('PASS' if ready else 'FAIL fixture gate')\nsys.exit(0 if ready else 1)\n")
        self.write('tools/export_content.py',
                   "from pathlib import Path\nimport sys\ncheck='--check-only' in sys.argv\nready=Path('ready').exists()\nprint('PASS' if ready else 'FAIL export gate')\nif ready and not check:\n with Path('exported').open('a') as f: f.write('yes')\nsys.exit(0 if ready else 1)\n")
        self.write('fake_relay.py', '''import argparse,json
from pathlib import Path
p=argparse.ArgumentParser()
for name in ('lane','brief','cd','timeout','out-dir'):p.add_argument('--'+name)
p.add_argument('--read-only',action='store_true')
a=p.parse_args();root=Path(a.cd);out=Path(a.out_dir);out.mkdir(parents=True)
stage=Path(a.brief).stem.replace('brief-','');mode=(root/'mode').read_text()
with (root/'calls').open('a') as f:f.write(stage+' '+str(a.read_only)+'\\n')
rc=1 if mode=='dispatch-fail' else 0
if stage in ('build','fix','fix-review'):
 if mode!='repair' or stage=='fix':(root/'ready').write_text('yes')
message='unparsed'
if stage=='review' and mode!='unparsed':
 d=dict(surah=99,sampled={k:1 for k in ('sentences','titles','terms','narrations','depth_items')},scores={k:5 for k in ('support','attribution','quote_fidelity','narration_handling','reader_pull')},findings=[],verdict='ship')
 message='summary\\n```json\\n{}\\n```\\n```json\\n'+json.dumps(d)+'\\n```'
 if (root/'reviews.json').exists():
  reviews=json.loads((root/'reviews.json').read_text())
  index=int((root/'review-count').read_text()) if (root/'review-count').exists() else 0
  d=reviews[min(index,len(reviews)-1)]
  (root/'review-count').write_text(str(index+1))
  message='```json\\n'+json.dumps(d)+'\\n```'
if stage=='fix-review' and mode=='review-gate-fail':(root/'ready').rename(root/'not-ready')
if stage=='fix-review' and mode=='review-fix-dispatch-fail':rc=1
if stage=='review' and mode in ('usage-limit','review-dispatch-fail','usage-log','usage-events','usage-stderr'):
 rc=1
 message='You have hit your usage limit' if mode=='usage-limit' else 'dispatch error'
 if mode=='usage-log':print('quota exhausted; try again later')
 if mode=='usage-stderr':(out/'stderr.txt').write_text('usage limit reached')
 if mode=='usage-events':
  message=''
  (out/'events.jsonl').write_text(json.dumps(dict(type='error',message='You have hit your usage limit'))+'\\n'+json.dumps(dict(type='turn.failed',error=dict(message='usage limit')))+'\\n')
if stage=='review' and mode=='usage-after-fix' and 'fix-review' in (root/'calls').read_text():
 rc=1
 message='usage limit reached'
(out/'result.json').write_text(json.dumps(dict(status='completed' if rc==0 else 'failed',exitCode=rc,finalMessage=message)))
print('fake dispatch '+stage)
raise SystemExit(rc)
''')
        yes, pending, no = tuple(runner.DECISIONS)
        self.put('.cache/records/99/records.v2.json', dict(records=[
            dict(build_permission=dict(decision=value), display=dict(decision=yes), evidence=[
                dict(icon='hadith', build_permission=dict(decision=value))]) for value in (yes, pending, no)]))
        self.put('content/nasij/99.json', dict(passages=[dict(id='p1')], held=[{}, {}], levels=[
            dict(depth=0, blocks=[dict(type='paragraph', title='One stop', segments=[dict(t='text', v='three sample words')])]),
            dict(depth=1, blocks=[dict(type='paragraph', title='Stop', segments=[dict(t='term', v='Term', record='t1')])]),
            dict(depth=3, blocks=[dict(type='details', title=[], blocks=[])])]))
        self.write('mode', 'success')
        self.args = runner.parser().parse_args(['99'])

    def write(self, name, text):
        p = self.root / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)

    def put(self, name, data):
        self.write(name, json.dumps(data))

    def command(self, spec, brief, root, out, timeout, review):
        real = runner.lane_command(spec, brief, root, out, timeout, review)
        return [sys.executable, '-B', str(root/'fake_relay.py')] + real[2:]

    def run_fixture(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return runner.run_surah(99, self.args, root=self.root, command_factory=self.command)

    def review(self, verdict='ship', findings=None, score=5):
        return dict(surah=99, sampled={k: 1 for k in runner.SAMPLED},
                    scores={k: score for k in runner.SCORES}, verdict=verdict, findings=findings or [])

    def finding(self, severity='major', kind='unsupported', where='term definition'):
        result = dict(severity=severity, level=1, where=where, records=['99-r01'],
                      problem='Unsupported word', fix='Remove unsupported word')
        if kind is not None:
            result['kind'] = kind
        return result

    def test_success_counts_review_and_resume(self):
        e = self.run_fixture()
        self.assertEqual(e['status'], 'passed')
        self.assertEqual(e['content']['records'], dict(yes=1, pending=1, no=1, unknown=0))
        self.assertEqual(e['content']['display']['yes'], 3)
        self.assertEqual(e['content']['narration_evidence']['pending'], 1)
        self.assertEqual(e['content']['stops'], {'0':1,'1':1,'2':0,'3':0})
        for key, value in dict(passages=1, terms=1, held=2, depth_items=1, level0_words=5).items():
            self.assertEqual(e['content'][key], value)
        self.assertEqual(set(e['stages']), {'build','review'})
        self.assertEqual(e['review']['verdict'], 'ship')
        self.assertEqual((self.root/'calls').read_text(), 'build False\nreview True\n')
        self.assertTrue((self.root/'exported').exists())
        before=(self.root/'calls').read_text(); self.run_fixture()
        self.assertEqual((self.root/'calls').read_text(), before)
        self.args.force=True; self.run_fixture()
        self.assertEqual(len((self.root/'calls').read_text().splitlines()), 4)
        self.assertIn('| 99 | 2 | passed |', report.render(self.root))

    def test_gate_failure_then_fix(self):
        self.write('mode', 'repair'); e=self.run_fixture()
        self.assertEqual(e['status'], 'passed'); self.assertEqual(e['fix_rounds'], 1)
        self.assertFalse(e['gates'][0][1]['passed']); self.assertTrue(e['gates'][1][1]['passed'])
        self.assertIn('FAIL fixture gate', (self.root/'.cache/pipeline/99/brief-fix.md').read_text())
        self.assertEqual((self.root/'calls').read_text(), 'build False\nfix False\nreview True\n')

    def test_failed_gates_stop_review(self):
        self.write('mode', 'repair'); self.args.max_fix_rounds=0
        e=self.run_fixture(); self.assertEqual(e['status'], 'failed-gates')
        self.assertEqual((self.root/'calls').read_text(), 'build False\n')

    def test_dispatch_failure(self):
        self.write('mode', 'dispatch-fail'); e=self.run_fixture()
        self.assertEqual(e['status'], 'failed-dispatch'); self.assertEqual(e['gates'], [])
        self.assertFalse((self.root/'exported').exists())

    def test_unparsed_review(self):
        self.write('mode', 'unparsed'); e=self.run_fixture()
        self.assertEqual(e['status'], 'review-unparsed'); self.assertEqual(e['review_status'], 'unparsed')
        self.assertFalse((self.root/'.cache/pipeline/99/review.json').exists())
        self.assertEqual((self.root/'.cache/pipeline/99/review.txt').read_text(), 'unparsed')

    def test_dry_run(self):
        self.args.dry_run=True
        self.run_fixture()
        self.assertFalse((self.root/'calls').exists())
        self.assertFalse((self.root/'.cache/pipeline/99/eval.json').exists())
        for stage in ('build','review'):
            self.assertIn('99 Fixture 2', (self.root/f'.cache/pipeline/99/brief-{stage}.md').read_text())

    def test_review_only_requires_gates(self):
        self.args.stages='review'; self.assertEqual(self.run_fixture()['status'], 'failed-gates')
        self.assertFalse((self.root/'calls').exists())
        self.write('ready','yes'); self.assertEqual(self.run_fixture()['status'], 'passed')
        self.assertEqual((self.root/'calls').read_text(), 'review True\n')

    def test_interruption_keeps_failed_evaluation(self):
        def interrupted(command, root, log, timeout):
            runner.STOP.set()
            return 130
        with contextlib.redirect_stdout(io.StringIO()):
            e = runner.run_surah(99, self.args, root=self.root, command_factory=self.command, executor=interrupted)
        self.assertEqual(e['status'], 'failed-dispatch')
        self.assertTrue(e['interrupted'])
        self.assertIn('ended_at', e['stages']['build'])
        self.assertEqual(runner.read(self.root/'.cache/pipeline/99/eval.json')['status'], 'failed-dispatch')

    def test_strict_review_validation(self):
        for text in ('', '```json\n{}\n```', '```json\n[]\n```'):
            with self.assertRaises(ValueError):runner.parse_review(text,99)

    def test_review_fix_then_ship_records_both_rounds(self):
        findings = [self.finding('critical'), self.finding(), self.finding(kind='review-status')]
        first = self.review('do-not-ship', findings, score=3)
        last = self.review()
        self.put('reviews.json', [first, last])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'passed')
        self.assertEqual(e['build_status'], 'passed')
        self.assertEqual(e['review_fix_rounds'], 1)
        self.assertEqual(len(e['gates']), 2)
        self.assertEqual((self.root/'exported').read_text(), 'yesyes')
        self.assertEqual((self.root/'calls').read_text(),
                         'build False\nreview True\nfix-review False\nreview True\n')
        for round_no, review in enumerate((first, last)):
            self.assertEqual(e['review_rounds'][round_no]['scores'], review['scores'])
            self.assertEqual(e['review_rounds'][round_no]['findings'], review['findings'])
            self.assertEqual(e['review_rounds'][round_no]['verdict'], review['verdict'])
        brief = (self.root/'.cache/pipeline/99/brief-fix-review.md').read_text()
        self.assertTrue(brief.startswith('99 Fixture\n'))
        self.assertEqual(json.loads(brief.split('\n', 1)[1]), findings[:2])
        self.assertEqual(runner.read(self.root/'.cache/pipeline/99/review.json'), last)
        self.assertEqual(runner.read(self.root/'.cache/pipeline/99/eval.json'), e)
        self.assertIn('Review rounds', report.render(self.root))
        self.assertIn('Last verdict', report.render(self.root))
        self.assertIn('| 0 | 2 | 1/1/1 |', report.render(self.root))
        self.assertIn('| 5/5/5/5/5 | ship | 0/0/0 |', report.render(self.root))

    def test_major_finding_with_ship_verdict_triggers_fix(self):
        self.put('reviews.json', [self.review(findings=[self.finding()]), self.review()])
        self.assertEqual(self.run_fixture()['review_fix_rounds'], 1)

    def test_critical_finding_with_ship_verdict_triggers_fix(self):
        self.put('reviews.json', [self.review(findings=[self.finding('critical')]), self.review()])
        self.assertEqual(self.run_fixture()['review_fix_rounds'], 1)

    def test_non_ship_minor_finding_triggers_fix(self):
        self.put('reviews.json', [self.review('fix-then-ship', [self.finding('minor', 'opening')]), self.review()])
        self.assertEqual(self.run_fixture()['review_fix_rounds'], 1)

    def test_non_ship_without_findings_triggers_fix(self):
        self.put('reviews.json', [self.review('fix-then-ship'), self.review()])
        self.assertEqual(self.run_fixture()['review_fix_rounds'], 1)

    def test_review_fix_default_limit_leaves_unresolved_review_failed(self):
        self.put('reviews.json', [self.review('do-not-ship', [self.finding('critical')])])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'review-failed')
        self.assertEqual(e['build_status'], 'passed')
        self.assertEqual(e['review_fix_rounds'], 1)
        self.assertEqual(len(e['review_rounds']), 2)
        before = (self.root/'calls').read_text()
        self.run_fixture()
        self.assertGreater(len((self.root/'calls').read_text()), len(before))

    def test_review_fix_configurable_limit(self):
        self.args.max_review_rounds = 2
        bad = self.review('fix-then-ship', [self.finding()])
        self.put('reviews.json', [bad, bad, self.review()])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'passed')
        self.assertEqual(e['review_fix_rounds'], 2)
        self.assertEqual(len(e['review_rounds']), 3)
        self.assertIn('fix-review-2', e['stages'])

    def test_zero_review_fix_rounds(self):
        self.args.max_review_rounds = 0
        self.put('reviews.json', [self.review('fix-then-ship', [self.finding()])])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'review-failed')
        self.assertEqual(e['review_fix_rounds'], 0)
        self.assertEqual((self.root/'calls').read_text(), 'build False\nreview True\n')

    def test_ship_with_only_minor_findings_does_not_fix(self):
        self.put('reviews.json', [self.review(findings=[self.finding('minor', 'opening')])])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'passed')
        self.assertEqual(e['review_fix_rounds'], 0)

    def test_systemic_findings_do_not_dispatch_fixes(self):
        self.put('reviews.json', [self.review('do-not-ship', [self.finding('critical', 'review-status')])])
        e = self.run_fixture()
        self.assertEqual(e['review_fix_rounds'], 0)
        self.assertEqual(e['status'], 'review-failed')
        self.assertEqual(len(e['review_rounds'][0]['findings']), 1)

    def test_legacy_completion_status_is_ignored(self):
        self.put('reviews.json', [self.review('fix-then-ship', [
            self.finding(kind=None, where='Records: Completion Status')])])
        self.assertEqual(self.run_fixture()['review_fix_rounds'], 0)

    def test_kind_takes_precedence_over_legacy_location(self):
        self.put('reviews.json', [self.review('fix-then-ship', [
            self.finding(where='completion status')]), self.review()])
        self.assertEqual(self.run_fixture()['review_fix_rounds'], 1)

    def test_review_fix_gate_failure_stops_review(self):
        self.write('mode', 'review-gate-fail')
        self.put('reviews.json', [self.review('fix-then-ship', [self.finding()])])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'failed-gates')
        self.assertEqual(len(e['review_rounds']), 1)
        self.assertFalse(e['gates'][-1][1]['passed'])

    def test_review_fix_dispatch_failure(self):
        self.write('mode', 'review-fix-dispatch-fail')
        self.put('reviews.json', [self.review('fix-then-ship', [self.finding()])])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'failed-dispatch')
        self.assertEqual(len(e['review_rounds']), 1)
        self.assertEqual(len(e['gates']), 1)

    def test_review_only_runs_even_after_passed_without_build_or_fix(self):
        first = self.run_fixture()
        records = (self.root/'.cache/records/99/records.v2.json').read_bytes()
        nasij = (self.root/'content/nasij/99.json').read_bytes()
        self.args.stages = 'review'
        self.put('reviews.json', [self.review('fix-then-ship', [self.finding()])])
        e = self.run_fixture()
        self.assertEqual((self.root/'calls').read_text(), 'build False\nreview True\nreview True\n')
        self.assertEqual(e['status'], 'review-failed')
        self.assertEqual(e['review_fix_rounds'], 0)
        self.assertEqual(e['stages']['build'], first['stages']['build'])
        self.assertEqual(len(e['review_rounds']), 2)
        self.assertEqual((self.root/'.cache/records/99/records.v2.json').read_bytes(), records)
        self.assertEqual((self.root/'content/nasij/99.json').read_bytes(), nasij)
        self.assertEqual((self.root/'exported').read_text(), 'yes')

    def test_usage_limit_keeps_build_and_can_retry_review_only(self):
        self.write('mode', 'usage-limit')
        e = self.run_fixture()
        self.assertEqual(e['status'], 'review-pending')
        self.assertEqual(e['review_status'], 'pending')
        self.assertEqual(e['build_status'], 'passed')
        self.assertTrue((self.root/'exported').exists())
        self.assertEqual(e['review_rounds'][0]['status'], 'review-pending')
        self.assertIn('review-pending=1', report.render(self.root))
        self.args.stages = 'review'
        self.write('mode', 'success')
        retry = self.run_fixture()
        self.assertEqual(retry['status'], 'passed')
        self.assertEqual(retry['stages']['build'], e['stages']['build'])
        self.assertEqual((self.root/'calls').read_text(), 'build False\nreview True\nreview True\n')
        self.assertEqual(len(retry['review_rounds']), 2)

    def test_usage_limit_in_dispatch_log(self):
        self.write('mode', 'usage-log')
        self.assertEqual(self.run_fixture()['status'], 'review-pending')

    def test_usage_limit_in_relay_events_with_empty_final_message(self):
        self.write('mode', 'usage-events')
        self.assertEqual(self.run_fixture()['status'], 'review-pending')

    def test_usage_limit_in_relay_stderr(self):
        self.write('mode', 'usage-stderr')
        self.assertEqual(self.run_fixture()['status'], 'review-pending')

    def test_usage_limit_after_fix_keeps_last_verdict_and_repaired_build(self):
        self.write('mode', 'usage-after-fix')
        self.put('reviews.json', [self.review('do-not-ship', [self.finding('critical')])])
        e = self.run_fixture()
        self.assertEqual(e['status'], 'review-pending')
        self.assertEqual(e['build_status'], 'passed')
        self.assertEqual(e['review']['verdict'], 'do-not-ship')
        self.assertEqual(len(e['review_rounds']), 2)
        self.assertEqual(e['review_rounds'][-1]['status'], 'review-pending')
        self.assertEqual((self.root/'exported').read_text(), 'yesyes')
        self.assertIn('| do-not-ship | 1/0/0 |', report.render(self.root))

    def test_source_text_in_relay_events_is_not_a_usage_error(self):
        out = self.root/'diagnostics'
        self.write('diagnostics/events.jsonl', json.dumps(dict(type='item.completed',
                   item=dict(type='agent_message', text='Check the usage limit documentation')))+'\n')
        self.assertFalse(runner.relay_usage_limited(out, 'failed dispatch'))

    def test_other_review_dispatch_errors_stay_failed(self):
        self.write('mode', 'review-dispatch-fail')
        e = self.run_fixture()
        self.assertEqual(e['status'], 'failed-dispatch')
        self.assertEqual(e['build_status'], 'passed')

    def test_finding_kind_validation_and_legacy_compatibility(self):
        for kind in (*runner.FINDING_KINDS, None):
            d = self.review(findings=[self.finding(kind=kind)])
            self.assertEqual(runner.parse_review('```json\n'+json.dumps(d)+'\n```', 99), d)
        for kind in ('unknown', 1, []):
            d = self.review(findings=[self.finding(kind=kind)])
            with self.assertRaisesRegex(ValueError, 'kind'):
                runner.parse_review('```json\n'+json.dumps(d)+'\n```', 99)

    def test_negative_review_round_limit_rejected(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            runner.main(['99', '--max-review-rounds', '-1'])
        self.assertEqual(error.exception.code, 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
