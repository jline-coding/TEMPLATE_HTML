/**
 * ============================================================================
 * Inview Animation Engine (Modern FLOCSS & BEM Architecture)
 * ============================================================================
 * Design Principles:
 *   - Ultra-Lightweight : Zero external dependencies, pure native APIs (~3KB).
 *   - Silky Smooth      : Uses requestAnimationFrame, GPU-composited transitions,
 *                         and read/write layout batching to prevent reflow jank.
 *   - Completely Isolated: Zero DOM pollution via WeakMap storage, no inline style
 *                         mutations, and no interference with surrounding blocks.
 *   - Strict Sequencing : Pure Left-to-Right & Top-to-Bottom cascade order.
 *
 * API Syntax Examples:
 *   const movement = new inview.observer({
 *     duration: 800,
 *     distance: {
 *       all: 24,
 *       up: 24,
 *       down: 24,
 *       left: 24,
 *       right: 24,
 *     },
 *     easing: {
 *       all: 'cubic-bezier(0.16, 1, 0.3, 1)',
 *       fadeIn: 'ease-out',
 *       fadeUp: 'cubic-bezier(0.16, 1, 0.3, 1)',
 *       fadeZoom: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
 *       fadeBounce: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
 *     },
 *     scaleZoom: { in: 0.85, out: 1.15 },
 *     scaleBounce: { in: 0.3, out: 1.25 },
 *     stagger: 200,
 *     simultaneous: false,
 *     loop: false,
 *   });
 *   movement.init(); // Optional: auto-initializes by default, safe to call explicitly.
 *
 * Configuration Options:
 *   - duration     : Animation transition/keyframe duration in ms (e.g., 800) or CSS string ('0.8s')
 *   - distance     : Travel distance object { all, up, down, left, right } or number/string
 *   - easing       : Timing functions object { all, fadeIn, fadeUp, fadeDown, fadeLeft, fadeRight, fadeZoom, fadeBounce } or string
 *   - scaleZoom    : Zoom scale object { in: 0.85, out: 1.15 } for .c-inview--zoom-in / --zoom-out
 *   - scaleBounce  : Bounce scale object { in: 0.3, out: 1.25 } (50% overshoot & 70% rebound auto-computed via spring physics)
 *   - stagger      : Sequence stagger delay in ms between sequential elements/rows (default: 200)
 *   - delay        : Initial delay offset in ms before cascade begins (default: 0)
 *   - simultaneous : false: item-by-item left-to-right, then top-to-bottom; true: row-by-row simultaneous
 *   - loop         : false: trigger once and unobserve immediately; true: replay on scroll out/in
 * ============================================================================
 */

