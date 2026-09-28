/**
 * Accordion Component Interactive Controller
 * Features:
 * - Hidden="until-found" support for Ctrl+F browser search
 * - Smooth slide toggle
 * - Handles both custom .c-accordion / .js-accordion and HTML5 <details>
 */
(function ($) {
  $(function () {
    // 1. Custom accordions with hidden="until-found" and beforematch
    const customAccordions = document.querySelectorAll('.c-accordion:not(details), .js-accordion:not(details)');
    customAccordions.forEach(function (accordion, idx) {
      const head = accordion.querySelector('.c-accordion__head, .js-accordion__head');
      const body = accordion.querySelector('.c-accordion__body, .js-accordion__body');
      if (!head || !body) return;

      const isOpen = accordion.classList.contains('is-open');
      const uid = body.id || ('accordion-panel-' + idx);
      body.id = uid;
      head.setAttribute('aria-controls', uid);
      head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

      if (!isOpen) {
        body.setAttribute('hidden', 'until-found');
      }

      // Auto-expand when matched by in-page search (Ctrl+F)
      body.addEventListener('beforematch', function () {
        accordion.classList.add('is-open');
        head.setAttribute('aria-expanded', 'true');
        $(body).css('display', '');
      });

      // Smooth toggle click
      head.addEventListener('click', function (e) {
        e.preventDefault();
        const willOpen = !accordion.classList.contains('is-open');
        accordion.classList.toggle('is-open', willOpen);
        head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');

        if (willOpen) {
          body.removeAttribute('hidden');
          $(body).hide().slideDown(250);
        } else {
          $(body).slideUp(250, function () {
            body.setAttribute('hidden', 'until-found');
            $(body).css('display', '');
          });
        }
      });
    });

    // 2. Progressive enhancement for standard <details class="c-accordion"> elements
    const detailAccordions = document.querySelectorAll('details.c-accordion, details.js-accordion');
    detailAccordions.forEach(function (details) {
      const summary = details.querySelector('.c-accordion__head, summary');
      const body = details.querySelector('.c-accordion__body');
      if (!summary || !body) return;

      let isAnimating = false;
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        if (isAnimating) return;
        isAnimating = true;

        if (details.open) {
          $(body).slideUp(250, function () {
            details.open = false;
            $(body).css('display', '');
            isAnimating = false;
          });
        } else {
          details.open = true;
          $(body).hide().slideDown(250, function () {
            isAnimating = false;
          });
        }
      });
    });
  });
})(typeof jQuery !== 'undefined' ? jQuery : window.$);
