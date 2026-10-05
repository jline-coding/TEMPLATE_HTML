/* ==========================================================================
   [Component: popup]
   Accessible Modal & Popup Controller
   ========================================================================== */
(function ($) {
    'use strict';

    let scrollPos = 0;

    /**
     * Opens modal dialog
     * @param {string|HTMLElement} target - Selector or DOM element of .c-popup-overlay
     */
    function openPopup(target) {
        if (!target) return;
        const $overlay = $(target);
        if (!$overlay.length) return;

        scrollPos = $(window).scrollTop();
        $('body').addClass('overflow_modal').css({ top: -scrollPos + 'px' });

        $overlay
            .addClass('is-active')
            .attr('aria-hidden', 'false');

        // Focus management: focus first focusable element inside popup
        setTimeout(function () {
            const $focusable = $overlay.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if ($focusable.length) {
                $focusable.first().trigger('focus');
            }
        }, 150);
    }

    /**
     * Closes modal dialog
     * @param {string|HTMLElement} [target] - Specific overlay or all active
     */
    function closePopup(target) {
        const $overlay = target ? $(target) : $('.c-popup-overlay.is-active');
        if (!$overlay.length) return;

        $overlay
            .removeClass('is-active')
            .attr('aria-hidden', 'true');

        $('body').removeClass('overflow_modal').css({ top: '' });
        $(window).scrollTop(scrollPos);
    }

    // Open Trigger Click
    $(document).on('click', '.js-popup-open, [data-popup-target]', function (e) {
        e.preventDefault();
        const target = $(this).attr('data-popup-target') || $(this).attr('href');
        openPopup(target);
    });

    // Close Trigger Click (backdrop, close button, cancel button)
    $(document).on('click', '.js-popup-close, .c-popup-overlay__backdrop, .c-popup__close, .c-popup__footer .c-btn--cancel', function (e) {
        e.preventDefault();
        const $overlay = $(this).closest('.c-popup-overlay');
        closePopup($overlay);
    });

    // Close on Escape key
    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            const $active = $('.c-popup-overlay.is-active');
            if ($active.length) {
                closePopup($active);
            }
        }
    });

    // Expose global API
    window.appPopup = {
        open: openPopup,
        close: closePopup
    };

})(window.jQuery || window.$);