(function (root, factory) {
  const exported = factory();

  if (typeof define === 'function' && define.amd) {
    define([], function () { return exported; });
  }

  if (typeof exports === 'object') {
    if (typeof module === 'object' && module.exports) {
      module.exports = exported;
    }
    exports.Inview = exported.Inview;
    exports.inview = exported.inview;
  }

  if (root) {
    root.Inview = exported.Inview;
    root.inview = exported.inview;
  }

  if (typeof window !== 'undefined') {
    window.Inview = exported.Inview;
    window.inview = exported.inview;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.Inview = exported.Inview;
    globalThis.inview = exported.inview;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /**
   * Default engine configuration.
   */
  const DEFAULTS = {
    // Core motion parameters (User-facing)
    duration: 800,
    distance: {
      all: 24,
      up: undefined,
      down: undefined,
      left: undefined,
      right: undefined,
    },
    easing: {
      all: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fadeIn: undefined,
      fadeUp: undefined,
      fadeDown: undefined,
      fadeLeft: undefined,
      fadeRight: undefined,
      fadeZoom: undefined,
      fadeBounce: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    },
    scaleZoom: {
      in: 0.85,
      out: 1.15,
    },
    scaleBounce: {
      in: 0.3,
      out: 1.25,
    },
    stagger: 200,
    delay: 0,
    startDelay: 0,
    simultaneous: false,
    loop: false,

    // Internal engine plumbing (Encapsulated defaults)
    selector: '.c-inview, .js-inview',
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.1,
    rowTolerance: 18,
    stateClass: 'is-inview',
    activeClass: 'is-active',
    autoInit: true,
  };

  /**
   * Helper to format a distance measurement into a valid CSS unit string.
   *
   * @param {number|string} val
   * @returns {string|null}
   */
  function formatDistance(val) {
    if (val === null || val === undefined) return null;
    return typeof val === 'number' ? `${val}px` : String(val).trim();
  }

  /**
   * Automatically calculate spring physics inflection points for bounce-in.
   * Based on damped harmonic spring: s_in -> overshoot (50%) -> rebound (70%) -> 1.0 (100%).
   *
   * @param {number|string} scaleIn
   * @returns {{ scale: number, overshoot: number, rebound: number }}
   */
  function computeBounceInPhysics(scaleIn) {
    const s = typeof scaleIn === 'number' ? scaleIn : parseFloat(scaleIn) || 0.3;
    const delta = Math.max(0, 1 - s);
    const overshoot = Number((1 + delta * 0.0714).toFixed(3));
    const rebound = Number((1 - delta * 0.0571).toFixed(3));
    return { scale: s, overshoot, rebound };
  }

  /**
   * Automatically calculate spring physics inflection points for bounce-out.
   * Based on damped harmonic spring: s_out -> overshoot (50%) -> rebound (70%) -> 1.0 (100%).
   *
   * @param {number|string} scaleOut
   * @returns {{ scale: number, overshoot: number, rebound: number }}
   */
  function computeBounceOutPhysics(scaleOut) {
    const s = typeof scaleOut === 'number' ? scaleOut : parseFloat(scaleOut) || 1.25;
    const delta = Math.max(0, s - 1);
    const overshoot = Number((1 - delta * 0.16).toFixed(3));
    const rebound = Number((1 + delta * 0.12).toFixed(3));
    return { scale: s, overshoot, rebound };
  }

  /**
   * WeakMap for private element metadata storage.
   * Completely avoids polluting DOM element nodes and prevents memory leaks.
   */
  const elementRegistry = new WeakMap();

  /**
   * Helper to retrieve or initialize element metadata.
   *
   * @param {HTMLElement} element
   * @returns {Object}
   */
  function getMetadata(element) {
    let data = elementRegistry.get(element);
    if (!data) {
      data = {
        timerId: null,
        isTriggered: false,
      };
      elementRegistry.set(element, data);
    }
    return data;
  }

  /**
   * Calculate absolute document layout position of an element.
   * Walks the offsetParent hierarchy to compute clean layout coordinates
   * completely immune to CSS transforms (translate, scale, etc.).
   *
   * @param {HTMLElement} element
   * @returns {{ top: number, left: number }}
   */
  function getElementLayoutPos(element) {
    let top = 0;
    let left = 0;
    let current = element;

    while (current) {
      top += current.offsetTop || 0;
      left += current.offsetLeft || 0;
      current = current.offsetParent;
    }

    return { top, left };
  }

  /**
   * Modern Inview Engine Class.
   */
  class Inview {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
      // Normalize distance option (support both flat number/string and granular object)
      let distanceObj;
      if (typeof options.distance === 'number' || typeof options.distance === 'string') {
        distanceObj = Object.assign({}, DEFAULTS.distance, { all: options.distance });
      } else if (typeof options.distance === 'object' && options.distance !== null) {
        distanceObj = Object.assign({}, DEFAULTS.distance, options.distance);
      } else {
        distanceObj = Object.assign({}, DEFAULTS.distance);
      }

      // Normalize easing option (support both string and granular object)
      let easingObj;
      if (typeof options.easing === 'string') {
        easingObj = Object.assign({}, DEFAULTS.easing, { all: options.easing });
      } else if (typeof options.easing === 'object' && options.easing !== null) {
        easingObj = Object.assign({}, DEFAULTS.easing, options.easing);
      } else {
        easingObj = Object.assign({}, DEFAULTS.easing);
      }

      // Normalize scaleZoom option (support both { in, out } and legacy scaleIn/scaleOut)
      const scaleZoomObj = Object.assign({}, DEFAULTS.scaleZoom);
      if (options.scaleZoom && typeof options.scaleZoom === 'object') {
        if (options.scaleZoom.in !== undefined) scaleZoomObj.in = options.scaleZoom.in;
        if (options.scaleZoom.out !== undefined) scaleZoomObj.out = options.scaleZoom.out;
      }
      if (options.scaleIn !== undefined) scaleZoomObj.in = options.scaleIn;
      if (options.scaleOut !== undefined) scaleZoomObj.out = options.scaleOut;

      // Normalize scaleBounce option (support both { in, out } and legacy bounceInScale/bounceOutScale)
      const scaleBounceObj = Object.assign({}, DEFAULTS.scaleBounce);
      if (options.scaleBounce && typeof options.scaleBounce === 'object') {
        if (options.scaleBounce.in !== undefined) scaleBounceObj.in = options.scaleBounce.in;
        if (options.scaleBounce.out !== undefined) scaleBounceObj.out = options.scaleBounce.out;
      }
      if (options.bounceInScale !== undefined) scaleBounceObj.in = options.bounceInScale;
      if (options.bounceOutScale !== undefined) scaleBounceObj.out = options.bounceOutScale;

      this.options = Object.assign({}, DEFAULTS, options, {
        distance: distanceObj,
        easing: easingObj,
        scaleZoom: scaleZoomObj,
        scaleBounce: scaleBounceObj,
      });
      this.observer = null;
      this.observedSet = new Set();
      this.scrollFallbackActive = false;
      this.scrollTimer = null;
      this.isInitialized = false;

      this.handleIntersect = this.handleIntersect.bind(this);
      this.handleScrollFallback = this.handleScrollFallback.bind(this);

      // Register primary instance
      if (!globalInstance) {
        globalInstance = this;
      }

      // Auto-initialize if DOM is ready or schedule on DOMContentLoaded
      if (this.options.autoInit !== false) {
        if (typeof document !== 'undefined') {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init(), { once: true });
          } else {
            this.init();
          }
        }
      }
    }

    /**
     * Initialize observer or fallback engine.
     * Idempotent: safe to call multiple times.
     */
    init() {
      if (this.isInitialized) {
        this.refresh();
        return this;
      }
      this.isInitialized = true;

      if (typeof window === 'undefined') return this;

      // Inject global motion tokens as CSS custom properties
      this.applyGlobalTokens();

      if (
        'IntersectionObserver' in window &&
        'IntersectionObserverEntry' in window &&
        'intersectionRatio' in window.IntersectionObserverEntry.prototype
      ) {
        this.observer = new IntersectionObserver(this.handleIntersect, {
          root: null,
          rootMargin: this.options.rootMargin,
          threshold: this.options.threshold,
        });
      } else {
        this.scrollFallbackActive = true;
        window.addEventListener('scroll', this.handleScrollFallback, { passive: true });
        window.addEventListener('resize', this.handleScrollFallback, { passive: true });
      }

      this.observeAll();
      return this;
    }

    /**
     * Scan the DOM and observe all elements matching the selector.
     */
    observeAll() {
      const elements = document.querySelectorAll(this.options.selector);
      for (let i = 0; i < elements.length; i++) {
        this.observe(elements[i]);
      }

      if (this.scrollFallbackActive) {
        this.checkScrollFallback();
      }
    }

    /**
     * Observe a single target element.
     *
     * @param {HTMLElement} element
     */
    observe(element) {
      if (!element || !(element instanceof HTMLElement) || this.observedSet.has(element)) {
        return;
      }

      this.observedSet.add(element);

      // Pre-apply element-level motion tokens if specified in data attributes
      this.applyElementTokens(element);

      if (this.observer) {
        this.observer.observe(element);
      }
    }

    /**
     * Unobserve a target element.
     *
     * @param {HTMLElement} element
     */
    unobserve(element) {
      if (!element || !this.observedSet.has(element)) return;

      const meta = getMetadata(element);
      if (meta.timerId) {
        clearTimeout(meta.timerId);
        meta.timerId = null;
      }

      if (this.observer) {
        this.observer.unobserve(element);
      }

      this.observedSet.delete(element);
    }

    /**
     * Handle IntersectionObserver batch entries.
     *
     * @param {IntersectionObserverEntry[]} entries
     */
    handleIntersect(entries) {
      const enteringElements = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const element = entry.target;
        const isElementLoop = this.resolveOption(element, 'loop');
        const meta = getMetadata(element);

        if (entry.isIntersecting) {
          // If loop is false and already triggered or currently scheduled, skip
          if (!isElementLoop && (meta.isTriggered || meta.timerId)) {
            continue;
          }
          enteringElements.push(element);
        } else {
          // Exiting viewport: reset if loop is active
          if (isElementLoop) {
            if (meta.timerId) {
              clearTimeout(meta.timerId);
              meta.timerId = null;
            }
            meta.isTriggered = false;
            window.requestAnimationFrame(() => {
              element.classList.remove(this.options.stateClass, this.options.activeClass);
            });
          }
        }
      }

      if (enteringElements.length > 0) {
        this.scheduleBatch(enteringElements);
      }
    }

    /**
     * Schedule animations for a batch of entering elements with
     * strict Left-to-Right and Top-to-Bottom cascade sequencing.
     *
     * @param {HTMLElement[]} elements
     */
    scheduleBatch(elements) {
      // Step 1: Batch read coordinates (Zero layout thrashing)
      const items = new Array(elements.length);
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const pos = getElementLayoutPos(element);
        items[i] = {
          element,
          top: pos.top,
          left: pos.left,
        };
      }

      // Step 2: Sort primarily by top position, secondarily by left
      items.sort((a, b) => a.top - b.top || a.left - b.left);

      // Step 3: Group elements into rows
      const rows = [];
      let currentRow = [];
      let currentTop = null;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (currentTop === null || Math.abs(item.top - currentTop) > this.options.rowTolerance) {
          if (currentRow.length > 0) {
            currentRow.sort((a, b) => a.left - b.left);
            rows.push(currentRow);
          }
          currentRow = [item];
          currentTop = item.top;
        } else {
          currentRow.push(item);
        }
      }

      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.left - b.left);
        rows.push(currentRow);
      }

      // Step 4: Calculate delays & schedule class additions
      let sequentialIndex = 0;
      const isReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Resolve stagger delay (khoảng chờ tuần tự giữa các phần tử / hàng)
      const staggerDelay =
        this.options.stagger !== undefined
          ? Number(this.options.stagger) || 0
          : this.options.stepDelay !== undefined
          ? Number(this.options.stepDelay) || 0
          : this.options.delay !== undefined
          ? Number(this.options.delay) || 0
          : 150;

      // Resolve start delay (thời gian chờ ban đầu trước khi kích hoạt)
      const initialDelay =
        this.options.startDelay !== undefined
          ? Number(this.options.startDelay) || 0
          : (this.options.stagger !== undefined || this.options.stepDelay !== undefined) && this.options.delay !== undefined
          ? Number(this.options.delay) || 0
          : 0;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
          const item = row[c];
          const element = item.element;
          const meta = getMetadata(element);
          const isSimultaneous = this.resolveOption(element, 'simultaneous');
          const isLoop = this.resolveOption(element, 'loop');

          // Base delay calculation
          let baseDelay = initialDelay;
          if (isSimultaneous) {
            // Simultaneous mode: all elements on the same row trigger together
            baseDelay += r * staggerDelay;
          } else {
            // Sequential mode: item-by-item left-to-right, then top-to-bottom
            baseDelay += sequentialIndex * staggerDelay;
            sequentialIndex++;
          }

          // Optional element-specific delay offset (data-inview-delay="200")
          const manualDelay = element.dataset.inviewDelay
            ? parseInt(element.dataset.inviewDelay, 10) || 0
            : 0;

          const totalDelay = isReducedMotion ? 0 : Math.max(0, baseDelay + manualDelay);

          // Apply element-specific token overrides if data attributes present
          this.applyElementTokens(element);

          // Clear any previous timer for this specific element
          if (meta.timerId) {
            clearTimeout(meta.timerId);
          }

          // Schedule activation
          meta.timerId = setTimeout(() => {
            meta.isTriggered = true;

            // Apply classes in next animation frame for peak rendering smoothness
            window.requestAnimationFrame(() => {
              element.classList.add(this.options.stateClass, this.options.activeClass);

              // Execute custom callback if specified in data-fn
              const fnName = element.dataset.fn;
              if (fnName && typeof window[fnName] === 'function') {
                try {
                  window[fnName](element);
                } catch (err) {
                  console.error(`[Inview] Error executing data-fn "${fnName}":`, err);
                }
              }

              // Dispatch standard custom event for clean decoupled listeners
              element.dispatchEvent(
                new CustomEvent('inview:enter', {
                  bubbles: true,
                  detail: { element, delay: totalDelay },
                })
              );

              // Unobserve immediately if loop is disabled
              if (!isLoop) {
                this.unobserve(element);
              }

              meta.timerId = null;
            });
          }, totalDelay);
        }
      }
    }

    /**
     * Fallback handler for legacy browsers lacking IntersectionObserver.
     */
    handleScrollFallback() {
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
      }
      this.scrollTimer = setTimeout(() => {
        this.checkScrollFallback();
      }, 30);
    }

    /**
     * Evaluate element visibility during scroll fallback.
     */
    checkScrollFallback() {
      const windowHeight = window.innerHeight;
      const entering = [];

      this.observedSet.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const inView = rect.top < windowHeight - 40 && rect.bottom > 0;
        const isElementLoop = this.resolveOption(element, 'loop');
        const meta = getMetadata(element);

        if (inView) {
          if (!isElementLoop && meta.isTriggered) {
            return;
          }
          entering.push(element);
        } else if (isElementLoop && meta.isTriggered) {
          meta.isTriggered = false;
          element.classList.remove(this.options.stateClass, this.options.activeClass);
        }
      });

      if (entering.length > 0) {
        this.scheduleBatch(entering);
      }
    }

    /**
     * Resolve option hierarchy:
     * 1. Element dataset attribute (data-inview-simultaneous, data-inview-loop)
     * 2. Instance option configured at initialization
     *
     * @param {HTMLElement} element
     * @param {'simultaneous' | 'loop'} key
     * @returns {boolean}
     */
    resolveOption(element, key) {
      const datasetKey = `inview${key.charAt(0).toUpperCase() + key.slice(1)}`;
      if (element.dataset && element.dataset[datasetKey] !== undefined) {
        return element.dataset[datasetKey] === 'true';
      }
      return Boolean(this.options[key]);
    }

    /**
     * Resolve animation duration for an element:
     * 1. Element dataset attribute: data-inview-duration="800" or "0.8s"
     * 2. Instance duration option configured at initialization
     *
     * @param {HTMLElement} element
     * @returns {number|string|null}
     */
    resolveDuration(element) {
      if (element && element.dataset && element.dataset.inviewDuration !== undefined) {
        const val = element.dataset.inviewDuration.trim();
        const num = parseFloat(val);
        return !isNaN(num) && /^\d+(\.\d+)?$/.test(val) ? num : val;
      }
      return this.options.duration !== undefined && this.options.duration !== null
        ? this.options.duration
        : null;
    }

    /**
     * Inject global motion tokens as CSS custom properties on document.documentElement.
     * Allows adjusting distance, duration, easing, and scale for all elements synchronously.
     */
    applyGlobalTokens() {
      if (typeof document === 'undefined' || !document.documentElement) return;
      const root = document.documentElement;

      // 1. Duration
      if (this.options.duration !== null && this.options.duration !== undefined) {
        const dur = typeof this.options.duration === 'number' ? `${this.options.duration}ms` : this.options.duration;
        root.style.setProperty('--inview-duration', dur);
      }

      // 2. Distance (Global fallback + per-direction specialization)
      const distance = this.options.distance;
      if (distance) {
        const allDist = formatDistance(distance.all);
        if (allDist) {
          root.style.setProperty('--inview-distance', allDist);
        }
        if (distance.up !== undefined) {
          const upDist = formatDistance(distance.up);
          if (upDist) root.style.setProperty('--inview-distance-up', upDist);
        }
        if (distance.down !== undefined) {
          const downDist = formatDistance(distance.down);
          if (downDist) root.style.setProperty('--inview-distance-down', downDist);
        }
        if (distance.left !== undefined) {
          const leftDist = formatDistance(distance.left);
          if (leftDist) root.style.setProperty('--inview-distance-left', leftDist);
        }
        if (distance.right !== undefined) {
          const rightDist = formatDistance(distance.right);
          if (rightDist) root.style.setProperty('--inview-distance-right', rightDist);
        }
      }

      // 3. Easing (Global fallback + per-modifier specialization)
      const easing = this.options.easing;
      if (easing) {
        if (easing.all) {
          root.style.setProperty('--inview-easing', easing.all);
        }
        if (easing.fadeIn) {
          root.style.setProperty('--inview-easing-fade-in', easing.fadeIn);
        }
        if (easing.fadeUp) {
          root.style.setProperty('--inview-easing-fade-up', easing.fadeUp);
        }
        if (easing.fadeDown) {
          root.style.setProperty('--inview-easing-fade-down', easing.fadeDown);
        }
        if (easing.fadeLeft) {
          root.style.setProperty('--inview-easing-fade-left', easing.fadeLeft);
        }
        if (easing.fadeRight) {
          root.style.setProperty('--inview-easing-fade-right', easing.fadeRight);
        }
        if (easing.fadeZoom) {
          root.style.setProperty('--inview-easing-zoom', easing.fadeZoom);
        }
        if (easing.fadeBounce) {
          root.style.setProperty('--inview-easing-bounce', easing.fadeBounce);
        }
      }

      // 4. Scale Zoom
      if (this.options.scaleZoom) {
        if (this.options.scaleZoom.in !== undefined && this.options.scaleZoom.in !== null) {
          root.style.setProperty('--inview-scale-in', String(this.options.scaleZoom.in));
        }
        if (this.options.scaleZoom.out !== undefined && this.options.scaleZoom.out !== null) {
          root.style.setProperty('--inview-scale-out', String(this.options.scaleZoom.out));
        }
      }

      // 5. Scale Bounce & Auto-computed Spring Physics
      if (this.options.scaleBounce) {
        const bounceIn = computeBounceInPhysics(this.options.scaleBounce.in);
        root.style.setProperty('--inview-bounce-in-scale', String(bounceIn.scale));
        root.style.setProperty('--inview-bounce-in-overshoot', String(bounceIn.overshoot));
        root.style.setProperty('--inview-bounce-in-rebound', String(bounceIn.rebound));

        const bounceOut = computeBounceOutPhysics(this.options.scaleBounce.out);
        root.style.setProperty('--inview-bounce-out-scale', String(bounceOut.scale));
        root.style.setProperty('--inview-bounce-out-overshoot', String(bounceOut.overshoot));
        root.style.setProperty('--inview-bounce-out-rebound', String(bounceOut.rebound));
      }
    }

    /**
     * Apply element-specific token overrides from data-inview-* attributes.
     * Supports:
     *   data-inview-duration="1200" or "1.2s"
     *   data-inview-distance="40" or "40px"
     *   data-inview-easing="cubic-bezier(...)"
     *   data-inview-scale="0.9"
     *   data-inview-bounce-in="0.4"
     *   data-inview-bounce-out="1.3"
     *
     * @param {HTMLElement} element
     */
    applyElementTokens(element) {
      if (!element || !element.dataset) return;

      if (element.dataset.inviewDuration !== undefined) {
        const val = element.dataset.inviewDuration.trim();
        const dur = /^\d+(\.\d+)?$/.test(val) ? `${val}ms` : val;
        element.style.setProperty('--inview-duration', dur);
        element.style.transitionDuration = dur;
        element.style.animationDuration = dur;
      }
      if (element.dataset.inviewDistance !== undefined) {
        const dist = formatDistance(element.dataset.inviewDistance);
        if (dist) element.style.setProperty('--inview-distance', dist);
      }
      if (element.dataset.inviewDistanceUp !== undefined) {
        const dist = formatDistance(element.dataset.inviewDistanceUp);
        if (dist) element.style.setProperty('--inview-distance-up', dist);
      }
      if (element.dataset.inviewDistanceDown !== undefined) {
        const dist = formatDistance(element.dataset.inviewDistanceDown);
        if (dist) element.style.setProperty('--inview-distance-down', dist);
      }
      if (element.dataset.inviewDistanceLeft !== undefined) {
        const dist = formatDistance(element.dataset.inviewDistanceLeft);
        if (dist) element.style.setProperty('--inview-distance-left', dist);
      }
      if (element.dataset.inviewDistanceRight !== undefined) {
        const dist = formatDistance(element.dataset.inviewDistanceRight);
        if (dist) element.style.setProperty('--inview-distance-right', dist);
      }
      if (element.dataset.inviewEasing !== undefined) {
        const val = element.dataset.inviewEasing.trim();
        element.style.setProperty('--inview-easing', val);
        element.style.transitionTimingFunction = val;
      }
      if (element.dataset.inviewScale !== undefined) {
        element.style.setProperty('--inview-scale-in', element.dataset.inviewScale.trim());
      }
      if (element.dataset.inviewScaleIn !== undefined) {
        element.style.setProperty('--inview-scale-in', element.dataset.inviewScaleIn.trim());
      }
      if (element.dataset.inviewScaleOut !== undefined) {
        element.style.setProperty('--inview-scale-out', element.dataset.inviewScaleOut.trim());
      }
      if (element.dataset.inviewBounceInScale !== undefined || element.dataset.inviewBounceIn !== undefined) {
        const raw = element.dataset.inviewBounceInScale || element.dataset.inviewBounceIn;
        const bounceIn = computeBounceInPhysics(raw.trim());
        element.style.setProperty('--inview-bounce-in-scale', String(bounceIn.scale));
        element.style.setProperty('--inview-bounce-in-overshoot', String(bounceIn.overshoot));
        element.style.setProperty('--inview-bounce-in-rebound', String(bounceIn.rebound));
      }
      if (element.dataset.inviewBounceOutScale !== undefined || element.dataset.inviewBounceOut !== undefined) {
        const raw = element.dataset.inviewBounceOutScale || element.dataset.inviewBounceOut;
        const bounceOut = computeBounceOutPhysics(raw.trim());
        element.style.setProperty('--inview-bounce-out-scale', String(bounceOut.scale));
        element.style.setProperty('--inview-bounce-out-overshoot', String(bounceOut.overshoot));
        element.style.setProperty('--inview-bounce-out-rebound', String(bounceOut.rebound));
      }
    }

    /**
     * Re-scan the DOM for newly added elements (e.g., after AJAX or dynamic component rendering).
     */
    refresh() {
      this.applyGlobalTokens();
      this.observeAll();
      return this;
    }

    /**
     * Destroy the Inview instance, disconnect observers, and clear all pending timers.
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.scrollFallbackActive) {
        window.removeEventListener('scroll', this.handleScrollFallback);
        window.removeEventListener('resize', this.handleScrollFallback);
      }

      if (typeof document !== 'undefined' && document.documentElement) {
        const root = document.documentElement;
        root.style.removeProperty('--inview-duration');
        root.style.removeProperty('--inview-distance');
        root.style.removeProperty('--inview-distance-up');
        root.style.removeProperty('--inview-distance-down');
        root.style.removeProperty('--inview-distance-left');
        root.style.removeProperty('--inview-distance-right');
        root.style.removeProperty('--inview-easing');
        root.style.removeProperty('--inview-easing-fade-in');
        root.style.removeProperty('--inview-easing-fade-up');
        root.style.removeProperty('--inview-easing-fade-down');
        root.style.removeProperty('--inview-easing-fade-left');
        root.style.removeProperty('--inview-easing-fade-right');
        root.style.removeProperty('--inview-easing-zoom');
        root.style.removeProperty('--inview-easing-bounce');
        root.style.removeProperty('--inview-scale-in');
        root.style.removeProperty('--inview-scale-out');
        root.style.removeProperty('--inview-bounce-in-scale');
        root.style.removeProperty('--inview-bounce-in-overshoot');
        root.style.removeProperty('--inview-bounce-in-rebound');
        root.style.removeProperty('--inview-bounce-out-scale');
        root.style.removeProperty('--inview-bounce-out-overshoot');
        root.style.removeProperty('--inview-bounce-out-rebound');
      }

      this.observedSet.forEach((element) => {
        const meta = getMetadata(element);
        if (meta.timerId) {
          clearTimeout(meta.timerId);
          meta.timerId = null;
        }
        if (element && element.style) {
          element.style.removeProperty('--inview-duration');
          element.style.removeProperty('--inview-distance');
          element.style.removeProperty('--inview-distance-up');
          element.style.removeProperty('--inview-distance-down');
          element.style.removeProperty('--inview-distance-left');
          element.style.removeProperty('--inview-distance-right');
          element.style.removeProperty('--inview-easing');
          element.style.removeProperty('--inview-scale-in');
          element.style.removeProperty('--inview-scale-out');
          element.style.removeProperty('--inview-bounce-in-scale');
          element.style.removeProperty('--inview-bounce-in-overshoot');
          element.style.removeProperty('--inview-bounce-in-rebound');
          element.style.removeProperty('--inview-bounce-out-scale');
          element.style.removeProperty('--inview-bounce-out-overshoot');
          element.style.removeProperty('--inview-bounce-out-rebound');
          element.style.removeProperty('transition-duration');
          element.style.removeProperty('animation-duration');
          element.style.removeProperty('transition-timing-function');
        }
      });

      this.observedSet.clear();
      this.isInitialized = false;
      if (globalInstance === this) {
        globalInstance = null;
      }
      return this;
    }
  }

  // Singleton instance management
  let globalInstance = null;

  Inview.init = function (options = {}) {
    if (!globalInstance) {
      globalInstance = new Inview(options);
    } else if (Object.keys(options).length > 0) {
      globalInstance.destroy();
      globalInstance = new Inview(options);
    } else {
      globalInstance.refresh();
    }
    return globalInstance;
  };

  Inview.refresh = function () {
    if (globalInstance) {
      globalInstance.refresh();
    } else {
      Inview.init();
    }
  };

  Inview.destroy = function () {
    if (globalInstance) {
      globalInstance.destroy();
      globalInstance = null;
    }
  };

  Inview.getInstance = function () {
    return globalInstance;
  };

  /**
   * Factory & constructor that supports:
   *   const movement = new inview.observer({ delay: 300, simultaneous: false, loop: false });
   * and invocation without new:
   *   const movement = inview.observer({ delay: 300 });
   */
  function InviewObserver(options) {
    if (!(this instanceof InviewObserver)) {
      return new InviewObserver(options);
    }
    return new Inview(options);
  }
  InviewObserver.prototype = Inview.prototype;

  // Bind aliases on Inview class
  Inview.observer = InviewObserver;

  // inview namespace object matching exact user syntax:
  // const movement = new inview.observer({ simultaneous: false, loop: false });
  const inviewNamespace = function (options) {
    return new Inview(options);
  };
  inviewNamespace.observer = InviewObserver;
  inviewNamespace.Inview = Inview;
  inviewNamespace.init = Inview.init;
  inviewNamespace.refresh = Inview.refresh;
  inviewNamespace.destroy = Inview.destroy;
  inviewNamespace.getInstance = Inview.getInstance;
  inviewNamespace.style = {}; // Compatibility namespace

  // Optional jQuery bridge if present
  if (typeof window !== 'undefined' && window.jQuery) {
    (function ($) {
      $.fn.inview = function (options) {
        return this.each(function () {
          if (globalInstance) {
            globalInstance.observe(this);
          } else {
            Inview.init(options);
          }
        });
      };
    })(window.jQuery);
  }

  return {
    Inview: Inview,
    inview: inviewNamespace,
  };
});

