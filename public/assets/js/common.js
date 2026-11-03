'use strict';

/* ==========================================================================
   Common: Smooth Scroll
   ========================================================================== */

(function ($, window, document) {
    if (!$) return;

    const $htmlBody = $('html, body');
    const SCROLL_DURATION = 600;

    function getTarget(hash) {
        if (!hash || hash === '#' || hash === '#!') {
            return null;
        }

        let id = hash.substring(1);

        try {
            id = decodeURIComponent(id);
        } catch (error) {
            // Keep original ID if decode fails.
        }

        return document.getElementById(id);
    }

    function scrollToTarget(target, offset) {
        const $target = $(target);

        if (!$target.length) return;

        const targetTop = Math.max(
            0,
            $target.offset().top - offset
        );

        $htmlBody.stop(true);

        if (
            window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches
        ) {
            $htmlBody.scrollTop(targetTop);
            return;
        }

        $htmlBody.animate(
            {
                scrollTop: targetTop,
            },
            SCROLL_DURATION
        );
    }

    $(document).on(
        'click.smoothScroll',
        '.js-anchor[href^="#"]',
        function (event) {
            const $link = $(this);
            const hash = $link.attr('href');
            const target = getTarget(hash);

            if (!target) return;

            event.preventDefault();

            const offset =
                Number($link.attr('data-scroll-offset')) || 0;

            scrollToTarget(target, offset);

            if (
                window.history &&
                typeof window.history.pushState === 'function' &&
                window.location.hash !== hash
            ) {
                window.history.pushState(null, '', hash);
            }
        }
    );

})(window.jQuery, window, document);

/* ==========================================================================
   Component: Scrollable
   ========================================================================== */

(function ($) {
    if (!$) return;
    function initScrollable() {
        if (typeof window.ScrollHint === 'undefined') return;
        if (!$('.js-scrollable, .has-fixed-layout').length) return;
        new window.ScrollHint('.js-scrollable, .has-fixed-layout', {
            scrollHintIconAppendClass: 'scroll-hint-icon-white',
            applyToParents: true,
            i18n: {
                scrollable: 'スクロールできます',
            },
        });
    }
    if (document.readyState === 'complete') {
        initScrollable();
    } else {
        $(window).on('load.scrollable', initScrollable);
    }
})(window.jQuery);
/* ==========================================================================
   Component: To Top
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


'use strict';
// Workbench Shared JS Starter

/* ==========================================================================
   [Component: header]
   Component: Header
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

