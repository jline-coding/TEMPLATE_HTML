import { describe, it, expect } from 'vitest';
import {
  findRuleBlockRange,
  isModifierInBlock,
  sliceScssForClasses,
  mergeVariantScss,
  removeVariantFromScss
} from '../scripts/tools/components/variants.js';

describe('Block-Scoped Modifier Engine (No Cross-Component Collisions)', () => {
  const multiComponentScss = `
@use "sass:math";
@use "../global" as *;

.c-title {
  display: flex;
  &--center {
    text-align: center;
  }
}

.c-ttl30 {
  font-size: 30px;
  &--line {
    border-bottom: 2px solid red;
  }
  &--dot {
    list-style: circle;
  }
}

.c-ttl20 {
  font-size: 20px;
}
`;

  it('accurately locates rule block ranges without confusing substring classes', () => {
    const ttl30Range = findRuleBlockRange(multiComponentScss, 'c-ttl30');
    expect(ttl30Range).toBeDefined();
    expect(ttl30Range.content).toContain('font-size: 30px');
    expect(ttl30Range.content).toContain('&--line');
    expect(ttl30Range.content).not.toContain('font-size: 20px');

    const ttl20Range = findRuleBlockRange(multiComponentScss, 'c-ttl20');
    expect(ttl20Range).toBeDefined();
    expect(ttl20Range.content).toContain('font-size: 20px');
    expect(ttl20Range.content).not.toContain('&--line');
  });

  it('checks modifier presence strictly inside the specific block (no false positives)', () => {
    const ttl30Range = findRuleBlockRange(multiComponentScss, 'c-ttl30');
    const ttl20Range = findRuleBlockRange(multiComponentScss, 'c-ttl20');

    expect(isModifierInBlock(ttl30Range.content, '--line')).toBe(true);
    expect(isModifierInBlock(ttl30Range.content, '--dot')).toBe(true);
    expect(isModifierInBlock(ttl20Range.content, '--line')).toBe(false);
    expect(isModifierInBlock(ttl20Range.content, '--dot')).toBe(false);
  });

  it('slices only the requested base class and requested modifier', () => {
    const sliced = sliceScssForClasses(multiComponentScss, 'c-ttl30 c-ttl30--line');
    expect(sliced).toContain('.c-ttl30');
    expect(sliced).toContain('&--line');
    expect(sliced).not.toContain('&--dot');
    expect(sliced).not.toContain('.c-ttl20');
    expect(sliced).not.toContain('.c-title');
  });

  it('merges modifier into target block even when other blocks already have the same modifier name', () => {
    const incomingTtl20WithLine = `
.c-ttl20 {
  font-size: 20px;
  &--line {
    border-bottom: 1px dashed blue;
  }
}
`;

    const merged = mergeVariantScss(multiComponentScss, incomingTtl20WithLine, 'c-ttl20 c-ttl20--line');

    // Both c-ttl30 and c-ttl20 must now have &--line
    const ttl30Range = findRuleBlockRange(merged, 'c-ttl30');
    const ttl20Range = findRuleBlockRange(merged, 'c-ttl20');

    expect(ttl30Range.content).toContain('&--line');
    expect(ttl30Range.content).toContain('border-bottom: 2px solid red');

    expect(ttl20Range.content).toContain('&--line');
    expect(ttl20Range.content).toContain('border-bottom: 1px dashed blue');
  });

  it('does not duplicate modifier if target block already has it', () => {
    const incomingDuplicate = `
.c-ttl30 {
  font-size: 30px;
  &--line {
    border-bottom: 99px solid green;
  }
}
`;
    const merged = mergeVariantScss(multiComponentScss, incomingDuplicate, 'c-ttl30 c-ttl30--line');
    const matches = (merged.match(/&--line/g) || []).length;
    expect(matches).toBe(1); // Still only 1 occurrence in c-ttl30
  });

  it('supports standalone modifier classes (.c-base--modifier outside parent block)', () => {
    const scssWithStandalone = `
.c-box {
  padding: 20px;
}
.c-box--border {
  border: 1px solid #ccc;
}
`;
    expect(isModifierInBlock('', '--border', scssWithStandalone, 'c-box')).toBe(true);
    expect(isModifierInBlock('', '--primary', scssWithStandalone, 'c-box')).toBe(false);

    const sliced = sliceScssForClasses(scssWithStandalone, 'c-box c-box--border');
    expect(sliced).toContain('.c-box');
    expect(sliced).toContain('.c-box--border');
  });

  it('removes modifier strictly from the target block without touching identical modifier in other blocks', () => {
    const scssWithBoth = `
.c-ttl30 {
  font-size: 30px;
  &--line {
    border-bottom: 2px solid red;
  }
}
.c-ttl20 {
  font-size: 20px;
  &--line {
    border-bottom: 1px dashed blue;
  }
}
`;
    // Remove c-ttl20--line, while c-ttl30--line remains in remainingEjs
    const remainingEjs = '<h3 class="c-ttl30 c-ttl30--line">Title</h3>';
    const updated = removeVariantFromScss(scssWithBoth, remainingEjs, 'c-ttl20--line');

    const ttl30 = findRuleBlockRange(updated, 'c-ttl30');
    const ttl20 = findRuleBlockRange(updated, 'c-ttl20');

    expect(ttl30.content).toContain('&--line');
    expect(ttl20.content).not.toContain('&--line');
  });
});
