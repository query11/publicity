"""Synthesize background music + timeline sound effects for the promo video.

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


def pluck(f, dur=0.45):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05) + 0.15 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.03)
    return s * np.exp(-t / 0.16) * adsr(len(t), 0.003, 0.05)


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1.0) - 1


def pad_chord(notes, dur):
    t = t_axis(dur)
    s = np.zeros_like(t)
    for n in notes:
        f = midi(n)
        for det in (-0.12, 0.0, 0.12):
            s += saw(f * 2 ** (det / 12), t, rng.random())
    s = lp_fast(s, 1400) / (len(notes) * 3)
    return s * adsr(len(t), 0.35, 0.6)


def bass_note(f, dur):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return s * adsr(len(t), 0.005, 0.06) * (0.55 + 0.45 * np.exp(-t / 0.18))


def kick():
    t = t_axis(0.45)
    f = 45 + 95 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.16) + 0.25 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)


def clap():
    n = int(0.25 * SR)
    noise = bp_fast(rng.standard_normal(n), 900, 5000)
    t = np.arange(n) / SR
    e = np.exp(-t / 0.07)
    for k in (0.0, 0.011, 0.022):
        e += 0.6 * np.exp(-np.clip(t - k, 0, None) / 0.006) * (t >= k)
    return noise * e * 0.35


def hat(open_=False):
    n = int((0.18 if open_ else 0.06) * SR)
    noise = hp_fast(rng.standard_normal(n), 7000)
    return noise * env_exp(n, 0.05 if open_ else 0.012) * 0.5


def crash():
    n = int(2.2 * SR)
    noise = hp_fast(rng.standard_normal(n), 3500)
    return noise * env_exp(n, 0.7) * 0.35


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = hp_fast(rng.standard_normal(n), 1500)
    return noise * (t / dur) ** 2.2 * 0.35


# ---------------------------------------------------------------- music
def make_music(D, cues=None):
    cues = cues or {}
    intro_end = cues.get('introEnd', 5.6)
    build_start = cues.get('buildStart', D * 0.7)
    drop = cues.get('drop', build_start + 2.6)
    end_start = cues.get('endStart', D - 3.5)
    bpm = 104
    beat = 60 / bpm
    bar = 4 * beat
    out = np.zeros((2, int((D + 3) * SR)))
    pad_b = np.zeros(out.shape[1])
    bass_b = np.zeros(out.shape[1])
    lead_b = np.zeros(out.shape[1])
    drum_b = np.zeros(out.shape[1])
    # IV - V - iii - vi  (F G Em Am) with 7ths, key of C
    prog = [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]]
    roots = [41, 43, 40, 45]
    arp_pat = [0, 2, 1, 3, 2, 1, 3, 2]
    nbars = int(np.ceil(D / bar)) + 1
    kick_s, clap_s, hat_s, hato_s = kick(), clap(), hat(), hat(True)

    def section(t):
        if t < intro_end:
            return 'intro'
        if t >= end_start:
            return 'end'
        if build_start <= t < drop:
            return 'build'
        return 'groove'

    for b in range(nbars):
        t0 = b * bar
        if t0 > D:
            break
        ch = prog[b % 4]
        add(pad_b, t0, pad_chord(ch, bar + 0.5), 0.9)
        for i in range(8):
            tt = t0 + i * beat / 2
            sec = section(tt)
            n = ch[arp_pat[i]] + 12
            add(lead_b, tt, pluck(midi(n)), 0.55 if sec != 'intro' else 0.4)
        for q in range(4):
            tt = t0 + q * beat
            sec = section(tt)
            if sec in ('groove', 'build'):
                add(drum_b, tt, kick_s, 0.9)
                add(bass_b, tt, bass_note(midi(roots[b % 4]), beat * 0.9), 0.7)
                add(bass_b, tt + beat / 2, bass_note(midi(roots[b % 4] + 12), beat * 0.45), 0.35)
                if q in (1, 3):
                    add(drum_b, tt, clap_s, 0.8)
                add(drum_b, tt + beat / 2, hato_s if q == 3 else hat_s, 0.55)
                if sec == 'build':
                    add(drum_b, tt + beat / 4, hat_s, 0.4)
                    add(drum_b, tt + 3 * beat / 4, hat_s, 0.4)
            elif sec == 'end':
                add(bass_b, tt, bass_note(midi(roots[b % 4]), beat * 0.9), 0.45 * max(0, 1 - (tt - end_start) / 3))
    add(drum_b, build_start, riser(max(0.5, drop - build_start)), 1.0)
    add(drum_b, drop, crash(), 0.9)
    add(drum_b, intro_end + 0.05, crash(), 0.6)
    add(drum_b, max(0, intro_end - 0.5), riser(0.45), 0.6)

    # sidechain duck from the kick grid
    duck = np.ones(out.shape[1])
    for b in range(nbars):
        for q in range(4):
            tt = b * bar + q * beat
            if section(tt) in ('groove', 'build'):
                i = int(tt * SR)
                n = int(0.22 * SR)
                if i + n < len(duck):
                    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.45 * np.exp(-np.arange(n) / SR / 0.09))
    pad_b *= duck
    bass_b *= duck
    # intro: pad/lead filtered & quieter
    t = np.arange(out.shape[1]) / SR
    intro_gain = np.clip((t - 0.0) / 1.0, 0, 1) * np.where(t < intro_end, 0.75, 1.0)
    mix_mono_pad = pad_b * 0.5 * intro_gain
    lead = lead_b * 0.32 * intro_gain
    # simple stereo: pad wide (delay), lead ping-pong-ish
    d = int(0.012 * SR)
    L = mix_mono_pad + np.concatenate([np.zeros(d), lead[:-d]]) * 0.9 + bass_b * 0.55 + drum_b * 0.5
    R = np.concatenate([np.zeros(d), mix_mono_pad[:-d]]) + lead + bass_b * 0.55 + drum_b * 0.5
    out[0], out[1] = L, R
    # end fade
    fade = np.clip((D - t) / 3.0, 0, 1)
    out *= fade
    out = out[:, : int(D * SR)]
    return out


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
    music *= 0.1 / (np.sqrt(np.mean(music ** 2)) + 1e-9)  # normalise music RMS to ~0.1
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
