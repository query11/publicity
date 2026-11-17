"""Synthesize the lo-fi background music + timeline sound effects for the explainer video.

usage: python3 tools/audio.py out/meta.json out/audio.wav
meta.json comes from `node tools/render.js meta out/meta.json` (duration + SFX cue list).
Everything is generated procedurally (no third-party samples), so the soundtrack is royalty-free.
"""
import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(1234)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_exp(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def adsr(n, a=0.01, r=0.1):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lp_fast(x, cutoff):
    """FFT brick-ish lowpass with a soft knee (fast, good enough for pads/noise)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def hp_fast(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X, len(x))


def bp_fast(x, lo, hi):
    return hp_fast(lp_fast(x, hi), lo)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= buf.shape[-1] or i + len(sig) <= 0:
        return
    j = min(buf.shape[-1], i + len(sig))
    buf[..., i:j] += gain * sig[: j - i]


# ---------------------------------------------------------------- instruments
def fm_bell(f, dur, idx=2.0, tau=0.35, ratio=2.0):
    t = t_axis(dur)
    mod = idx * np.exp(-t / (tau * 0.6)) * np.sin(2 * np.pi * f * ratio * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * adsr(len(t), 0.002, 0.03)


# ---------------------------------------------------------------- lo-fi music
# Calm lo-fi bed for a talky explainer: 84 BPM swung boom-bap, FM electric piano, sub bass, vinyl crackle.
# Arrangement follows the stage cues: keys only (muffled) during the hook, drums + open filter from PART 1,
# soft shaker from PART 2, drums out for the ending and a held I chord at the very end.
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
SWING = 0.58  # position of the off-beat 8th inside a beat

# Fmaj9 - Em7 - Dm9 - Cmaj9 (IV - iii - ii - I in C)
CHORDS = [
    (41, [57, 60, 64, 67]),  # F  : A3 C4 E4 G4
    (40, [55, 59, 62, 64]),  # Em7: G3 B3 D4 E4
    (38, [53, 57, 60, 64]),  # Dm9: F3 A3 C4 E4
    (36, [52, 55, 59, 62]),  # C  : E3 G3 B3 D4
]


def add2(buf, start, sig, gain=1.0):
    """add() for stereo (2, n) signals."""
    i = int(start * SR)
    if i >= buf.shape[-1] or i + sig.shape[-1] <= 0:
        return
    j = min(buf.shape[-1], i + sig.shape[-1])
    buf[:, i:j] += gain * sig[:, : j - i]


def ep_note(f, dur, vel):
    """FM electric piano (1:1 ratio, decaying index) with a faint tine, slightly detuned per channel."""
    n = int((dur + 0.7) * SR)
    t = np.arange(n) / SR
    idx = (0.9 + 1.1 * vel) * np.exp(-t / 0.32) + 0.12
    env = (1 - np.exp(-t / 0.004)) * (0.6 * np.exp(-t / 0.8) + 0.4 * np.exp(-t / 3.2))
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.2))
    out = []
    for det, ph in ((-0.0023, 0.0), (0.0023, 0.4)):
        fc = f * (1 + det)
        s = np.sin(2 * np.pi * fc * t + idx * np.sin(2 * np.pi * fc * t + ph))
        s += 0.05 * vel * np.exp(-t / 0.05) * np.sin(2 * np.pi * f * 7 * t)
        out.append(s * env * vel)
    return np.vstack(out)


def sub_bass(f, dur, vel=1.0):
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) + 0.06 * np.sin(6 * np.pi * f * t)
    env = (1 - np.exp(-t / 0.008)) * (0.55 + 0.45 * np.exp(-t / 0.25))
    env *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.05))
    return s * env * vel


def lofi_kick():
    t = t_axis(0.5)
    f = 46 + 72 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    s += 0.12 * lp_fast(rng.standard_normal(len(t)), 2000) * np.exp(-t / 0.003)
    return s


def lofi_snare():
    t = t_axis(0.35)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.5
    noise = bp_fast(rng.standard_normal(len(t)), 1200, 4500) * np.exp(-t / 0.085) * 0.75
    return lp_fast(body + noise, 5000)


def lofi_hat(seed):
    r = np.random.default_rng(seed)
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    return lp_fast(hp_fast(r.standard_normal(n), 5500), 12000) * np.exp(-t / 0.02) * 0.55


def shaker(seed):
    r = np.random.default_rng(seed)
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    e = (1 - np.exp(-t / 0.01)) * np.exp(-t / 0.025)
    return bp_fast(r.standard_normal(n), 4500, 10000) * e * 0.3


def vinyl(D):
    r = np.random.default_rng(77)
    n = int(D * SR)
    hiss = bp_fast(r.standard_normal(n), 300, 6000) * 0.0035
    clicks = np.zeros(n)
    k = r.poisson(7 * D)
    pos = r.integers(0, n, k)
    clicks[pos] = r.choice([-1, 1], k) * r.exponential(0.05, k)
    clicks = bp_fast(clicks, 1500, 8000) * 0.5
    return hiss + clicks


def make_music(D, cues=None, stems=False):
    cues = cues or {}
    parts = cues.get('parts') or [cues.get('introEnd', 10.0), D * 0.4, D * 0.7, cues.get('endStart', D - 15)]
    drums_on = np.ceil((parts[0] - 0.15) / BAR) * BAR       # first downbeat at / after PART 1
    shaker_on = parts[1]
    drums_off = np.ceil((parts[3] - 0.15) / BAR) * BAR      # first downbeat at / after the ending
    N = int((D + 4) * SR)
    keys = np.zeros((2, N))
    bass = np.zeros(N)
    drums = np.zeros(N)
    r = np.random.default_rng(2024)
    nbars = int(np.ceil(D / BAR)) + 1
    final_bar = int((D - 2.2 * BAR) // BAR)  # last bars: hold the I chord
    hats = [lofi_hat(s) for s in range(8)]
    shk = [shaker(s) for s in range(8)]
    kick_s, snare_s = lofi_kick(), lofi_snare()
    kicks = []
    for b in range(nbars):
        t0 = b * BAR
        if t0 > D:
            break
        if b >= final_bar:
            root, voicing = CHORDS[3]
            hits = [(0.0, max(BAR, D - t0) / BEAT, 0.8)] if b == final_bar else []
        else:
            root, voicing = CHORDS[b % 4]
            # swung comping: two patterns alternating every bar
            hits = [(0.0, 1.4, 0.85), (1 + SWING, 0.8, 0.55), (3.0, 0.9, 0.6)] if b % 2 == 0 else [(0.0, 2.2, 0.8), (2 + SWING, 1.2, 0.58)]
        for pos, dur, vel in hits:
            tt = t0 + pos * BEAT + r.normal(0, 0.006)
            d = dur * BEAT
            for k, n in enumerate(voicing):
                v = max(0.2, vel + r.normal(0, 0.05)) * (0.85 if k == 0 else 1.0)
                add2(keys, tt + k * 0.011, ep_note(midi(n), d, v), 0.36)
        if b < final_bar:
            add(bass, t0, sub_bass(midi(root), 1.35 * BEAT), 0.9)
            add(bass, t0 + (2 + SWING) * BEAT, sub_bass(midi(root), 1.0 * BEAT, 0.8), 0.9)
        else:
            add(bass, t0, sub_bass(midi(root), max(BAR, D - t0)), 0.9 if b == final_bar else 0.0)
        if drums_on <= t0 < drums_off:
            ks = [0.0, 2.0] + ([2 + SWING] if b % 2 else [])
            for p in ks:
                add(drums, t0 + p * BEAT, kick_s, 0.6)
                kicks.append(t0 + p * BEAT)
            for p in (1.0, 3.0):
                add(drums, t0 + p * BEAT + 0.008, snare_s, 0.65)
            for q in range(4):
                for j, off in enumerate((0.0, SWING)):
                    tt = t0 + (q + off) * BEAT + r.normal(0, 0.004)
                    add(drums, tt, hats[(b * 8 + q * 2 + j) % 8], (0.75 if j else 0.5) + r.normal(0, 0.06))
            if t0 >= shaker_on - BAR / 2:
                for s16 in range(16):
                    add(drums, t0 + s16 * BEAT / 4, shk[(b + s16) % 8], 0.45 if s16 % 2 else 0.3)
    t = np.arange(N) / SR
    # keys: muffled during the hook, the filter opens as the drums come in
    dark, bright = lp_fast(keys[0], 1300), lp_fast(keys[0], 3000)
    darkR, brightR = lp_fast(keys[1], 1300), lp_fast(keys[1], 3000)
    m = np.clip((t - (drums_on - 1.6)) / 1.6, 0, 1)
    kL, kR = dark * (1 - m) + bright * m, darkR * (1 - m) + brightR * m
    trem = 0.1 * np.sin(2 * np.pi * 4.2 * t)
    kL, kR = kL * (1 - trem), kR * (1 + trem)
    # gentle sidechain from the kick
    duck = np.ones(N)
    for k in kicks:
        i = int(k * SR)
        n = int(0.25 * SR)
        if i + n < N:
            duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.22 * np.exp(-np.arange(n) / SR / 0.1))
    bass = lp_fast(bass, 320) * duck
    drums = np.tanh(lp_fast(drums, 12000) * 1.4) / 1.4
    crackle = vinyl(D + 4)
    L = kL * duck * 1.0 + bass * 0.32 + drums * 0.6 + crackle * 2.5
    R = kR * duck * 1.0 + bass * 0.32 + drums * 0.6 + np.roll(crackle, 377) * 2.5
    if stems:
        return {'keys': (kL + kR) / 2 * duck, 'bass': bass * 0.32, 'drums': drums * 0.6, 'crackle': crackle * 2.5}
    out = np.vstack([hp_fast(L, 28), hp_fast(R, 28)])
    fade = np.clip((D - t) / 3.0, 0, 1) * np.clip(t / 0.6, 0, 1)
    out *= fade
    return out[:, : int(D * SR)]


# ---------------------------------------------------------------- sfx
def sfx(kind, seed=0):
    r = np.random.default_rng(seed + 99)
    if kind == 'click':
        n = int(0.06 * SR)
        t = np.arange(n) / SR
        s = hp_fast(r.standard_normal(n), 1800) * np.exp(-t / 0.004) * 0.8
        s += np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.008) * 0.35
        s[int(0.035 * SR):] += hp_fast(r.standard_normal(n - int(0.035 * SR)), 2500) * np.exp(-t[: n - int(0.035 * SR)] / 0.003) * 0.35
        return s * 0.9
    if kind == 'key':
        n = int(0.09 * SR)
        t = np.arange(n) / SR
        f = 180 + 60 * r.random()
        s = bp_fast(r.standard_normal(n), 1500, 6000) * np.exp(-t / (0.008 + 0.004 * r.random())) * 0.7
        s += np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02) * 0.4
        return s * (0.45 + 0.15 * r.random())
    if kind == 'wheel':
        n = int(0.02 * SR)
        t = np.arange(n) / SR
        return hp_fast(r.standard_normal(n), 3000) * np.exp(-t / 0.002) * 0.18
    if kind == 'pop':
        n = int(0.14 * SR)
        t = np.arange(n) / SR
        f = 380 + 900 * (1 - np.exp(-t / 0.03))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * 0.55
    if kind == 'whoosh':
        n = int(0.7 * SR)
        t = np.arange(n) / SR
        noise = r.standard_normal(n)
        e = np.sin(np.pi * np.clip(t / 0.6, 0, 1)) ** 2
        # sweeping band: crossfade between a dark and a bright filtered copy
        dark, bright = bp_fast(noise, 200, 1200), bp_fast(noise, 1200, 6000)
        mixk = np.clip(t / 0.6, 0, 1)
        return (dark * (1 - mixk) + bright * mixk) * e * 0.55
    if kind == 'impact':
        n = int(1.0 * SR)
        t = np.arange(n) / SR
        f = 38 + 70 * np.exp(-t / 0.08)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35) * 0.9
        s += lp_fast(r.standard_normal(n), 2500) * np.exp(-t / 0.05) * 0.4
        return s
    if kind == 'beep':
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * 1760 * t) * adsr(n, 0.003, 0.03) * 0.3
    if kind == 'ding':
        return (fm_bell(midi(88), 1.6, 1.5, 0.5, 3.5) * 0.35 + 0.0)
    if kind == 'notify':
        a = fm_bell(midi(84), 0.6, 1.2, 0.25, 2.0) * 0.3
        b = fm_bell(midi(91), 0.9, 1.2, 0.35, 2.0) * 0.3
        s = np.zeros(int(1.1 * SR))
        add(s, 0.0, a)
        add(s, 0.12, b)
        return s
    if kind == 'paste':
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        return bp_fast(r.standard_normal(n), 800, 5000) * np.exp(-t / 0.025) * 0.35
    if kind == 'tick':
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.015) * 0.3
    if kind == 'success':
        s = np.zeros(int(2.4 * SR))
        for k, n in enumerate([72, 76, 79, 84, 88]):
            add(s, k * 0.075, fm_bell(midi(n), 1.6, 1.4, 0.55, 2.0), 0.26)
        return s
    raise ValueError(kind)


def write_wav(path, stereo):
    pk = np.max(np.abs(stereo))
    if pk > 0.98:
        stereo = stereo / pk * 0.98
    data = (stereo.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    meta = json.load(open(sys.argv[1], encoding='utf-8'))
    D = float(meta['duration'])
    music = make_music(D, meta.get('music'))
    music *= float(meta.get('musicRms') or 0.1) / (np.sqrt(np.mean(music ** 2)) + 1e-9)  # normalise music RMS (stage sets it)
    fx = np.zeros(music.shape[1])
    cache = {}
    for cue in meta['sfx']:
        key = (cue['type'], cue.get('seed', 0) if cue['type'] == 'key' else 0)
        if key not in cache:
            cache[key] = sfx(cue['type'], key[1])
        add(fx, cue['t'], cache[key], cue.get('gain', 1.0))
    mix = music * 0.85 + np.vstack([fx, fx]) * 0.9
    write_wav(sys.argv[2], mix)
    print('audio written', sys.argv[2], f'{D:.1f}s', 'music rms', float(np.sqrt(np.mean(music ** 2))))


if __name__ == '__main__':
    main()
