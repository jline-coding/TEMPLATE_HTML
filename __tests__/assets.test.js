import { describe, it, expect, vi } from 'vitest';
import { resolve, norm } from 'path';

// Mock config module before importing assets.js
vi.mock('../scripts/tools/config.js', () => {
    return {
        isRenew: false,
        PAGES_DIR: 'src/pages',
        DIST: 'public',
        JS_DIR: 'src/pages/assets/js',
        VENDOR_DIR: 'src/pages/assets/vendor',
        IMAGES_DIR: 'src/pages/assets/images',
        VIDEOS_DIR: 'src/pages/assets/videos'
    };
});

import { isHandledBySpecificBuilder } from '../scripts/builders/assets.js';

describe('Assets Builder - isHandledBySpecificBuilder', () => {
  it('should return true for JS files in JS_DIR', () => {
      // Must use absolute path mapping because the function uses resolve(filepath)
      expect(isHandledBySpecificBuilder('src/pages/assets/js/main.js')).toBe(true);
  });

  it('should return false for JS files outside JS_DIR', () => {
      expect(isHandledBySpecificBuilder('src/pages/components/main.js')).toBe(false);
  });

  it('should return true for image files in IMAGES_DIR', () => {
      expect(isHandledBySpecificBuilder('src/pages/assets/images/photo.webp')).toBe(true);
      expect(isHandledBySpecificBuilder('src/pages/assets/images/logo.png')).toBe(true);
      expect(isHandledBySpecificBuilder('src/pages/assets/images/icon.svg')).toBe(true);
  });

  it('should return false for images outside IMAGES_DIR', () => {
      expect(isHandledBySpecificBuilder('src/pages/assets/vendor/icon.svg')).toBe(true); // vendor handles this!
      expect(isHandledBySpecificBuilder('src/pages/outside.png')).toBe(false);
  });

  it('should return true for vendor files', () => {
      expect(isHandledBySpecificBuilder('src/pages/assets/vendor/plugin.js')).toBe(true);
      expect(isHandledBySpecificBuilder('src/pages/assets/vendor/style.css')).toBe(true);
      expect(isHandledBySpecificBuilder('src/pages/assets/vendor/font.woff2')).toBe(true);
  });

  it('should return false for unknown asset types', () => {
      expect(isHandledBySpecificBuilder('src/pages/assets/images/data.json')).toBe(false);
  });
});
