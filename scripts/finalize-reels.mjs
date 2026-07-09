// Turn each 'reel' post's raw parts into a finished Reel MP4: mux the WAV audio in
// AND append the scoreboard image as a ~2.5s end-card, in one ffmpeg pass. Reads
// the manifest; carousel posts are left untouched. Requires ffmpeg on PATH.
//
// Usage: node scripts/finalize-reels.mjs <dir>

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const dir = process.argv[2]
if (!dir) { console.error('usage: node scripts/finalize-reels.mjs <dir>'); process.exit(2) }
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
const BOARD_SEC = '2.5'

for (const post of manifest.posts) {
  if (post.kind !== 'reel') continue
  const video = path.join(dir, post.video)
  const wav = video.replace(/\.mp4$/, '.wav')
  const board = path.join(dir, post.board)
  const tmp = path.join(dir, `fin-${post.video}`)
  console.log(`finalizing reel ${post.video} (+ ${post.board})`)

  execFileSync('ffmpeg', [
    '-y',
    '-i', video,                                              // 0: video-only
    '-i', wav,                                                // 1: soundtrack
    '-loop', '1', '-t', BOARD_SEC, '-i', board,               // 2: board still
    '-f', 'lavfi', '-t', BOARD_SEC, '-i', 'anullsrc=channel_layout=mono:sample_rate=48000', // 3: silence
    '-filter_complex',
      '[0:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p[v0];' +
      '[2:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p[v1];' +
      '[v0][1:a][v1][3:a]concat=n=2:v=1:a=1[v][a]',
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    tmp,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })

  fs.renameSync(tmp, video)
  fs.rmSync(wav, { force: true })
}
console.log('reels finalized')
