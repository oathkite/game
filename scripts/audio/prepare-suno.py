"""Rebuild provisional game audio from preserved Suno downloads (ffmpeg required)."""
from pathlib import Path
import array
import hashlib
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/workbench/audio/suno-2026-09-11'
DEST = ROOT / 'apps/client/src/assets/audio'
FFMPEG = shutil.which('ffmpeg')
assert FFMPEG, 'ffmpeg is required'
DEST.mkdir(parents=True, exist_ok=True)
records = []


def render(name, candidate, filters, extension):
    source = SOURCE / f'{candidate}.m4a'
    output = DEST / f'{name}.{extension}'
    codec = (['-c:a', 'libopus', '-b:a', '48k', '-vbr', 'constrained'] if extension == 'opus'
             else ['-c:a', 'pcm_s16le'] if extension == 'wav' else ['-c:a', 'libmp3lame', '-q:a', '4'])
    sample_rate = '48000' if extension == 'opus' else '44100'
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', str(source),
                    '-filter_complex', filters, '-map', '[out]', '-ar', sample_rate, *codec, str(output)], check=True)
    subprocess.run([FFMPEG, '-v', 'error', '-i', str(output), '-f', 'null', '-'], check=True)
    records.append({'file': output.name, 'source': source.name, 'filters': filters,
                    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size,
                    'encoderArguments': codec, 'sampleRate': int(sample_rate)})


# A candidates have compact envelopes; tick is the first isolated pulse of a longer sequence.
for name, candidate, start, duration, peak in [
    ('fire', 'fire-a', 0.025, 1.5, .55),
    ('explosion', 'explosion-a', 0.02, 1.8, .65),
    ('hit', 'hit-a', 0.035, .85, .5),
    ('tick', 'tick-a', 0.015, .16, .22),
    ('hit-confirm', 'hit-confirm-a', 0, 1.15, .3),
    ('match-finish', 'match-finish-b', 0, 4.8, .35),
]:
    raw = subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(SOURCE / f'{candidate}.m4a'),
                                   '-ss', str(start), '-t', str(duration), '-f', 'f32le', '-'])
    amplitude = max(abs(value) for value in array.array('f', raw))
    fade = min(.08, duration / 4)
    filters = (f'[0:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,'
               f'volume={peak / amplitude},afade=t=in:d=0.003,'
               f'afade=t=out:st={duration - fade}:d={fade}[out]')
    render(name, candidate, filters, 'wav')
    render(name, candidate, filters, 'opus')

# Crossfade the loop tail into its head offline, then append the untouched middle.
# BPM is prompt metadata, not a verified beat grid; musical phrasing needs listening review.
for name, bpm in [('title', 112), ('lobby', 92), ('battle', 126), ('result', 104)]:
    length = 128 * 60 / bpm
    filters = (f'[0:a]atrim=start=8:duration={length},asetpts=PTS-STARTPTS,asplit=3[h][m][t];'
               f'[h]atrim=end=1,asetpts=PTS-STARTPTS[head];'
               f'[m]atrim=start=1:end={length - 1},asetpts=PTS-STARTPTS[mid];'
               f'[t]atrim=start={length - 1},asetpts=PTS-STARTPTS[tail];'
               '[tail][head]acrossfade=d=1:c1=tri:c2=tri[seam];'
               '[seam][mid]concat=n=2:v=0:a=1,loudnorm=I=-22:TP=-3:LRA=7[out]')
    render(name, f'{name}-a', filters, 'mp3')
    render(name, f'{name}-a', filters, 'opus')

(DEST / 'provenance.json').write_text(json.dumps({
    'status': 'Music direction accepted by user 2026-09-11; final loop review pending',
    'sourceManifest': 'assets/workbench/audio/suno-2026-09-11/download-manifest.json',
    'files': records,
}, ensure_ascii=False, indent=2) + '\n')
print(f'Prepared and decoded {len(records)} files; {sum(r["bytes"] for r in records)} bytes')
