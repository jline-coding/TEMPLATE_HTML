import { describe, it, expect } from 'vitest';
import {
  CATEGORY_ORDER,
  getComponentSemanticRank,
  compareComponents,
  sortComponentRegistry
} from '../scripts/tools/components/ordering.js';

describe('Design System Ordering & Semantic Classification Engine', () => {
  it('enforces natural vertical category order: header -> layout -> component -> footer', () => {
    expect(CATEGORY_ORDER.header).toBeLessThan(CATEGORY_ORDER.layout);
    expect(CATEGORY_ORDER.layout).toBeLessThan(CATEGORY_ORDER.component);
    expect(CATEGORY_ORDER.component).toBeLessThan(CATEGORY_ORDER.footer);
  });

  describe('Layout Rank Hierarchy', () => {
    it('orders layout from outer skeleton to inner columns', () => {
      const containerRank = getComponentSemanticRank('container', 'layout');
      const gridRank = getComponentSemanticRank('grids', 'layout');
      const flexRank = getComponentSemanticRank('flexs', 'layout');
      const sidebarRank = getComponentSemanticRank('sidebar', 'layout');
      const tblsRank = getComponentSemanticRank('tbls', 'layout');

      expect(containerRank).toBeLessThan(gridRank);
      expect(gridRank).toBeLessThan(flexRank);
      expect(flexRank).toBeLessThan(sidebarRank);
      expect(sidebarRank).toBeLessThan(tblsRank);
    });

    it('recognizes singular and plural layout names equally', () => {
      expect(getComponentSemanticRank('grid', 'layout')).toBe(getComponentSemanticRank('grids', 'layout'));
      expect(getComponentSemanticRank('flex', 'layout')).toBe(getComponentSemanticRank('flexs', 'layout'));
      expect(getComponentSemanticRank('wrap', 'layout')).toBe(getComponentSemanticRank('wrapper', 'layout'));
    });
  });

  describe('Component Rank Hierarchy (Atomic Progression)', () => {
    it('places typography before buttons, buttons before forms, forms before cards', () => {
      const titleRank = getComponentSemanticRank('titles', 'component');
      const textRank = getComponentSemanticRank('texts', 'component');
      const btnRank = getComponentSemanticRank('btn', 'component');
      const linkRank = getComponentSemanticRank('links', 'component');
      const formRank = getComponentSemanticRank('form', 'component');
      const boxRank = getComponentSemanticRank('boxs', 'component');
      const sliderRank = getComponentSemanticRank('slider', 'component');
      const popupRank = getComponentSemanticRank('popup', 'component');

      expect(titleRank).toBeLessThan(textRank);
      expect(textRank).toBeLessThan(btnRank);
      expect(btnRank).toBeLessThan(linkRank);
      expect(linkRank).toBeLessThan(formRank);
      expect(formRank).toBeLessThan(boxRank);
      expect(boxRank).toBeLessThan(sliderRank);
      expect(sliderRank).toBeLessThan(popupRank);
    });

    it('places button (btn/btns) into actions tier and not at the bottom', () => {
      const btnRank = getComponentSemanticRank('btn', 'component');
      const btnsRank = getComponentSemanticRank('btns', 'component');
      expect(btnRank).toBe(btnsRank);
      expect(btnRank).toBeLessThan(300); // Level 2: Actions
    });
  });

  describe('Automatic Categorization & Sorting for newly added components', () => {
    it('intelligently slots new components into their optimal tier', () => {
      const inputList = [
        { name: 'cookie', category: 'component' },
        { name: 'accordion', category: 'component' },
        { name: 'card', category: 'component' },
        { name: 'container', category: 'layout' },
        { name: 'header', category: 'header' },
        { name: 'footer', category: 'footer' },
        { name: 'select', category: 'component' },
        { name: 'button_cta', category: 'component' }
      ];

      const sorted = sortComponentRegistry(inputList);
      const names = sorted.map(i => i.name);

      expect(names).toEqual([
        'header',
        'container',
        'button_cta',
        'select',
        'card',
        'accordion',
        'cookie',
        'footer'
      ]);
    });

    it('gracefully sorts unknown custom components at the end alphabetically', () => {
      const inputList = [
        { name: 'z_widget', category: 'component' },
        { name: 'a_widget', category: 'component' },
        { name: 'btn', category: 'component' }
      ];

      const sorted = sortComponentRegistry(inputList);
      expect(sorted.map(i => i.name)).toEqual(['btn', 'a_widget', 'z_widget']);
    });
  });
});
