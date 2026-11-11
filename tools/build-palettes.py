#!/usr/bin/env python3
"""Цветовые темы моно: фиолетовая, зелёная, бургунди.

Скрипт читает Mono/Web/style.css, находит все фиолетовые цвета акцента и пишет
Mono/Web/palettes.css с правилами для html[data-palette=...]:
  purple   — прежний лавандовый фон, акцент фиолетовый (как было раньше);
  green    — то же, но все фиолетовые оттенки перекрашены в зелёные;
  burgundy — то же в оттенках бургунди.

Запускать после любых правок цветов в style.css:
    pip install tinycss2 && python3 tools/build-palettes.py
"""
import colorsys
import pathlib
import re

import tinycss2

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'Mono/Web/style.css'
OUT = ROOT / 'Mono/Web/palettes.css'

# Прежний лавандовый фон (было в style.css до перехода на серебристый)
LAVENDER = {
    '--paper': '#ece6ff', '--ink': '#1b1740', '--muted': '#7a74a3', '--line': 'rgba(112,92,214,.16)',
    '--soft': '#e5defd', '--bar': '#ddd5f7', '--card-solid': '#f6f3ff', '--shadow': 'rgba(101,81,220,.16)',
    '--surface': 'rgba(255,255,255,.62)', '--input': 'rgba(255,255,255,.74)', '--glass': 'rgba(255,255,255,.72)',
    '--card-edge': 'rgba(255,255,255,.85)', '--glow': 'rgba(120,92,255,.35)',
    '--bg1': '#f4f0ff', '--bg2': '#e6dcff', '--bg3': '#d9d1fb',
    '--blob-a': 'rgba(139,108,255,.5)', '--blob-b': 'rgba(176,160,255,.42)', '--blob-c': 'rgba(150,170,255,.38)',
    '--wave': 'rgba(255,255,255,.55)',
    '--depth-bg': 'linear-gradient(160deg,rgba(255,255,255,.94) 0%,rgba(246,243,255,.86) 46%,rgba(234,228,255,.82) 100%)',
    '--chip-bg': 'linear-gradient(150deg,#ffffff,#ebe6fb)',
}

# Чёрная тема (на основе тёмной): настоящий чёрный фон для OLED-экранов, акцент фирменный
BLACK = {
    '--paper': '#000000', '--ink': '#f2f2f5', '--muted': '#9a9aa6', '--line': 'rgba(255,255,255,.1)',
    '--soft': '#1a1a1d', '--bar': '#2a2a2f', '--card-solid': '#111113', '--card-edge': 'rgba(255,255,255,.1)',
    '--glass': 'rgba(16,16,18,.84)', '--surface': 'rgba(255,255,255,.04)', '--input': 'rgba(255,255,255,.07)',
    '--shadow': 'rgba(0,0,0,.6)', '--bg1': '#0a0a0b', '--bg2': '#000000', '--bg3': '#000000',
    '--blob-a': 'rgba(255,255,255,.05)', '--blob-b': 'rgba(255,255,255,.03)', '--blob-c': 'rgba(255,255,255,.04)',
    '--wave': 'rgba(255,255,255,.05)',
    '--depth-bg': 'linear-gradient(160deg,rgba(30,30,33,.92) 0%,rgba(17,17,19,.92) 48%,rgba(8,8,9,.94) 100%)',
    '--depth-edge': 'rgba(255,255,255,.08)', '--chip-bg': 'linear-gradient(150deg,#26262a,#141416)',
}

PALETTES = {
    # имя: (оттенок в градусах, насыщенность средних тонов, яркость средних тонов, насыщенность светлых тонов фона)
    'purple': None,
    'green': (152, 0.62, 0.66, 0.5),
    'burgundy': (343, 0.6, 0.58, 0.42),
    'blue': (210, 0.72, 0.8, 0.55),
}
# Чёрная тема — монохром: фиолетовые оттенки становятся серыми, акцент белый
MONO_ACCENT = {
    '--accent': '#f2f2f4', '--accent-2': '#ffffff', '--glow': 'rgba(255,255,255,.18)',
    '--btn-grad': 'linear-gradient(135deg,#ffffff,#cfcfd4)',
    '--sphere': 'radial-gradient(circle at 34% 28%,#ffffff 0%,#dcdce0 45%,#9c9ca3 100%)',
}
# на белых кнопках и плашках — тёмный текст и значки
MONO_DARK_FG = ['.primary', 'button.primary', 'a.premium-button', '.currency-tabs .active', '.record-button',
    '.operations-tools .record-button', '.mic', '.segmented .active', '.operations-switch .active',
    '.chart-seg button[aria-pressed=true]', '.delete-undo button', '.pull-hint.ready', '.is-open .agenda-cal-icon',
    '.premium-lock-icon', '.premium-status .premium-spark', '.reward-net.on', '.notify-row input:checked']
BASE_HUE = 250

HEX = re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
RGB = re.compile(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+%?)\s*)?\)')


LOOSE = False  # для лавандового фона: ловим и бледные, и сероватые лиловые тона


