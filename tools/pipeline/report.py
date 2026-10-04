#!/usr/bin/env python3
"""Summarize private pipeline evaluations without reproducing source text."""
import argparse
from collections import Counter
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def render(root=ROOT):
    rows = []
    for path in (root / '.cache/pipeline').glob('*/eval.json'):
        rows.append(json.loads(path.read_text(encoding='utf-8')))
    rows.sort(key=lambda row: row['surah'])
    columns = ['Surah', 'Ayahs', 'Status', 'Minutes', 'Fix rounds', 'Records yes/pending/no',
               'Stops 0/1/2/3', 'Terms', 'Held', 'Review scores', 'Verdict', 'Critical/major/minor']
    lines = ['| ' + ' | '.join(columns) + ' |', '| ' + ' | '.join(['---'] * len(columns)) + ' |']
    total = Counter()
    scores = ('support', 'attribution', 'quote_fidelity', 'narration_handling', 'reader_pull')
    def joined(data, keys):
        return '/'.join(str(data.get(k, 0)) for k in keys)
    for row in rows:
        content, review = row.get('content', {}), row.get('review', {})
        values = [row['surah'], row['ayah_count'], row['status'], f"{row.get('minutes', 0):.2f}",
                  row.get('fix_rounds', 0), joined(content.get('records', {}), ('yes', 'pending', 'no')),
                  joined(content.get('stops', {}), ('0', '1', '2', '3')), content.get('terms', 0),
                  content.get('held', 0), joined(review['scores'], scores) if 'scores' in review else '-',
                  review.get('verdict', '-'), joined(review.get('findings', {}), ('critical', 'major', 'minor'))]
        lines.append('| ' + ' | '.join(map(str, values)) + ' |')
        for key in ('ayah_count', 'minutes', 'fix_rounds'):
            total[key] += row.get(key, 0)
        for key in ('terms', 'held'):
            total[key] += content.get(key, 0)
        for key, value in content.get('records', {}).items():
            total['records_' + key] += value
        for key, value in content.get('stops', {}).items():
            total['stops_' + key] += value
        for key, value in review.get('findings', {}).items():
            total['findings_' + key] += value
        total[row['status']] += 1
    values = ['Total', total['ayah_count'], str(len(rows)), f"{total['minutes']:.2f}", total['fix_rounds'],
              joined(total, ['records_' + k for k in ('yes', 'pending', 'no')]),
              joined(total, ['stops_' + str(k) for k in range(4)]), total['terms'], total['held'], '-', '-',
              joined(total, ['findings_' + k for k in ('critical', 'major', 'minor')])]
    lines.append('| ' + ' | '.join(map(str, values)) + ' |')
    lines += ['', 'Scores: support/attribution/quote fidelity/narration handling/reader pull.', '',
              'Status totals: ' + ', '.join(f'{s}={total[s]}' for s in ('passed', 'failed-gates', 'failed-dispatch', 'review-unparsed'))]
    return '\n'.join(lines) + '\n'


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--out', type=Path)
    args = p.parse_args(argv); text = render(); print(text, end='')
    if args.out:
        args.out.write_text(text, encoding='utf-8')


if __name__ == '__main__':
    main()
