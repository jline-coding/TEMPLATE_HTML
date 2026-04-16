import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as utils from '../scripts/tools/utils.js';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    statSync: vi.fn(),
    existsSync: vi.fn(),
  };
});
import * as fs from 'fs';

describe('Utils', () => {
  describe('norm()', () => {
    it('should normalize windows paths to posix', () => {
      expect(utils.norm('some\\path\\to\\file.txt')).toBe('some/path/to/file.txt');
    });

    it('should leave posix paths unchanged', () => {
      expect(utils.norm('some/path/to/file.txt')).toBe('some/path/to/file.txt');
    });
  });

  describe('isNewer()', () => {
    it('should return true if source is newer than dest', () => {
      fs.statSync.mockImplementation((filePath) => {
        if (filePath === 'src') return { mtimeMs: 2000 };
        if (filePath === 'dest') return { mtimeMs: 1000 };
        throw new Error('Unexpected param');
      });
      expect(utils.isNewer('src', 'dest')).toBe(true);
    });

    it('should return false if source is older than dest', () => {
      fs.statSync.mockImplementation((filePath) => {
        if (filePath === 'src') return { mtimeMs: 1000 };
        if (filePath === 'dest') return { mtimeMs: 2000 };
        throw new Error('Unexpected param');
      });
      expect(utils.isNewer('src', 'dest')).toBe(false);
    });

    it('should return true if dest does not exist (stat throws)', () => {
      fs.statSync.mockImplementation((filePath) => {
        if (filePath === 'src') return { mtimeMs: 1000 };
        if (filePath === 'dest') throw new Error('ENOENT');
      });
      expect(utils.isNewer('src', 'dest')).toBe(true);
    });
  });

  describe('walkSync()', () => {
    it('should return an empty array if directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(utils.walkSync('fake_dir')).toEqual([]);
    });
  });
});
