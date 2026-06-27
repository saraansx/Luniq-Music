import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const binaryPath = join(root, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

async function main() {
  let version;
  try {
    version = execSync(`"${binaryPath}" --version`, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch {
    console.log('[verify-yt-dlp] Binary not found — skipping (yt-dlp-exec postinstall may not have run yet)');
    return;
  }

  console.log(`[verify-yt-dlp] Checking yt-dlp ${version} against official checksums...`);

  const shaRes = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${version}/SHA2-256SUMS`);
  if (!shaRes.ok) {
    console.warn(`[verify-yt-dlp] Could not fetch checksums (HTTP ${shaRes.status}) — skipping`);
    return;
  }

  const shaText = await shaRes.text();
  const expectedHash = shaText
    .split('\n')
    .find(line => line.trim().endsWith('yt-dlp.exe'))
    ?.split(/\s+/)[0]
    ?.toLowerCase();

  if (!expectedHash) {
    console.warn('[verify-yt-dlp] Could not find yt-dlp.exe entry in checksums — skipping');
    return;
  }

  const buf = await readFile(binaryPath);
  const actualHash = createHash('sha256').update(buf).digest('hex').toLowerCase();

  if (actualHash !== expectedHash) {
    console.error(`[verify-yt-dlp] HASH MISMATCH! Expected ${expectedHash}, got ${actualHash}`);
    console.log('[verify-yt-dlp] Re-downloading from official source...');

    const dlRes = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${version}/yt-dlp.exe`);
    if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`);

    const dlBuf = Buffer.from(await dlRes.arrayBuffer());
    const dlHash = createHash('sha256').update(dlBuf).digest('hex').toLowerCase();

    if (dlHash !== expectedHash) {
      throw new Error(`Re-downloaded binary also fails hash check! Expected ${expectedHash}, got ${dlHash}`);
    }

    await writeFile(binaryPath, dlBuf);
    console.log('[verify-yt-dlp] Re-downloaded and verified successfully');
  } else {
    console.log('[verify-yt-dlp] OK — hash matches official release');
  }
}

main().catch(err => {
  console.error('[verify-yt-dlp] FAILED:', err.message);
  process.exit(1);
});
