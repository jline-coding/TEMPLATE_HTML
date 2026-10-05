/**
 * scripts/tools/components/ordering.js
 * Intelligent Categorization & Semantic Ordering Engine for Design System & Workbench
 * 
 * Standards & Philosophy:
 * - Natural Website Hierarchy: Header (Top) -> Layout & Skeleton -> UI Components (Body) -> Footer (Bottom)
 * - Atomic Design Progression: Typography -> Controls & Actions -> Forms & Tables -> Containers & Cards -> Navigation & Hero -> Interactive & Rich Media -> Alerts & Utilities
 * - Automatic Semantic Recognition: Handles singular/plural names (btn/btns, grid/grids, title/titles)
 *   and dynamically classifies any newly added component into its most appropriate, professional position.
 */

import { normalizeName } from './metadata.js';

/**
 * High-level Category Flow (Natural Vertical Website Anatomy)
 */
export const CATEGORY_ORDER = {
  header: 1,
  layout: 2,
  component: 3,
  footer: 4
};

/**
 * Layout & Skeleton Semantic Hierarchy
 */
const LAYOUT_RANKS = [
  { pattern: /^(?:l-)?(?:container|wrapper|wrap)$/i, rank: 10, label: 'Khung bao ngoài (Container)' },
  { pattern: /^(?:l-)?(?:grid|grids|col|cols|row|rows)$/i, rank: 20, label: 'Hệ thống lưới (Grids)' },
  { pattern: /^(?:l-)?(?:flex|flexs)$/i, rank: 30, label: 'Bố cục Flexbox (Flex)' },
  { pattern: /^(?:l-)?(?:sidebar|side)$/i, rank: 40, label: 'Khung 2 cột (Sidebar)' },
  { pattern: /^(?:l-)?(?:tbls|table-?layout|tablelayout)$/i, rank: 50, label: 'Bố cục bảng layout (Tables)' },
  { pattern: /^(?:l-)?(?:section|sections|block|blocks)$/i, rank: 60, label: 'Khối section layout' }
];

/**
 * UI Components Semantic Hierarchy (Atomic Design 7-Tier Logic)
 */
const COMPONENT_RANKS = [
  // ── Tier 1: Typography & Text Foundations (Rank 100 - 199) ──
  { pattern: /^(?:c-)?(?:titles?|headings?|ttls?|headline)$/i, rank: 110, tier: 'Typography' },
  { pattern: /^(?:c-)?(?:texts?|txts?|typography|paragraphs?|lead|desc)$/i, rank: 120, tier: 'Typography' },

  // ── Tier 2: Controls, Actions & Atoms (Rank 200 - 299) ──
  { pattern: /^(?:c-)?(?:btns?|buttons?|cta)$/i, rank: 210, tier: 'Action' },
  { pattern: /^(?:c-)?(?:links?|anchors?)$/i, rank: 220, tier: 'Action' },
  { pattern: /^(?:c-)?(?:others?|badges?|tags?|chips?|labels?|pills?)$/i, rank: 230, tier: 'Badges & Tags' },
  { pattern: /^(?:c-)?(?:lists?|bullets?)$/i, rank: 240, tier: 'Lists' },
  { pattern: /^(?:c-)?(?:icons?|avatars?)$/i, rank: 250, tier: 'Icons & Media' },

  // ── Tier 3: Data Entry, Form Controls & Tables (Rank 300 - 399) ──
  { pattern: /^(?:c-)?(?:forms?|inputs?|selects?|checkbox(?:es)?|radios?|textarea|switch(?:es)?)$/i, rank: 310, tier: 'Forms' },
  { pattern: /^(?:c-)?(?:tbl|tables?|data-?table)$/i, rank: 320, tier: 'Tables' },

  // ── Tier 4: Containers, Cards & Boxes (Rank 400 - 499) ──
  { pattern: /^(?:c-)?(?:box(?:es)?|boxs|cards?|panels?|tiles?|media-?objects?)$/i, rank: 410, tier: 'Containers & Cards' },

  // ── Tier 5: Navigation & Page Sections (Rank 500 - 599) ──
  { pattern: /^(?:c-)?(?:mv|mainvisual|main-?visual|hero(?:es)?|banners?|keyvisual)$/i, rank: 510, tier: 'Hero & Sections' },
  { pattern: /^(?:c-)?(?:bread(?:crumbs?)?)$/i, rank: 520, tier: 'Navigation' },
  { pattern: /^(?:c-)?(?:paginations?|pagers?|paging)$/i, rank: 530, tier: 'Navigation' },
  { pattern: /^(?:c-)?(?:tabs?)$/i, rank: 540, tier: 'Navigation' },
  { pattern: /^(?:c-)?(?:steps?|steppers?)$/i, rank: 550, tier: 'Navigation' },
  { pattern: /^(?:c-)?(?:page-?nav|anchor-?nav|sub-?nav)$/i, rank: 560, tier: 'Navigation' },

  // ── Tier 6: Interactive & Rich Media (Rank 600 - 699) ──
  { pattern: /^(?:c-)?(?:sliders?|carousels?|swipers?|slicks?|galleries|gallery)$/i, rank: 610, tier: 'Interactive' },
  { pattern: /^(?:c-)?(?:accordions?|collapses?|faqs?)$/i, rank: 620, tier: 'Interactive' },
  { pattern: /^(?:c-)?(?:popups?|modals?|dialogs?|drawers?)$/i, rank: 630, tier: 'Interactive' },
  { pattern: /^(?:c-)?(?:tooltips?|popovers?)$/i, rank: 640, tier: 'Interactive' },

  // ── Tier 7: Alerts, Feedback & System Utilities (Rank 700 - 799) ──
  { pattern: /^(?:c-)?(?:cookies?|cookie-?banner|consent)$/i, rank: 710, tier: 'Utilities' },
  { pattern: /^(?:c-)?(?:alerts?|notices?|notifications?|toasts?|messages?)$/i, rank: 720, tier: 'Utilities' },
  { pattern: /^(?:c-)?(?:loadings?|spinners?|skeletons?|progress)$/i, rank: 730, tier: 'Utilities' },
  { pattern: /^(?:c-)?(?:totop|scroll-?top|back-?to-?top)$/i, rank: 740, tier: 'Utilities' }
];

