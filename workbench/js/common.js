/* ==========================================================================
   [Component: header]
   ========================================================================== */
(function ($) {
    'use strict';
    if (!$) return;

    const $window = $(window);
    const $body = $('body');
    const $header = $('.c-header');
    if (!$header.length) return;

    const $toggle = $header.find('.c-header-toggle');
    const $gnavi = $header.find('.c-header-gnavi');
    const $subItems = $gnavi.find('.c-header-gnavi__item.is-sub');
    const $subLinks = $subItems.children('.c-header-gnavi__link');

    let scrollPos = 0;

    // Header scroll active
    $window.on('scroll.header resize.header', function () {
        $header.toggleClass('is-active', $window.scrollTop() > 50);
    });
    $header.toggleClass('is-active', $window.scrollTop() > 50);

    // Mobile menu toggle
    $toggle.on('click.header', function (e) {
        e.preventDefault();
        const isOpen = $(this).hasClass('is-active');

        $(this).toggleClass('is-active', !isOpen);
        $header.toggleClass('is-open', !isOpen);

        if (!isOpen) {
            scrollPos = $window.scrollTop();
            $body.addClass('overflow_modal').css({ top: -scrollPos + 'px' });
        } else {
            $body.removeClass('overflow_modal').css({ top: '' });
            $window.scrollTop(scrollPos);
            $subItems.removeClass('is-open').children('.c-header-gnavi__sub').slideUp(200);
        }

        $gnavi.stop(true, true).slideToggle(300);
    });

    // Submenu accordion (mobile only)
    $subLinks.on('click.header', function (e) {
        if ($window.width() >= 768) return;
        e.preventDefault();

        const $parent = $(this).parent();
        const $targetSub = $parent.children('.c-header-gnavi__sub');
        const isOpen = $parent.hasClass('is-open');

        $subItems.not($parent).filter('.is-open').removeClass('is-open')
            .children('.c-header-gnavi__sub').stop(true, true).slideUp(200);

        $parent.toggleClass('is-open', !isOpen);
        $targetSub.stop(true, true).slideToggle(300);
    });

    // Close menu when clicking anchor link
    $gnavi.on('click.header', 'a[href^="#"]', function () {
        if ($window.width() < 768 && $toggle.hasClass('is-active')) {
            $toggle.trigger('click');
        }
    });

    // Reset when resizing to desktop
    $window.on('resize.header', function () {
        if ($window.width() >= 768) {
            $toggle.removeClass('is-active');
            $header.removeClass('is-open');
            $body.removeClass('overflow_modal').css({ top: '' });
            $gnavi.removeAttr('style');
            $subItems.removeClass('is-open').children('.c-header-gnavi__sub').removeAttr('style');
        }
    });
})(window.jQuery || window.$);

/* ==========================================================================
   [Component: footer]
   ========================================================================== */
(function ($, window) {
    if (!$) return;

    const $window = $(window);
    const $totop = $('.c-totop');

    if (!$totop.length) return;

    const ACTIVE_OFFSET = 50;
    const SCROLL_DURATION = 600;

    let ticking = false;

    /**
     * Update visibility.
     */
    function update() {
        $totop.toggleClass(
            'is-active',
            $window.scrollTop() > ACTIVE_OFFSET
        );
    }

    /**
     * Limit scroll handling to one update per animation frame.
     */
    function requestUpdate() {
        if (ticking) return;

        ticking = true;

        window.requestAnimationFrame(function () {
            update();
            ticking = false;
        });
    }

    $window.on('scroll.totop', requestUpdate);

    $totop.on('click.totop', function (event) {
        event.preventDefault();

        const $htmlBody = $('html, body');

        $htmlBody.stop(true);

        if (
            window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches
        ) {
            $htmlBody.scrollTop(0);
            return;
        }

        $htmlBody.animate(
            {
                scrollTop: 0,
            },
            SCROLL_DURATION
        );
    });

    update();

})(window.jQuery, window);

/* ==========================================================================
   [Component: btn]
   ========================================================================== */
(function ($, window) {
    if (!$) return;

    const $window = $(window);
    const $totop = $('.c-totop');

    if (!$totop.length) return;

    const ACTIVE_OFFSET = 50;
    const SCROLL_DURATION = 600;

    let ticking = false;

    /**
     * Update visibility.
     */
    function update() {
        $totop.toggleClass(
            'is-active',
            $window.scrollTop() > ACTIVE_OFFSET
        );
    }

    /**
     * Limit scroll handling to one update per animation frame.
     */
    function requestUpdate() {
        if (ticking) return;

        ticking = true;

        window.requestAnimationFrame(function () {
            update();
            ticking = false;
        });
    }

    $window.on('scroll.totop', requestUpdate);

    $totop.on('click.totop', function (event) {
        event.preventDefault();

        const $htmlBody = $('html, body');

        $htmlBody.stop(true);

        if (
            window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches
        ) {
            $htmlBody.scrollTop(0);
            return;
        }

        $htmlBody.animate(
            {
                scrollTop: 0,
            },
            SCROLL_DURATION
        );
    });

    update();

})(window.jQuery, window);

/* ==========================================================================
   [Component: popup]
   Accessible Modal & Popup Controller
   ========================================================================== */
(function ($) {
    'use strict';
    if (!$) return;

    let scrollPos = 0;

    function openPopup(target) {
        if (!target) return;
        const $overlay = $(target);
        if (!$overlay.length) return;

        scrollPos = $(window).scrollTop();
        $('body').addClass('overflow_modal').css({ top: -scrollPos + 'px' });

        $overlay
            .addClass('is-active')
            .attr('aria-hidden', 'false');

        setTimeout(function () {
            const $focusable = $overlay.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if ($focusable.length) {
                $focusable.first().trigger('focus');
            }
        }, 150);
    }

    function closePopup(target) {
        const $overlay = target ? $(target) : $('.c-popup-overlay.is-active');
        if (!$overlay.length) return;

        $overlay
            .removeClass('is-active')
            .attr('aria-hidden', 'true');

        $('body').removeClass('overflow_modal').css({ top: '' });
        $(window).scrollTop(scrollPos);
    }

    $(document).on('click', '.js-popup-open, [data-popup-target]', function (e) {
        e.preventDefault();
        const target = $(this).attr('data-popup-target') || $(this).attr('href');
        openPopup(target);
    });

    $(document).on('click', '.js-popup-close, .c-popup-overlay__backdrop, .c-popup__close, .c-popup__footer .c-btn--cancel', function (e) {
        e.preventDefault();
        const $overlay = $(this).closest('.c-popup-overlay');
        closePopup($overlay);
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            const $active = $('.c-popup-overlay.is-active');
            if ($active.length) {
                closePopup($active);
            }
        }
    });

    window.appPopup = { open: openPopup, close: closePopup };
})(window.jQuery || window.$);

