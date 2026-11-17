"""Generate the AI voice-over from stage/script.js with a local TTS model, and check it with speech recognition.

usage: python3 tools/voice.py            (models from tools/get_models.sh; pip install sherpa-onnx soundfile pypinyin)
env:   VOICE_SID   speaker id of Kokoro v1.1-zh (default 36, a female narrator; 3..57 are female, 58..102 male)
       VOICE_SPEED speaking speed (default 1.3, a brisk explainer pace of about 5.4 characters per second)

Writes assets/voice/<key>.flac (44.1 kHz mono, silence trimmed, levelled) and stage/voice.js with each clip's
duration, which stage.js uses to lay out the timeline. Keys: line id, or shop_<id> for the shop ending.
Clips are cached in assets/voice/manifest.json: only lines whose text / voice / speed changed are re-synthesized.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, 'models')
TTS_DIR = os.path.join(MODELS, 'kokoro-multi-lang-v1_1')
ASR_DIR = os.path.join(MODELS, 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17')
OUT = os.path.join(ROOT, 'assets', 'voice')
SID = int(os.environ.get('VOICE_SID', 36))
SPEED = float(os.environ.get('VOICE_SPEED', 1.3))
SR = 44100
TARGET_RMS_DB = -20.0


def lines():
    data = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'tools', 'export_script.js')]))
    out = []
    for row in data['main'] + data['endClean']:
        out.append((row[0], row))
    for row in data['endShop']:
        out.append(('shop_' + row[0], row))
    return [(key, row[1], row[3] if len(row) > 3 else plain(row[1])) for key, row in out]


def plain(html):
    s = re.sub(r'<[^>]+>', '', html)
    return s.replace(' / ', '、')


def make_tts():
    import sherpa_onnx
    M = TTS_DIR
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=f'{M}/model.onnx', voices=f'{M}/voices.bin', tokens=f'{M}/tokens.txt',
                data_dir=f'{M}/espeak-ng-data', dict_dir=f'{M}/dict',
                lexicon=f'{M}/lexicon-us-en.txt,{M}/lexicon-zh.txt'),
            num_threads=4),
        rule_fsts=f'{M}/date-zh.fst,{M}/phone-zh.fst,{M}/number-zh.fst',
        max_num_sentences=1)
    return sherpa_onnx.OfflineTts(cfg)


def resample(x, sr_in, sr_out):
    """Band-limited FFT resampling (clips are short, so a single FFT is fine)."""
    n_out = int(round(len(x) * sr_out / sr_in))
    X = np.fft.rfft(x)
    Y = np.zeros(n_out // 2 + 1, dtype=complex)
    k = min(len(X), len(Y))
    Y[:k] = X[:k]
    return np.fft.irfft(Y, n_out) * (n_out / len(x))


def tidy(x):
    """Trim leading/trailing silence (keep 40 ms), 8 ms fades, level to TARGET_RMS_DB over voiced frames."""
    fr = int(0.01 * SR)
    e = np.array([np.sqrt(np.mean(x[i:i + fr] ** 2)) for i in range(0, len(x) - fr, fr)])
    on = np.where(e > 10 ** (-45 / 20))[0]
    a, b = max(0, on[0] * fr - int(0.04 * SR)), min(len(x), (on[-1] + 1) * fr + int(0.04 * SR))
    x = x[a:b].copy()
    f = int(0.008 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    voiced = np.concatenate([x[i:i + fr] for i in range(0, len(x) - fr, fr) if np.sqrt(np.mean(x[i:i + fr] ** 2)) > 10 ** (-40 / 20)])
    g = 10 ** (TARGET_RMS_DB / 20) / (np.sqrt(np.mean(voiced ** 2)) + 1e-9)
    x *= g
    pk = np.max(np.abs(x))
    if pk > 0.95:
        x *= 0.95 / pk
    return x


# with inverse text normalisation off, the recogniser writes numbers as Chinese numerals: normalise the reference the same way
NUM = {'16688': '一六六八八', '30': '三十', '20': '二十', '10': '十', '5': '五'}


def norm_text(s):
    s = s.lower()
    for k, v in NUM.items():
        s = s.replace(k, v)
    return re.sub(r'[，。、：；？！,.?!:;\s·/]', '', s)


def tokens(s):
    """Toneless pinyin per Chinese character, whole words for Latin letters: homophones don't count as errors."""
    s = norm_text(s)
    try:
        from pypinyin import lazy_pinyin
    except ImportError:
        return list(s)
    out = []
    for w in re.findall(r'[a-z]+|[一-鿿]', s):
        out += lazy_pinyin(w) if re.match(r'[一-鿿]', w) else [w]
    return out


def cer(ref, hyp):
    d = list(range(len(hyp) + 1))
    for i, a in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, b in enumerate(hyp, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (a != b))
    return d[len(hyp)] / max(1, len(ref))


def main():
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    tts = None
    durations = {}
    todo = lines()
    for key, caption, say in todo:
        h = hashlib.sha1(f'{say}|{SID}|{SPEED}|{TARGET_RMS_DB}'.encode()).hexdigest()[:12]
        path = os.path.join(OUT, key + '.flac')
        if manifest.get(key, {}).get('hash') != h or not os.path.exists(path):
            tts = tts or make_tts()
            a = tts.generate(say, sid=SID, speed=SPEED)
            x = tidy(resample(np.asarray(a.samples, dtype=np.float64), a.sample_rate, SR))
            sf.write(path, x.astype(np.float32), SR, subtype='PCM_16')
            manifest[key] = {'hash': h, 'say': say}
            print('synth', key, f'{len(x) / SR:.2f}s', say)
        durations[key] = round(sf.info(path).frames / SR, 3)
    # drop clips of lines that no longer exist
    keys = {k for k, _, _ in todo}
    for k in list(manifest):
        if k not in keys:
            manifest.pop(k)
            if os.path.exists(os.path.join(OUT, k + '.flac')):
                os.remove(os.path.join(OUT, k + '.flac'))
    json.dump(manifest, open(man_path, 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, 'stage', 'voice.js'), 'w') as f:
        f.write(f'// generated by tools/voice.py (Kokoro v1.1-zh, speaker {SID}, speed {SPEED}): clip durations in seconds\n')
        f.write('window.VOICE = ' + json.dumps(durations, indent=1) + ';\n')
    print('voice.js written,', len(durations), 'clips, total', f'{sum(durations.values()):.1f}s')

    # speech-recognition check: does each clip say what the caption says?
    if os.path.isdir(ASR_DIR):
        import sherpa_onnx
        rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(model=f'{ASR_DIR}/model.int8.onnx', tokens=f'{ASR_DIR}/tokens.txt', use_itn=False, num_threads=4)
        bad = 0
        report = []
        for key, caption, say in todo:
            x, sr = sf.read(os.path.join(OUT, key + '.flac'), dtype='float32')
            s = rec.create_stream()
            s.accept_waveform(sr, x)
            rec.decode_stream(s)
            ref, hyp = tokens(say), tokens(s.result.text)
            c = cer(ref, hyp)
            report.append(f'{key:8s} err {c:.2f} | {say} | {s.result.text}')
            if c > 0.12:
                bad += 1
                print('CHECK', report[-1])
        open(os.path.join(ROOT, 'out', 'voice_asr.txt'), 'w').write('\n'.join(report) + '\n')
        print('asr check:', len(todo) - bad, 'ok,', bad, 'to check (see out/voice_asr.txt)')


if __name__ == '__main__':
    sys.exit(main())
