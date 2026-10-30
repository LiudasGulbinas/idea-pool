# Intro video (public/intro.mp4)

How the 30-second tour was made, so it can be re-made when the app changes:

1. `npm run build && npx vite preview --port 4178`, then `node capture.mjs <dir>/shots` — screenshots of the real app with demo data (Supabase is mocked).
2. `node frames.mjs <dir>` — 720×1280 frames: caption + app screen in a phone frame (copy `public/icon.svg` to `<dir>/icon.svg` first).
3. Voice-over: `pip install piper-tts`, voice model `en_US-joe-medium` (CC0, npm package `vowel-lab-voices-float`),
   `python3 make_config.py joe.onnx.json`, then for each line in `lines.txt`: `python3 say.py float.onnx joe.onnx.json "<text>" raw_<id>.wav`
   and `ffmpeg -i raw_<id>.wav -af "atempo=1.07,loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -ac 1 <id>.wav`.
4. `python3 compose.py <dir> <tts dir> public` — writes `intro.mp4`, `intro-poster.jpg` and `intro.vtt` (subtitles).

To use your own recording instead, replace `public/intro.mp4` (portrait 9:16 works best) and delete or update `intro.vtt`.
