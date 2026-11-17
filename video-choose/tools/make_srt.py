"""Write the on-screen captions as an .srt subtitle file (for Bilibili CC subtitles or editing in 剪映).

usage: python3 tools/make_srt.py out/meta.json out/subtitles.srt
"""
import json
import sys


def ts(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


meta = json.load(open(sys.argv[1], encoding='utf-8'))
lines = []
for i, c in enumerate(meta['captions'], 1):
    lines += [str(i), f"{ts(c['start'])} --> {ts(c['end'])}", c['text'], '']
open(sys.argv[2], 'w', encoding='utf-8').write('\n'.join(lines))
print('wrote', sys.argv[2], len(meta['captions']), 'captions')
