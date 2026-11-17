"""Mix the soundtrack: AI voice-over clips + upbeat background music (ducked under the voice) + timeline sound effects.

usage: python3 tools/audio.py out/meta.json out/audio.wav
meta.json comes from `node tools/render.js meta out/meta.json` (duration, part cues, voice cues, SFX cues).
Voice clips come from assets/voice/ (tools/voice.py). Music and effects are generated procedurally
(no third-party samples), so the soundtrack is royalty-free.
"""
import json
import sys
import wave

import os

import numpy as np
import soundfile as sf

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

def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = hp_fast(rng.standard_normal(n), 1500)
    return noise * (t / dur) ** 2.2 * 0.35


# ---------------------------------------------------------------- upbeat music
# 118 BPM pop / house bed: four-on-the-floor kick, claps, 16th hats + off-beat open hats, octave-bouncing bass,
# syncopated chord stabs on Am - F - C - G, a soft pad; arp from PART 2, extra percussion in PART 3.
# Every part (stage cue `parts`) starts on a downbeat with a crash; the beat before each part stops for a fill + riser.
BPM = 118
BEAT = 60 / BPM
BAR = 4 * BEAT

# vi - IV - I - V in C: (bass root, chord voicing)
PROG = [
    (45, [57, 60, 64, 67]),  # Am7 : A3 C4 E4 G4
    (41, [57, 60, 64, 65]),  # Fmaj7: A3 C4 E4 F4
    (48, [55, 60, 64, 67]),  # C   : G3 C4 E4 G4
    (43, [55, 59, 62, 67]),  # G   : G3 B3 D4 G4
]


def add2(buf, start, sig, gain=1.0):
    """add() for stereo (2, n) signals."""
    i = int(start * SR)
    if i >= buf.shape[-1] or i + sig.shape[-1] <= 0:
        return
    j = min(buf.shape[-1], i + sig.shape[-1])
    buf[:, i:j] += gain * sig[:, : j - i]


def additive_pluck(f, dur, bright=1.0, tau=0.14, nmax=None, detune=0.0):
    """Band-limited saw built from harmonics; higher harmonics decay faster = closing filter."""
    n = int((dur + tau * 4) * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    k = 1
    lim = nmax or 40
    while k <= lim and f * k < 9000:
        s += np.sin(2 * np.pi * f * (1 + detune) * k * t) / k ** 0.85 * np.exp(-t * (1 + 0.15 * k / bright) / tau)
        k += 1
    env = (1 - np.exp(-t / 0.003)) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.05))
    return s * env


def stab(notes, dur, bright=1.0):
    L = sum(additive_pluck(midi(n), dur, bright, 0.26, detune=-0.0035) for n in notes)
    R = sum(additive_pluck(midi(n), dur, bright, 0.26, detune=0.0035) for n in notes)
    # octave-up shine layer (shorter decay, so pad it to the main layer's length)
    hiL = sum(additive_pluck(midi(n + 12), dur, bright, 0.18, detune=0.004) for n in notes[1:])
    hiR = sum(additive_pluck(midi(n + 12), dur, bright, 0.18, detune=-0.004) for n in notes[1:])
    L[: len(hiL)] += 0.3 * hiL
    R[: len(hiR)] += 0.3 * hiR
    return np.vstack([L, R]) / len(notes)


def pad(notes, dur):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for note in notes:
        f = midi(note)
        for ch, det in ((0, -0.004), (1, 0.004)):
            s = np.zeros(n)
            for k in range(1, 7):
                s += np.sin(2 * np.pi * f * (1 + det) * k * t + rng.random() * 6.28) / k ** 1.4
            out[ch] += s
    env = np.clip(t / 0.25, 0, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.2))
    return out * env / len(notes)


def bass_pluck(f, dur):
    n = int((dur + 0.1) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * 1.0
    for k in range(2, 7):
        s += np.sin(2 * np.pi * f * k * t) / k * 0.8 * np.exp(-t * k / 0.09)
    env = (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.35) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.02))
    return s * env


def arp_note(f, dur):
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.04)
    return s * (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.09)


def house_kick():
    t = t_axis(0.45)
    f = 50 + 115 * np.exp(-t / 0.03)
    s = np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.26))
    s += 0.25 * hp_fast(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.003)
    return s


def house_clap():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = bp_fast(rng.standard_normal(n), 1000, 5000)
    e = 0.7 * np.exp(-t / 0.11)
    for k in (0.0, 0.009, 0.018):
        e += 0.8 * np.exp(-np.clip(t - k, 0, None) / 0.005) * (t >= k)
    body = np.sin(2 * np.pi * 195 * t) * np.exp(-t / 0.05) * 0.5
    return noise * e * 0.75 + body


def hat_c(seed):
    r = np.random.default_rng(seed)
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return hp_fast(r.standard_normal(n), 7000) * np.exp(-t / 0.02) * 0.7


def hat_o(seed):
    r = np.random.default_rng(seed + 50)
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    return hp_fast(r.standard_normal(n), 6000) * np.exp(-t / 0.12) * 0.5


