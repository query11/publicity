#!/usr/bin/env bash
# Full pipeline: render frames -> synthesize audio -> mux -> subtitles -> cover.
#   bash tools/build.sh          # default ending: no shop name / QR / selling points (for Bilibili without a 商业声明)
#   bash tools/build.sh --shop   # ending with shop name, selling points and QR (commercial promotion)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out dist

export VARIANT=""
SUFFIX=""
if [[ "${1:-}" == "--shop" ]]; then VARIANT="shop"; SUFFIX="-shop"; fi

node tools/make_qr.js
node tools/render.js meta "out/meta${SUFFIX}.json"
node tools/render.js video "out/video_silent${SUFFIX}.mp4" "${WORKERS:-4}"
python3 tools/audio.py "out/meta${SUFFIX}.json" "out/audio${SUFFIX}.wav"
python3 tools/make_srt.py "out/meta${SUFFIX}.json" "dist/subtitles${SUFFIX}.srt"

ffmpeg -y -loglevel error -i "out/video_silent${SUFFIX}.mp4" -i "out/audio${SUFFIX}.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -af "loudnorm=I=-18:TP=-1.5:LRA=11" -shortest -movflags +faststart \
  "dist/plus-pro-choose${SUFFIX}-1080p.mp4"
node tools/cover.js dist/cover.png
echo "done: dist/plus-pro-choose${SUFFIX}-1080p.mp4"
