#!/usr/bin/env bash
# Full pipeline: (optional) re-capture screenshots -> render frames -> synthesize audio -> mux.
#   bash tools/build.sh            # render from the committed assets
#   bash tools/build.sh --capture  # re-capture the real pages first (needs network access to the sites)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out

if [[ "${1:-}" == "--capture" ]]; then
  node tools/capture.js            # 16688 shop + order query (amounts blurred)
  node tools/capture_recharge.js   # self-service recharge site, API answered locally with demo data
fi

node tools/make_qr.js
node tools/render.js meta out/meta.json
node tools/render.js video out/video_silent.mp4 "${WORKERS:-3}"
python3 tools/audio.py out/meta.json out/audio.wav
python3 tools/make_srt.py out/meta.json out/subtitles.srt

mkdir -p dist
ffmpeg -y -loglevel error -i out/video_silent.mp4 -i out/audio.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -shortest -movflags +faststart \
  dist/plus-shop-recharge-demo-1080p.mp4
cp out/subtitles.srt dist/subtitles.srt
node tools/cover.js dist/cover.png
echo "done: dist/plus-shop-recharge-demo-1080p.mp4"