// ============================================================================
// Auto-initialization
// ============================================================================
if (typeof window !== 'undefined' && typeof inview !== 'undefined' && inview.observer) {
  const movement = new inview.observer({
    duration: 800,        // Animation duration in milliseconds (e.g. 800) or CSS string ('0.8s')

    // Travel slide distance: configure 'all' as global baseline, or specialize per direction
    distance: {
      all: 24,              // Default baseline slide distance in pixels (e.g. 24) or CSS string ('24px', '2rem')
      up: 24,               // Scoped distance for upward slide (.c-inview--fade-up)
      down: 24,             // Scoped distance for downward slide (.c-inview--fade-down)
      left: 24,             // Scoped distance for leftward slide (.c-inview--fade-left)
      right: 24,            // Scoped distance for rightward slide (.c-inview--fade-right)
    },

    // Transition timing functions: configure 'all' as global baseline, or specialize per modifier
    easing: {
      all: 'cubic-bezier(0.16, 1, 0.3, 1)',        // Default baseline easing across all modifiers
      fadeIn: 'ease-out',                           // Scoped easing for in-place fade (.c-inview--fade-in)
      fadeUp: 'cubic-bezier(0.16, 1, 0.3, 1)',      // Scoped easing for upward slide (.c-inview--fade-up)
      fadeDown: 'cubic-bezier(0.16, 1, 0.3, 1)',    // Scoped easing for downward slide (.c-inview--fade-down)
      fadeLeft: 'cubic-bezier(0.16, 1, 0.3, 1)',    // Scoped easing for leftward slide (.c-inview--fade-left)
      fadeRight: 'cubic-bezier(0.16, 1, 0.3, 1)',   // Scoped easing for rightward slide (.c-inview--fade-right)
      fadeZoom: 'cubic-bezier(0.34, 1.56, 0.64, 1)',// Scoped easing for zoom scale (.c-inview--zoom-in / --zoom-out)
      fadeBounce: 'cubic-bezier(0.215, 0.61, 0.355, 1)', // Scoped easing for bounce animations (.c-inview--bounce-*)
    },

    // Initial scale ratios for Zoom modifiers
    scaleZoom: {
      in: 0.85,           // Starting scale factor for zoom-in (.c-inview--zoom-in: 0.85 -> 1.0)
      out: 1.15,          // Starting scale factor for zoom-out (.c-inview--zoom-out: 1.15 -> 1.0)
    },

    // Starting scale ratios for Bounce modifiers (50% overshoot and 70% rebound auto-compute from in/out)
    scaleBounce: {
      in: 0.3,            // Starting scale factor for bounce-in (.c-inview--bounce-in)
      out: 1.25,          // Starting scale factor for bounce-out (.c-inview--bounce-out)
    },

    stagger: 200,         // Interval delay in milliseconds between sequential elements or rows
    delay: 0,             // Initial waiting delay in milliseconds before cascade begins
    simultaneous: false,  // false: cascades item-by-item strictly left-to-right, then top-to-bottom; true: row-by-row
    loop: false,          // false: triggers once and unobserves for peak performance; true: resets & replays on scroll
  });

  window.movement = movement;
}


