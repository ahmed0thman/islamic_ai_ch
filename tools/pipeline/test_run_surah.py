#!/usr/bin/env python3
"""Offline runner tests. Fixtures are retained under .cache/pipeline/."""
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
        base = runner.ROOT / '.cache/pipeline/test-fixtures'
        base.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(dir=base))
        self.put('tools/data/qurancomplex/hafsData_v2-0.json', [
            dict(sura_no=99, sura_name_ar='Fixture', aya_no=i) for i in (1, 2)])
        self.put('.delegate/config.json', dict(lanes={
            'think-pro': dict(implementer='claude'), 'review': dict(implementer='codex')}))
        for stage, language in (('build', 'ar'), ('fix', 'ar'), ('review', 'en')):
            self.write(f'tools/pipeline/prompts/{stage}-surah.{language}.md',
                       '{{surah_no}} {{surah_name}} {{ayah_count}}\n{{gate_output}}')
        self.write('.cache/records/108/check_v2.py',
                   "from pathlib import Path\nimport sys\nready=Path('ready').exists()\nprint('PASS' if ready else 'FAIL fixture gate')\nsys.exit(0 if ready else 1)\n")
        self.write('tools/export_content.py',
                   "from pathlib import Path\nimport sys\ncheck='--check-only' in sys.argv\nready=Path('ready').exists()\nprint('PASS' if ready else 'FAIL export gate')\nif ready and not check: Path('exported').write_text('yes')\nsys.exit(0 if ready else 1)\n")
        self.write('fake_relay.py', '''import argparse,json
from pathlib import Path
p=argparse.ArgumentParser()
for name in ('lane','brief','cd','timeout','out-dir'):p.add_argument('--'+name)
p.add_argument('--read-only',action='store_true')
a=p.parse_args();root=Path(a.cd);out=Path(a.out_dir);out.mkdir(parents=True)
stage=Path(a.brief).stem.replace('brief-','');mode=(root/'mode').read_text()
with (root/'calls').open('a') as f:f.write(stage+' '+str(a.read_only)+'\\n')
rc=1 if mode=='dispatch-fail' else 0
if stage in ('build','fix'):
 if mode!='repair' or stage=='fix':(root/'ready').write_text('yes')
message='unparsed'
if stage=='review' and mode!='unparsed':
 d=dict(surah=99,sampled={k:1 for k in ('sentences','titles','terms','narrations','depth_items')},scores={k:5 for k in ('support','attribution','quote_fidelity','narration_handling','reader_pull')},findings=[],verdict='ship')
 message='summary\\n```json\\n{}\\n```\\n```json\\n'+json.dumps(d)+'\\n```'
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


if __name__ == '__main__':
    unittest.main(verbosity=2)
