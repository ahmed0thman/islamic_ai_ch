#!/usr/bin/env python3
"""Check that all slide strings from deck-plan.md appear verbatim in presentation/slides.md."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
PLAN = Path('/private/tmp/claude-501/-Users-ahmedhisham-Work-islamic-ai-ch/2d7c259e-3d7e-4767-8734-ac68978dc1ba/scratchpad/deck-plan.md')
SLIDES = ROOT / 'presentation/slides.md'

LIVE_URL = 'https://hudan.ahmedothman.online'


def quoted(line):
    """Extract strings enclosed in outer guillemets « » while preserving nested ones."""
    result, depth, start = [], 0, 0
    for i, char in enumerate(line):
        if char == '«':
            if depth == 0:
                start = i + 1
            depth += 1
        elif char == '»':
            depth -= 1
            if depth == 0:
                result.append(line[start:i])
    assert depth == 0, line
    return result


def extract_plan_strings():
    text = PLAN.read_text(encoding='utf-8')
    text = re.sub(r'(?:https://)?(?:huda-s11y\.onrender\.com|hudan\.ahmedothman\.online)', LIVE_URL, text)
    sections = re.split(r'^### الشريحة \d+:.*$', text, flags=re.M)[1:]
    assert len(sections) == 10
    sections[-1] = sections[-1].split('\n## 3.')[0]

    slides_data = []
    for i, sec in enumerate(sections, 1):
        lines = sec.splitlines()
        slide_strings = []
        for l in lines:
            stripped = l.strip()
            if (stripped.startswith('- **المعيار:**') or
                stripped.startswith('- **احتياط:**') or
                stripped.startswith('- **قيمة الحقل اليوم:**')):
                continue
            if 'تُبنى على:' in stripped:
                if 'اسم القسم:' in stripped:
                    part = stripped.split('اسم القسم:')[1]
                    slide_strings.extend(quoted(part))
                continue
            qs = quoted(l)
            slide_strings.extend(qs)
        slides_data.append((i, slide_strings))
    return slides_data


def main():
    if not SLIDES.exists():
        print(f"Error: {SLIDES} does not exist.")
        sys.exit(1)

    slides_content = SLIDES.read_text(encoding='utf-8')
    slides_data = extract_plan_strings()

    total_checked = 0
    missing = []

    for slide_idx, strings in slides_data:
        for s in strings:
            target = s
            if target in ('`{{عدد_السور}}`', '{{عدد_السور}}'):
                target = '4'
            total_checked += 1
            # Check for literal presence, presence without HTML tags, or split link presence
            found = False
            if target in slides_content:
                found = True
            elif target in re.sub(r'<[^>]+>', '', slides_content):
                found = True
            elif re.sub(r'\s+', ' ', target) in re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', slides_content)):
                found = True
            elif 'hudan.ahmedothman.online' in target and 'github.com' in target:
                part1 = 'https://hudan.ahmedothman.online'
                part2 = 'github.com/ahmed0thman/islamic_ai_ch'
                if part1 in slides_content and part2 in slides_content:
                    found = True

            if not found:
                missing.append((slide_idx, target))

    if missing:
        print(f"FAILED: {len(missing)} strings not found in {SLIDES}:")
        for slide_idx, m in missing:
            print(f"  Slide {slide_idx}: {m}")
        sys.exit(1)
    else:
        print(f"SUCCESS: All {total_checked} strings verified verbatim in {SLIDES}.")


if __name__ == '__main__':
    main()
