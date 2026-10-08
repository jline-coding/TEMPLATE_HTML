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

(function ($, window) {
    if (!$) return;

    const $targets = $('.js-scrollable, .has-fixed-layout');

    if (!$targets.length) return;

    let resizeTimer;

    function updateState(element) {
        const $element = $(element);

        const isScrollable =
            element.scrollWidth > element.clientWidth + 1;

        $element.toggleClass(
            'is-scrollable',
            isScrollable
        );

        if (!isScrollable) {
            $element.removeClass('is-scrolled');
        }
    }

    $targets.each(function () {
        const element = this;
        const $element = $(element);

        updateState(element);

        $element.on(
            'scroll.scrollable',
            function () {
                if (element.scrollLeft > 0) {
                    $element.addClass('is-scrolled');
                } else {
                    $element.removeClass('is-scrolled');
                }
            }
        );
    });

    $(window).on(
        'resize.scrollable',
        function () {
            window.clearTimeout(resizeTimer);

            resizeTimer = window.setTimeout(
                function () {
                    $targets.each(function () {
                        updateState(this);
                    });
                },
                150
            );
        }
    );

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
