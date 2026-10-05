/**
 * Workbench Inview Controller
 * - Fully isolated anchor link smooth scrolling (shielded from external scripts)
 * - Header navigation tracking
 * - Code snippet clipboard copy
 * - Click-to-copy on card code pills
 */
(function () {
  'use strict';

  const navLinks = document.querySelectorAll('.wb-topbar__link');
  const sections = document.querySelectorAll('.wb-section');
  const langButtons = document.querySelectorAll('[data-lang-btn]');

  /**
   * 0. Bilingual System (Vietnamese default & Japanese)
   */
  function setLanguage(lang) {
    const safeLang = lang === 'ja' ? 'ja' : 'vi';
    document.documentElement.setAttribute('data-lang', safeLang);
    document.documentElement.setAttribute('lang', safeLang);
    try {
      localStorage.setItem('wb_lang', safeLang);
    } catch (_) {}

    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      if (btn.getAttribute('data-lang-btn') === safeLang) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });
  }

  // Load saved preference or default to 'vi'
  let currentLang = 'vi';
  try {
    currentLang = localStorage.getItem('wb_lang') || 'vi';
  } catch (_) {}
  setLanguage(currentLang);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang-btn]');
    if (btn) {
      const lang = btn.getAttribute('data-lang-btn');
      if (lang) setLanguage(lang);
    }
  });

  window.setWorkbenchLanguage = setLanguage;

  /**
   * 1. Fully isolated smooth scroll for anchor links
   * Completely prevents interference from jQuery or external global scroll handlers
   */
  const anchorLinks = document.querySelectorAll('a[href^="#"]');
  anchorLinks.forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const hash = this.getAttribute('href');
      if (!hash || hash === '#' || !hash.startsWith('#')) return;

      const target = document.querySelector(hash);
      if (target) {
        e.preventDefault();
        e.stopPropagation(); // Stop event propagation to external global handlers

        const header = document.querySelector('.wb-topbar');
        const headerHeight = header ? header.offsetHeight : 64;
        const targetTop = target.getBoundingClientRect().top + window.pageYOffset - (headerHeight + 20);

        window.scrollTo({
          top: targetTop,
          behavior: 'smooth',
        });

        // Update URL hash without causing page jump
        if (history.pushState) {
          history.pushState(null, '', hash);
        }
      }
    });
  });

  // Auto-adjust scroll position on initial load if URL contains a #hash
  if (window.location.hash) {
    const adjustHashScroll = () => {
      try {
        const target = document.querySelector(window.location.hash);
        if (target) {
          const header = document.querySelector('.wb-topbar');
          const headerHeight = header ? header.offsetHeight : 64;
          const targetTop = target.getBoundingClientRect().top + window.pageYOffset - (headerHeight + 20);
          window.scrollTo({
            top: targetTop,
            behavior: 'smooth',
          });
        }
      } catch (_) {}
    };

    if (document.readyState === 'complete') {
      setTimeout(adjustHashScroll, 50);
    } else {
      window.addEventListener('load', () => setTimeout(adjustHashScroll, 80));
    }
  }

  /**
   * 2. Click on card code pill to copy HTML
   */
  const cardCodes = document.querySelectorAll('.wb-card__code');
  cardCodes.forEach((codeEl) => {
    codeEl.setAttribute('title', 'Nhấn để sao chép mã / クリックしてコードをコピー');
    codeEl.addEventListener('click', () => {
      const text = codeEl.textContent.replace(/^\$\s*/, '').trim();
      navigator.clipboard.writeText(text).then(() => {
        const orig = codeEl.innerHTML;
        const isJa = document.documentElement.getAttribute('data-lang') === 'ja';
        codeEl.innerHTML = `<span style="color:#4caf50;">✓ ${isJa ? 'コピー完了' : 'Đã sao chép!'}</span>`;
        setTimeout(() => {
          codeEl.innerHTML = orig;
        }, 1200);
      });
    });
  });

  /**
   * 3. Active Header Nav State on Scroll
   */
  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('wb-topbar__link--active');
              } else {
                link.classList.remove('wb-topbar__link--active');
              }
            });
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /**
   * 4. Global snippet copy helper for codeblocks
   */
  window.copySnippet = function (btn, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    const text = el.innerText || el.textContent;

    const isJa = document.documentElement.getAttribute('data-lang') === 'ja';
    const copiedText = isJa ? '✓ コピー完了' : '✓ Đã sao chép';
    const copyText = isJa ? 'コードをコピー' : 'Sao Chép Mã';

    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = `<span style="color:#4caf50;">${copiedText}</span>`;
      setTimeout(() => {
        btn.innerHTML = orig;
      }, 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      btn.innerHTML = `<span style="color:#4caf50;">${copiedText}</span>`;
      setTimeout(() => {
        btn.innerHTML = copyText;
      }, 2000);
    });
  };
})();