def is_purple(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if LOOSE:
        return s > 0.1 and 225 <= h * 360 <= 292
    return s > 0.3 and 236 <= h * 360 <= 292 and 0.04 < l < 0.97


def shift(r, g, b, palette):
    if palette == 'black':
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if 0.4 <= l < 0.78:
            l = 0.88  # яркие тона акцента — светло-серые
        elif l < 0.4:
            l = min(l, 0.2)  # тёмные фиолетовые фоны — почти чёрные
        v = round(l * 255)
        return v, v, v
    hue, sat, light, sat_light = PALETTES[palette]
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    h = ((h * 360 - BASE_HUE + hue) % 360) / 360
    if l >= 0.78:
        s = min(1, s * sat_light)  # светлые тона фона — спокойнее
    else:
        s = min(1, s * sat)
    if 0.22 < l < 0.78:
        l = l * light
    r2, g2, b2 = (round(x * 255) for x in colorsys.hls_to_rgb(h, l, s))
    return r2, g2, b2


def recolor(value, palette):
    """Возвращает (новое значение, были ли фиолетовые цвета)."""
    found = False

    def hex_sub(m):
        nonlocal found
        x = m.group(1)
        if len(x) == 3:
            x = ''.join(c * 2 for c in x)
        r, g, b = int(x[0:2], 16), int(x[2:4], 16), int(x[4:6], 16)
        if not is_purple(r, g, b):
            return m.group(0)
        found = True
        if palette == 'purple':
            return m.group(0)
        r, g, b = shift(r, g, b, palette)
        alpha = x[6:8] if len(x) == 8 else ''
        return f'#{r:02x}{g:02x}{b:02x}{alpha}'

    def rgb_sub(m):
        nonlocal found
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if not is_purple(r, g, b):
            return m.group(0)
        found = True
        if palette == 'purple':
            return m.group(0)
        r, g, b = shift(r, g, b, palette)
        return f'rgba({r},{g},{b},{m.group(4)})' if m.group(4) else f'rgb({r},{g},{b})'

    value = HEX.sub(hex_sub, value)
    value = RGB.sub(rgb_sub, value)
    return value, found


def split_selectors(text):
    parts, depth, cur = [], 0, ''
    for ch in text:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def scope(selector, palette):
    attr = f'[data-palette={palette}]'
    m = re.match(r'^(:root|html)((?:\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?)*)(.*)$', selector, re.S)
    if m:
        return f'html{attr}{m.group(2)}{m.group(3)}'
    return f'html{attr} {selector}'


def rules(nodes, palette, out, indent=''):
    for node in nodes:
        if node.type == 'qualified-rule':
            selector = tinycss2.serialize(node.prelude).strip()
            if palette != 'black' and re.search(r'data-theme="?dark', selector):
                continue
            decls = tinycss2.parse_declaration_list(node.content, skip_whitespace=True, skip_comments=True)
            changed = []
            for d in decls:
                if d.type != 'declaration':
                    continue
                value = tinycss2.serialize(d.value).strip()
                new, found = recolor(value, palette)
                if found and palette != 'purple':
                    changed.append(f'{d.lower_name}:{new}{" !important" if d.important else ""}')
            if changed:
                sels = ','.join(scope(s, palette) for s in split_selectors(selector))
                out.append(f'{indent}{sels}{{{";".join(changed)}}}')
        elif node.type == 'at-rule' and node.lower_at_keyword in ('media', 'supports') and node.content:
            inner = []
            rules(tinycss2.parse_rule_list(node.content, skip_whitespace=True, skip_comments=True), palette, inner, indent)
            if inner:
                prelude = tinycss2.serialize(node.prelude).strip()
                out.append(f'@{node.lower_at_keyword} {prelude}{{' + ''.join(inner) + '}')


def main():
    sheet = tinycss2.parse_stylesheet(SRC.read_text(), skip_whitespace=True, skip_comments=True)
    out = ['/* Сгенерировано tools/build-palettes.py из style.css — не править вручную. */']
    for palette in PALETTES:
        global LOOSE
        LOOSE = True
        lavender = []
        for k, v in LAVENDER.items():
            if palette != 'purple':
                v, _ = recolor(v, palette)
            lavender.append(f'{k}:{v}')
        LOOSE = False
        out.append(f'html[data-palette={palette}]{{{";".join(lavender)}}}')
        if palette != 'purple':
            rules(sheet, palette, out)
    rules(sheet, 'black', out)
    out.append('html[data-palette=black][data-theme=dark]{' + ';'.join(f'{k}:{v}' for k, v in {**BLACK, **MONO_ACCENT}.items()) + '}')
    out.append(','.join(f'html[data-palette=black] {s}' for s in MONO_DARK_FG) + '{color:#0b0b0c!important}')
    out.append('html[data-palette=black] .mic .stop-mark{background:#0b0b0c!important}')
    OUT.write_text('\n'.join(out) + '\n')
    print(f'{OUT.relative_to(ROOT)}: {OUT.stat().st_size // 1024} КБ')


if __name__ == '__main__':
    main()
