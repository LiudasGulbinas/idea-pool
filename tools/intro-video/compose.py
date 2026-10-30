# Builds intro.mp4 (720x1280, ~30 s) from rendered frames + voice clips, plus intro.vtt subtitles and a poster.
import subprocess, sys, wave, os
import numpy as np

V, T, OUT = sys.argv[1], sys.argv[2], sys.argv[3]  # video dir, tts dir, output dir
FPS, XF, LEAD, GAP, SR = 30, 0.35, 0.3, 0.35, 44100
lines = dict(l.strip().split('|', 1) for l in open(f'{T}/lines.txt') if l.strip())
scenes = [('s0', ['intro']), ('s1', ['feed', 'form']), ('s2', ['analysis']), ('s3', ['likes', 'comments']),
          ('s4', ['avatar', 'teamfit']), ('s5', ['shortlist', 'meeting']), (None, ['outro'])]

def wav(id):
    w = wave.open(f'{T}/{id}.wav'); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    assert w.getframerate() == SR and w.getnchannels() == 1
    return a

clips, cues, t = [], [], 0.0
audio = np.zeros(int(SR * 60), dtype=np.int32)
for i, (vid, frames) in enumerate(scenes):
    lead = LEAD if i == 0 else 0
    if vid:
        a = wav(vid); dur = len(a) / SR
        start = t + lead
        audio[int(start * SR):int(start * SR) + len(a)] += a
        cues.append((start, start + dur, lines[vid]))
        scene_len = lead + dur + GAP
    else:
        scene_len = 1.7
    for f in frames:
        clips.append((f, scene_len / len(frames)))
    t += scene_len
total = t

# 1) one short zooming clip per frame
os.makedirs(f'{V}/clips', exist_ok=True)
for k, (f, d) in enumerate(clips):
    L = d + (XF if k < len(clips) - 1 else 0)
    n = int(round(L * FPS))
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', str(FPS), '-i', f'{V}/frames/{f}.png',
        '-vf', f"scale=1440:2560,zoompan=z='1+0.035*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps={FPS},format=yuv420p",
        '-frames:v', str(n), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', f'{V}/clips/{k:02d}.mp4'], check=True)

# 2) crossfade them together
inputs, chain, off, last = [], [], 0.0, '[0:v]'
for k in range(len(clips)):
    inputs += ['-i', f'{V}/clips/{k:02d}.mp4']
for k in range(1, len(clips)):
    off += clips[k - 1][1]
    out = f'[v{k}]'
    chain.append(f"{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}{out}")
    last = out

# 3) voice track
pcm = np.clip(audio[:int(total * SR)], -32768, 32767).astype(np.int16)
with wave.open(f'{V}/voice.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', *inputs, '-i', f'{V}/voice.wav',
    '-filter_complex', ';'.join(chain), '-map', last, '-map', f'{len(clips)}:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '96k', '-t', f'{total:.3f}', f'{OUT}/intro.mp4'], check=True)
subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', f'{V}/frames/intro.png', '-q:v', '4', f'{OUT}/intro-poster.jpg'], check=True)

ts = lambda s: f'{int(s // 60):02d}:{s % 60:06.3f}'
with open(f'{OUT}/intro.vtt', 'w') as f:
    f.write('WEBVTT\n\n' + '\n'.join(f'{ts(a)} --> {ts(b)}\n{txt}\n' for a, b, txt in cues))
print(f'total {total:.1f}s, {len(clips)} clips')
