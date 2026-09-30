/**
 * clean.js — Remove public output directory safely (P0 Protection)
 */
import { ROOT, DIST, SOURCE_FOLDER } from './tools/config.js';
import { safeRmDir } from './tools/safety.js';

try {
  await safeRmDir(DIST, ROOT);
  console.log(`[clean] ${SOURCE_FOLDER}/ removed safely`);
} catch (err) {
  if (err.message && err.message.includes('[SECURITY P0]')) {
    console.error(`\n❌ ${err.message}\n`);
    process.exitCode = 1;
  } else {
    // Already clean or non-existent
  }
}
