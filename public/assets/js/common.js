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

/* ==========================================================================
   [Component: c-file]
   ========================================================================== */

(function ($) {
    'use strict';
    if (!$) return;

    $(document).on('change.cFile', '.js-file input[type="file"]', function () {
        const file = this.files && this.files[0];
        const $wrapper = $(this).closest('.js-file');
        const $content = $wrapper.find('.js-file__content');
        const $clearBtn = $wrapper.find('.js-file-clear');

        if (!$content.data('default-text')) {
            $content.data('default-text', $content.text().trim() || '添付する');
        }

        if (file) {
            $content.text(file.name).addClass('is-active');
            $clearBtn.addClass('is-active').show();
        } else {
            $content.text($content.data('default-text')).removeClass('is-active');
            $clearBtn.removeClass('is-active').hide();
        }
    });

    $(document).on('click.cFile', '.js-file-clear', function (e) {
        e.preventDefault();
        const $wrapper = $(this).closest('.js-file');
        const $input = $wrapper.find('input[type="file"]');
        const $content = $wrapper.find('.js-file__content');

        $input.val('');
        const defaultText = $content.data('default-text') || '添付する';
        $content.text(defaultText).removeClass('is-active');
        $(this).removeClass('is-active').hide();
    });

})(window.jQuery || window.$);