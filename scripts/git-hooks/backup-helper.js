import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SRC_DIR = resolve(ROOT, 'src');
const BACKUP_DIR = resolve(ROOT, '.git/src_backups');
const MAX_BACKUPS = 15;

export function createSrcBackup(trigger = 'manual') {
  try {
    if (!existsSync(SRC_DIR)) return null;

    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const targetDir = resolve(BACKUP_DIR, `${timestamp}_${trigger}`);

    cpSync(SRC_DIR, targetDir, { recursive: true });

    // Clean old backups keeping MAX_BACKUPS
    const all = readdirSync(BACKUP_DIR)
      .map(name => ({
        name,
        path: resolve(BACKUP_DIR, name),
        time: statSync(resolve(BACKUP_DIR, name)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (all.length > MAX_BACKUPS) {
      for (const old of all.slice(MAX_BACKUPS)) {
        try {
          rmSync(old.path, { recursive: true, force: true });
        } catch { /* ignore */ }
      }
    }

    return targetDir;
  } catch (err) {
    console.warn('[backup-helper] ⚠️ Không thể tạo bản sao lưu src/:', err.message);
    return null;
  }
}

export function listSrcBackups() {
  if (!existsSync(BACKUP_DIR)) return [];

  return readdirSync(BACKUP_DIR)
    .map(name => {
      const fullPath = resolve(BACKUP_DIR, name);
      const stat = statSync(fullPath);
      return {
        name,
        path: fullPath,
        time: stat.mtimeMs,
        date: new Date(stat.mtimeMs)
      };
    })
    .sort((a, b) => b.time - a.time);
}
