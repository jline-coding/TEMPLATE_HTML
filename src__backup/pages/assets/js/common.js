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
   [Component: footer]
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

/* ==========================================================================
   [Component: slider]
   Slick Carousel Controller (assets/vendor/slick)
   ========================================================================== */
(function ($) {
    'use strict';
    if (!$) return;

    // jQuery 4 compatibility for Slick
    if (typeof $.type !== 'function') {
        $.type = function (obj) {
            if (obj == null) return obj + '';
            var t = Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
            return typeof obj === 'object' || typeof obj === 'function' ? t : typeof obj;
        };
    }

    function initSlickSliders() {
        if (typeof $.fn.slick !== 'function') return;

        // 1. Responsive Multi-Card Carousel Slider
        $('.js-slider:not(.slick-initialized)').each(function () {
            const $slider = $(this);
            $slider.slick({
                dots: true,
                arrows: true,
                infinite: true,
                speed: 600,
                slidesToShow: 3,
                slidesToScroll: 1,
                autoplay: true,
                autoplaySpeed: 4500,
                pauseOnHover: true,
                prevArrow: '<button type="button" class="slick-prev c-slider__arrow c-slider__arrow--prev" aria-label="前へ">❮</button>',
                nextArrow: '<button type="button" class="slick-next c-slider__arrow c-slider__arrow--next" aria-label="次へ">❯</button>',
                responsive: [
                    {
                        breakpoint: 1024,
                        settings: {
                            slidesToShow: 2,
                            slidesToScroll: 1
                        }
                    },
                    {
                        breakpoint: 640,
                        settings: {
                            slidesToShow: 1,
                            slidesToScroll: 1,
                            arrows: false
                        }
                    }
                ]
            });
        });

        // 2. Single Slide Fade Banner Slider
        $('.js-slider-fade:not(.slick-initialized)').each(function () {
            const $slider = $(this);
            $slider.slick({
                dots: true,
                arrows: true,
                fade: true,
                infinite: true,
                speed: 800,
                slidesToShow: 1,
                slidesToScroll: 1,
                autoplay: true,
                autoplaySpeed: 5000,
                prevArrow: '<button type="button" class="slick-prev c-slider__arrow c-slider__arrow--prev" aria-label="前へ">❮</button>',
                nextArrow: '<button type="button" class="slick-next c-slider__arrow c-slider__arrow--next" aria-label="次へ">❯</button>'
            });
        });

        // 3. Center Mode Highlight Carousel
        $('.js-slider-center:not(.slick-initialized)').each(function () {
            const $slider = $(this);
            $slider.slick({
                dots: true,
                arrows: true,
                centerMode: true,
                centerPadding: '50px',
                slidesToShow: 3,
                autoplay: true,
                autoplaySpeed: 4000,
                prevArrow: '<button type="button" class="slick-prev c-slider__arrow c-slider__arrow--prev" aria-label="前へ">❮</button>',
                nextArrow: '<button type="button" class="slick-next c-slider__arrow c-slider__arrow--next" aria-label="次へ">❯</button>',
                responsive: [
                    {
                        breakpoint: 768,
                        settings: {
                            centerMode: true,
                            centerPadding: '20px',
                            slidesToShow: 1
                        }
                    }
                ]
            });
        });
    }

    $(function () {
        initSlickSliders();
    });

    $(window).on('load', function () {
        initSlickSliders();
    });

    window.initSlickSliders = initSlickSliders;
})(window.jQuery || window.$);

