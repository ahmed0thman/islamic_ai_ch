#!/usr/bin/env python3
"""WCAG 2.x contrast check for the Huda prototype palette (light and dark).
Run: python3 design/bakeoff/claude/contrast.py
Mixes use plain sRGB interpolation, the same as CSS color-mix(in srgb, ...)."""
import re, sys

def hx(s):
    s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))
def mix(a, b, pa):          # pa = share of a
    return tuple(round(a[i]*pa + b[i]*(1-pa)) for i in range(3))
def over(fg, alpha, bg):    # rgba over opaque
    return mix(fg, bg, alpha)
def lum(c):
    def f(v):
        v /= 255; return v/12.92 if v <= .03928 else ((v+.055)/1.055)**2.4
    r, g, b = map(f, c); return .2126*r + .7152*g + .0722*b
def ratio(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi+.05)/(lo+.05)

# source tones come from content/ui.ar.json (not ours to change)
TONES = {'ayah': '#2E7D32', 'hadith': '#1565C0', 'athar': '#6A1B9A', 'scholar': '#546E7A', 'link': '#B26A00', 'hidaya': '#AD1457',
         'thabit': '#607D8B', 'la_yathbut': '#B23B2E', 'khilaf': '#00838F'}

P = {
 'light': dict(bg='#F1EEE4', surface='#FBF9F3', surface2='#F3EFE3', ink='#1C2420', ink2='#46514A', ink3='#5E6962',
               accent='#14472F', on_accent='#F4F0E2', gold='#9F7D27', gold_strong='#7A5C12', on_gold='#1C1608',
               stage_a='#14402F', stage_b='#0B271C', stage_ink='#F2EDDD', stage_mute='#A9C4B0', gold_stage='#D9BC77'),
 'dark':  dict(bg='#14161A', surface='#1A1D22', surface2='#1F232A', ink='#ECE8DE', ink2='#A9AEB6', ink3='#8A9098',
               accent='#7FC49C', on_accent='#0B271C', gold='#C9A95C', gold_strong='#D9BC77', on_gold='#1A1608',
               stage_a='#133B2B', stage_b='#0B271C', stage_ink='#F2EDDD', stage_mute='#A9C4B0', gold_stage='#D9BC77'),
}
LINE = {'light': ('#1C2420', .13, .50), 'dark': ('#ECE8DE', .14, .50)}  # last value = --border-ui alpha

def run(mode, out):
    p = {k: hx(v) for k, v in P[mode].items()}
    bg, sf, s2, ink = p['bg'], p['surface'], p['surface2'], p['ink']
    accent_soft_bg = mix(p['accent'], bg, .12)
    rows = []  # (label, fg, bg, need)
    T, L, N = 4.5, 3.0, 3.0
    for nm, b in (('bg', bg), ('surface', sf), ('surface-2', s2)):
        rows += [(f'ink on {nm}', ink, b, T), (f'ink-2 on {nm}', p['ink2'], b, T), (f'ink-3 on {nm} (labels)', p['ink3'], b, T)]
    rows += [('accent text on bg (terms, kicker)', p['accent'], bg, T), ('accent text on surface', p['accent'], sf, T),
             ('accent text on accent-soft (scope row)', p['accent'], accent_soft_bg, T),
             ('on-accent on accent (next card, buttons)', p['on_accent'], p['accent'], T),
             ('accent as UI element vs bg (branch, dots)', p['accent'], bg, N),
             ('gold-strong text on bg (ayah number, large bold)', p['gold_strong'], bg, T),
             ('gold-strong text on surface', p['gold_strong'], sf, T),
             ('gold decor vs bg (thread fill, ring)', p['gold'], bg, N),
             ('gold decor vs surface (medal ring)', p['gold'], sf, N),
             ('on-gold on gold (current bead)', p['on_gold'], p['gold'], T),
             ('stage-ink on stage-a', p['stage_ink'], p['stage_a'], T), ('stage-ink on stage-b', p['stage_ink'], p['stage_b'], T),
             ('stage-mute on stage-a', p['stage_mute'], p['stage_a'], T),
             ('gold-stage text on stage-a (ayah gem)', p['gold_stage'], p['stage_a'], T),
             ('gold-stage text on stage-b', p['gold_stage'], p['stage_b'], T)]
    lc, la, lb = LINE[mode]; lcc = hx(lc)
    rows += [('border-ui vs bg (control borders)', over(lcc, lb, bg), bg, N), ('border-ui vs surface', over(lcc, lb, sf), sf, N)]
    # source chips and badges: glyph/text = mix(tone 55%, ink), background = tone 22% over surface (chip on door/surface)
    for k, t in TONES.items():
        tc = hx(t); fg = mix(tc, ink, .55)
        for nm, b in (('surface', sf), ('bg', bg)):
            chip = mix(tc, b, .22)
            need = T if k in ('thabit', 'la_yathbut', 'khilaf') else N   # badges carry text, icon chips are glyphs
            rows.append((f'{k} glyph/text on its chip over {nm}', fg, chip, need))
        # q-ayah tint region for the green ayah tone: body ink on tinted block
    ayah_block = mix(hx(TONES['ayah']), sf, .11); rows.append(('ink on inline-ayah block', ink, ayah_block, T))
    fails = 0
    out.append(f'## {mode}')
    for label, fg, b, need in rows:
        r = ratio(fg, b); ok = r >= need; fails += (not ok)
        out.append(f'{"ok  " if ok else "FAIL"} {r:5.2f} (need {need})  {label}')
    out.append(f'-> {fails} failing pairs in {mode}\n')
    return fails

if __name__ == '__main__':
    o = []; f = run('light', o) + run('dark', o); print('\n'.join(o)); sys.exit(1 if f else 0)
