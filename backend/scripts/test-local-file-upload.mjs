/**
 * Quick local file storage smoke test (no Cloudinary).
 * Run: node scripts/test-local-file-upload.mjs
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const filesDir = path.join(backendRoot, 'files');
const apiBase = process.env.BACKEND_DOMAIN ?? 'http://localhost:6001';

async function main() {
  const onDisk = (await fs.readdir(filesDir)).filter((f) => !f.startsWith('.'));
  if (onDisk.length === 0) {
    console.error('No files in backend/files — upload one first.');
    process.exit(1);
  }

  const sample = onDisk[0];
  const expectedPath = `/api/v1/files/${sample}`;
  const downloadUrl = `${apiBase}${expectedPath}`;

  console.log('On-disk file:', sample);
  console.log('Expected storage path:', expectedPath);
  console.log('Fetch URL:', downloadUrl);

  const res = await fetch(downloadUrl);
  console.log('HTTP status:', res.status, res.statusText);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('Content-Length:', res.headers.get('content-length'));

  if (!res.ok) {
    console.error('Download failed');
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const diskBuf = await fs.readFile(path.join(filesDir, sample));

  if (buf.length !== diskBuf.length) {
    console.error(`Size mismatch: downloaded ${buf.length} vs disk ${diskBuf.length}`);
    process.exit(1);
  }

  console.log('OK — downloaded bytes match file on disk.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
