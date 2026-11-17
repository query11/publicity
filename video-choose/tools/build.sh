#!/usr/bin/env bash
# Full pipeline: render frames -> synthesize audio -> mux -> subtitles -> cover.
#   bash tools/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out dist

node tools/make_qr.js
node tools/render.js meta out/meta.json
node tools/render.js video out/video_silent.mp4 "${WORKERS:-4}"
python3 tools/audio.py out/meta.json out/audio.wav
python3 tools/make_srt.py out/meta.json out/subtitles.srt

ffmpeg -y -loglevel error -i out/video_silent.mp4 -i out/audio.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -af "loudnorm=I=-18:TP=-1.5:LRA=11" -shortest -movflags +faststart \
  dist/plus-pro-choose-1080p.mp4
cp out/subtitles.srt dist/subtitles.srt
node tools/cover.js dist/cover.png
echo "done: dist/plus-pro-choose-1080p.mp4"