def make_music(D, cues=None):
    cues = cues or {}
    W = list(cues.get('parts') or [D * 0.1, D * 0.35, D * 0.7, D * 0.88])
    start = float(cues.get('start', 0.0))   # the beat starts here (hook stamp); only a riser before it
    bounds = [start] + W + [D]
    N = int((D + 3) * SR)
    drums = np.zeros(N)
    bass = np.zeros(N)
    keys = np.zeros((2, N))   # stabs + arp
    padb = np.zeros((2, N))
    kicks = []
    r = np.random.default_rng(118)
    kick_s, clap_s = house_kick(), house_clap()
    hc = [hat_c(i) for i in range(8)]
    ho = [hat_o(i) for i in range(4)]
    for si in range(len(bounds) - 1):
        ts, te = bounds[si], bounds[si + 1]
        last = si == len(bounds) - 2
        stop = te - BEAT if not last else te            # silence the groove for the beat before the next part
        nb = int(np.ceil((te - ts) / BAR))
        intro, arp_on, perc_on = si == 0, si >= 2 and not last, si == 3
        if last:  # ending: groove for whole bars, then one big final chord
            final_t = ts + max(1, int((D - 2.2 - ts) // BAR)) * BAR
            stop = final_t
        for b in range(nb):
            t0 = ts + b * BAR
            if t0 >= stop:
                break
            root, voicing = PROG[b % 4]
            g = (lambda tt: tt < stop - 0.01)
            # drums
            for q in range(4):
                tt = t0 + q * BEAT
                if g(tt):
                    add(drums, tt, kick_s, 0.75 if intro else 1.0)
                    kicks.append(tt)
                if q in (1, 3) and not intro and g(tt):
                    add(drums, tt, clap_s, 0.7)
                for s16 in range(4):
                    th = tt + s16 * BEAT / 4
                    if not g(th):
                        continue
                    if s16 == 2:
                        add(drums, th, ho[(b + q) % 4], 0.8 if not intro else 0.5)
                    else:
                        add(drums, th, hc[(b * 16 + q * 4 + s16) % 8], (0.55 if s16 == 0 else 0.3) + r.normal(0, 0.04))
                    if perc_on and s16 % 2 == 1:
                        add(drums, th + 0.004, hc[(s16 + b) % 8], 0.25)
            # bass: octave bounce on 8ths
            for e8 in range(8):
                tt = t0 + e8 * BEAT / 2
                if g(tt):
                    add(bass, tt, bass_pluck(midi(root - 12 + (12 if e8 % 2 else 0)), BEAT * 0.42), 0.8)
            # stabs: 3-3-2 syncopation (+ one more push in PART 3)
            for p in ([0, 1.5, 3.0] + ([2.5] if perc_on else [])):
                tt = t0 + p * BEAT
                if g(tt):
                    add2(keys, tt, stab(voicing, BEAT * 0.38, 3.2 if perc_on else 2.4), 0.55)
            # pad
            add2(padb, t0, pad(voicing, min(BAR, stop - t0)), 0.35)
            # arp: chord tones +12, 16ths, up-down
            if arp_on:
                seq = [voicing[i] + 12 for i in (0, 1, 2, 3, 2, 1)]
                for s16 in range(16):
                    tt = t0 + s16 * BEAT / 4
                    if g(tt):
                        add2(keys, tt, np.vstack([arp_note(midi(seq[s16 % 6]), BEAT / 4)] * 2) * np.array([[0.6 + 0.4 * (s16 % 2)], [1.0 - 0.4 * (s16 % 2)]]), 0.12)
        # section start: crash; section end: snare fill + riser into the next part
        add(drums, ts, hp_fast(r.standard_normal(int(1.8 * SR)), 5000) * np.exp(-np.arange(int(1.8 * SR)) / SR / 0.7) * 0.35, 0.0 if si == 0 else 1.0)
        if not last:
            for k in range(4):
                add(drums, te - BEAT + k * BEAT / 4, clap_s, 0.25 + 0.15 * k)
            rl = min(2 * BEAT, te - ts)
            add(drums, te - rl, riser(rl) * 0.8, 1.0)
        else:
            root, voicing = PROG[0][0], [57, 60, 64, 69]
            add(drums, final_t, kick_s, 1.0)
            add(drums, final_t, hp_fast(r.standard_normal(int(2.5 * SR)), 4500) * np.exp(-np.arange(int(2.5 * SR)) / SR / 0.9) * 0.4)
            add2(keys, final_t, stab(voicing, 1.6, 1.6), 0.7)
            add2(padb, final_t, pad(voicing, 2.2), 0.5)
            add(bass, final_t, bass_pluck(midi(root - 12), 1.5), 0.9)
    if start > 0.5:
        add(drums, 0.0, riser(start) * 0.9, 1.0)
    # kick sidechain (the house "pump")
    t = np.arange(N) / SR
    sc = np.ones(N)
    for k in kicks:
        i, n = int(k * SR), int(0.3 * SR)
        if i + n < N:
            sc[i:i + n] = np.minimum(sc[i:i + n], 1 - np.exp(-np.arange(n) / SR / 0.12) * 0.55)
    # intro: low-pass opening across the first part
    keysL, keysR = keys[0], keys[1]
    if W[0] > 1:
        dk, dkr = lp_fast(keysL, 1400), lp_fast(keysR, 1400)
        m = np.clip(t / W[0], 0, 1) ** 1.5
        keysL, keysR = dk * (1 - m) + keysL * m, dkr * (1 - m) + keysR * m
    bass = lp_fast(bass, 900) * sc
    padL, padR = lp_fast(padb[0], 2500) * sc, lp_fast(padb[1], 2500) * sc
    drums = np.tanh(drums * 1.2) / 1.2
    L = drums * 0.5 + bass * 0.42 + keysL * sc * 2.2 + padL * 1.3
    R = drums * 0.5 + bass * 0.42 + keysR * sc * 2.2 + padR * 1.3
    out = np.vstack([hp_fast(L, 30), hp_fast(R, 30)])
    out *= np.clip((D - t) / 1.2, 0, 1)
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
    if kind == 'stamp':
        # heavy rubber-stamp slam: low thud + dull slap
        n = int(0.6 * SR)
        t = np.arange(n) / SR
        f = 45 + 60 * np.exp(-t / 0.05)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) * 0.9
        s += lp_fast(r.standard_normal(n), 2500) * np.exp(-t / 0.025) * 0.7
        s += bp_fast(r.standard_normal(n), 1500, 6000) * np.exp(-t / 0.008) * 0.4
        return s
    if kind == 'glitch':
        # 0.35 s digital stutter: gated square blips and crushed noise
        n = int(0.35 * SR)
        out = np.zeros(n)
        seg_n = int(0.028 * SR)
        for k, i in enumerate(range(0, n - seg_n, seg_n)):
            t = np.arange(seg_n) / SR
            if k % 3 == 2:
                continue
            if r.random() < 0.5:
                f0 = r.uniform(180, 1400)
                blk = np.sign(np.sin(2 * np.pi * f0 * t)) * 0.35
            else:
                blk = np.repeat(r.standard_normal(seg_n // 8 + 1), 8)[:seg_n] * 0.3
            out[i:i + seg_n] = blk * (1 - k / (n / seg_n)) ** 0.5
        return lp_fast(out, 7000)
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


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_DB = -22.0   # music RMS before ducking (voice clips are levelled to about -20 dBFS)
DUCK_DB = 12.0     # music reduction while the narrator speaks
SFX_GAIN = 0.5


def voice_track(cues, n):
    v = np.zeros(n)
    for c in cues:
        x, sr = sf.read(os.path.join(ROOT, 'assets', 'voice', c['key'] + '.flac'), dtype='float64')
        assert sr == SR, sr
        add(v, c['t'], x)
    return v


def duck_gain(v):
    """Gain curve for the music: down DUCK_DB while the voice is active (80 ms look-ahead, 30 ms attack, 350 ms release)."""
    hop = int(0.01 * SR)
    fr = np.array([np.sqrt(np.mean(v[i:i + hop] ** 2)) for i in range(0, len(v), hop)])
    act = np.clip((20 * np.log10(fr + 1e-9) + 48) / 10, 0, 1)
    look = 8
    act = np.concatenate([act[look:], np.zeros(look)])
    sm = np.zeros_like(act)
    a_up, a_dn = np.exp(-1 / 3), np.exp(-1 / 35)
    for i in range(1, len(act)):
        a = a_up if act[i] > sm[i - 1] else a_dn
        sm[i] = a * sm[i - 1] + (1 - a) * act[i]
    g = 10 ** (-DUCK_DB * sm / 20)
    return np.interp(np.arange(len(v)) / hop, np.arange(len(g)), g)


def main():
    meta = json.load(open(sys.argv[1], encoding='utf-8'))
    D = float(meta['duration'])
    n = int(D * SR)
    music = make_music(D, meta.get('music'))[:, :n]
    music *= 10 ** (MUSIC_DB / 20) / (np.sqrt(np.mean(music ** 2)) + 1e-9)
    voice = voice_track(meta.get('voice') or [], n)
    music *= duck_gain(voice)
    fx = np.zeros(n)
    cache = {}
    for cue in meta['sfx']:
        key = (cue['type'], cue.get('seed', 0) if cue['type'] == 'key' else 0)
        if key not in cache:
            cache[key] = sfx(cue['type'], key[1])
        add(fx, cue['t'], cache[key], cue.get('gain', 1.0))
    mix = music + np.vstack([voice, voice]) + np.vstack([fx, fx]) * SFX_GAIN
    write_wav(sys.argv[2], mix)
    print('audio written', sys.argv[2], f'{D:.1f}s', len(meta.get('voice') or []), 'voice clips')


if __name__ == '__main__':
    main()
