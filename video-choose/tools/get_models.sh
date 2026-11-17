#!/usr/bin/env bash
# Download the local TTS model (Kokoro v1.1-zh, Apache-2.0) and the ASR model used to check the voice (SenseVoice).
# Only needed when the narration in stage/script.js changes (the generated clips are committed in assets/voice/).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models && cd models
base=https://github.com/k2-fsa/sherpa-onnx/releases/download
[[ -d kokoro-multi-lang-v1_1 ]] || { curl -sSL -o k.tar.bz2 "$base/tts-models/kokoro-multi-lang-v1_1.tar.bz2"; tar xjf k.tar.bz2; rm k.tar.bz2; }
[[ -d sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17 ]] || { curl -sSL -o s.tar.bz2 "$base/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2"; tar xjf s.tar.bz2; rm s.tar.bz2; }
echo "models ready"
