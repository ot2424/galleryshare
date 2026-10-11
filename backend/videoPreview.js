import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getSignedR2Url, uploadFileStreamSafe } from './r2.js';

export const isVideo = name => /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i.test(name || '');

// Each queue has one worker; poster extraction cannot wait behind a long transcode.
export function createVideoPreviews({ sign = getSignedR2Url, upload = uploadFileStreamSafe, run = runFfmpeg } = {}) {
  const jobs = new Map();
  const errors = new Map();
  const queues = { thumbnail: Promise.resolve(), preview: Promise.resolve() };
  function ensure(db, file, variant = 'preview') {
    const id = `${file.id}:${variant}`;
    if (jobs.has(id)) return jobs.get(id);
    const job = queues[variant].then(async () => {
      const current = await db.get('SELECT * FROM files WHERE id = ?', [file.id]);
      if (!current) throw new Error('Datei nicht mehr vorhanden');
      if (current[variant]) return current;
      const folder = await fs.promises.mkdtemp(path.join(process.env.MEDIA_TEMP_DIR || os.tmpdir(), 'gallery-video-'));
      try {
        const poster = variant === 'thumbnail';
        const output = path.join(folder, poster ? 'poster.jpg' : 'preview.mp4');
        const url = await sign(file.filename, 86400);
        const input = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_threads', '2', '-rw_timeout', '60000000', '-i', url];
        const options = poster
          ? ['-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=decrease', '-q:v', '3']
          : ['-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2',
            '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '25', '-maxrate', '2500k', '-bufsize', '5000k',
            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];
        await run([...input, ...options, output], poster ? 120000 : 6 * 60 * 60 * 1000);
        const stat = await fs.promises.stat(output);
        if (!stat.size) throw new Error('Leere Video-Vorschau');
        const key = `${file.galleryId}/${poster ? 'thumbs' : 'previews'}/${file.id}.${poster ? 'jpg' : 'mp4'}`;
        const stream = fs.createReadStream(output);
        try { await upload(stream, key, poster ? 'image/jpeg' : 'video/mp4'); }
        finally { stream.destroy(); }
        await db.run(`UPDATE files SET ${variant} = ? WHERE id = ?`, [key, file.id]);
        errors.delete(id);
        return { ...current, [variant]: key };
      } finally {
        await fs.promises.rm(folder, { recursive: true, force: true });
      }
    });
    queues[variant] = job.catch(() => {});
    jobs.set(id, job);
    job.catch(() => errors.set(id, Date.now())).finally(() => jobs.delete(id));
    return job;
  }
  function state(file, variant = 'preview') {
    const id = `${file.id}:${variant}`;
    if (file[variant]) return 'ready';
    if (jobs.has(id)) return 'processing';
    if (Date.now() - (errors.get(id) || 0) < 60000) return 'error';
    errors.delete(id);
    return 'pending';
  }
  return { ensure, state };
}

export function runFfmpeg(args, timeoutMs = 6 * 60 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    // Arguments never enter a shell; stderr can contain signed URLs and is not logged.
    const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'ignore'] });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.once('error', () => { clearTimeout(timer); reject(new Error('FFmpeg nicht verfügbar')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('Video-Verarbeitung fehlgeschlagen'));
    });
  });
}
export const videoPreviews = createVideoPreviews();