/**
 * Computes semantic ranking weight for any component name within its category
 * @param {string} rawName 
 * @param {'header'|'layout'|'component'|'footer'} category 
 * @returns {number}
 */
export function getComponentSemanticRank(rawName, category = 'component') {
  const norm = normalizeName(rawName);

  if (category === 'header') {
    if (/^header(?:_01)?$/i.test(norm)) return 10;
    if (/^gnavi/i.test(norm)) return 20;
    if (/nav/i.test(norm)) return 30;
    return 40;
  }

  if (category === 'footer') {
    if (/^footer(?:_01)?$/i.test(norm)) return 10;
    if (/copyright/i.test(norm)) return 20;
    if (/sitemap/i.test(norm)) return 30;
    return 40;
  }

  if (category === 'layout') {
    for (const item of LAYOUT_RANKS) {
      if (item.pattern.test(norm)) return item.rank;
    }
    // Partial keywords for layout
    if (/container|wrap/i.test(norm)) return 15;
    if (/grid|col|row/i.test(norm)) return 25;
    if (/flex/i.test(norm)) return 35;
    if (/sidebar|side/i.test(norm)) return 45;
    if (/tbl|table/i.test(norm)) return 55;
    return 80;
  }

  // Component Category
  for (const item of COMPONENT_RANKS) {
    if (item.pattern.test(norm)) return item.rank;
  }

  // Partial keyword matching for compound user-created components (e.g. "product-card", "contact-form")
  if (/title|heading|ttl/i.test(norm)) return 115;
  if (/text|txt|typography/i.test(norm)) return 125;
  if (/btn|button|cta/i.test(norm)) return 215;
  if (/link|anchor/i.test(norm)) return 225;
  if (/badge|tag|chip|label/i.test(norm)) return 235;
  if (/list/i.test(norm)) return 245;
  if (/form|input|select|check|radio/i.test(norm)) return 315;
  if (/tbl|table/i.test(norm)) return 325;
  if (/box|card|panel/i.test(norm)) return 415;
  if (/mv|hero|banner/i.test(norm)) return 515;
  if (/bread/i.test(norm)) return 525;
  if (/page|pager|paging|tab/i.test(norm)) return 545;
  if (/slider|swiper|carousel/i.test(norm)) return 615;
  if (/accordion|faq|collapse/i.test(norm)) return 625;
  if (/popup|modal|dialog/i.test(norm)) return 635;
  if (/cookie|alert|notice|toast/i.test(norm)) return 725;

  // Unclassified new components get placed at Rank 850 (neatly alphabetized)
  return 850;
}

/**
 * Universal Component Comparator for sorting
 * Enforces:
 * 1. Category hierarchy: Header -> Layout -> Component -> Footer
 * 2. Semantic Rank within category
 * 3. Stable alphabetical order for ties
 * 
 * @param {Object} a - Component object with category & name
 * @param {Object} b - Component object with category & name
 * @returns {number}
 */
export function compareComponents(a, b) {
  const catA = CATEGORY_ORDER[a.category] || 99;
  const catB = CATEGORY_ORDER[b.category] || 99;
  if (catA !== catB) return catA - catB;

  const rankA = getComponentSemanticRank(a.name, a.category);
  const rankB = getComponentSemanticRank(b.name, b.category);
  if (rankA !== rankB) return rankA - rankB;

  return (a.name || '').localeCompare(b.name || '');
}

/**
 * Sorts an array of component objects using the Design System Ordering Engine
 * @param {Array<Object>} components 
 * @returns {Array<Object>}
 */
export function sortComponentRegistry(components) {
  if (!Array.isArray(components)) return [];
  return [...components].sort(compareComponents);
}
