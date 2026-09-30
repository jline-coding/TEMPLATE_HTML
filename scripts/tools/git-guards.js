/**
 * scripts/tools/git-guards.js
 * Git Safety & Release Confinement Guards:
 * - Ensures production releases only happen when Git working tree is completely clean
 * - Enforces GitHub as the single source of truth
 * - Prohibits servers / automated scripts from pushing source code back to GitHub
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { PROJECT_ROOT } from './safety.js';

/**
 * Checks whether the current Git working tree is clean (no uncommitted or untracked changes)
 * @param {string} [cwd=PROJECT_ROOT]
 * @returns {{ isClean: boolean, output: string }}
 */
export function checkGitWorkingTree(cwd = PROJECT_ROOT) {
  try {
    const status = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    return {
      isClean: status.length === 0,
      output: status
    };
  } catch (err) {
    // If not a git repository or git command missing
    return {
      isClean: false,
      output: `Git check error: ${err.message}`
    };
  }
}

/**
 * Asserts that the Git working tree is clean before release or production deployment.
 * Halts deployment if uncommitted changes exist.
 * 
 * @param {string} [cwd=PROJECT_ROOT]
 * @throws {Error} If working tree is dirty
 */
export function assertCleanWorkingTree(cwd = PROJECT_ROOT) {
  const { isClean, output } = checkGitWorkingTree(cwd);
  if (!isClean) {
    throw new Error(
      `[RELEASE GUARD] Release bị dừng: Git working tree chưa sạch!\n` +
      `  Vui lòng commit hoặc stash toàn bộ thay đổi trước khi release/deploy.\n` +
      `  Trạng thái hiện tại:\n${output.split('\n').map(l => '    ' + l).join('\n')}`
    );
  }
  return true;
}

/**
 * Validates that an automated pipeline does NOT push source code back to origin.
 * Principle: GitHub is the single source of truth; build/production servers never push code back.
 */
export function assertNoServerPush(command) {
  if (typeof command === 'string' && /git\s+push/i.test(command)) {
    throw new Error(
      `[SECURITY] Vi phạm quy tắc Git: Server/Build script không được phép push source ngược về GitHub!\n` +
      `  GitHub là Source of Truth duy nhất.`
    );
  }
  return true;
}
