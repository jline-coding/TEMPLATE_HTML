// jQuery 4 compatibility polyfill for Slick.js
// $.type() was removed in jQuery 4, Slick still depends on it
if (typeof $.type === 'undefined') {
  $.type = function (obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    return Object.prototype.toString.call(obj)
      .replace(/^\[object\s|\]$/g, '')
      .toLowerCase();
  };
}

/* ==========================================================================
   Global Site Helpers & Utilities
   ========================================================================== */
(function ($) {
    'use strict';

    const $window = $(window);
    const $body = $('body');
    const $htmlBody = $('html, body');

    let scrollPos = 0;

    // Helper: Debounce
    $.debounce = function (func, wait = 100) {
        let timeout;
        return function () {
            clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    };
    window.debounce = $.debounce; // Backward compatibility

    // Helper: Body lock/unlock (Modal)
    $.addFixedBodyModal = function () {
        scrollPos = $window.scrollTop();
        $body
            .addClass('overflow_modal')
            .css({ top: -scrollPos + 'px' });
    };
    $.removeFixedBodyModal = function () {
        $body.removeClass('overflow_modal').css({ top: '' });
        $window.scrollTop(scrollPos);
    };
    window.addFixedBodyModal = $.addFixedBodyModal;
    window.removeFixedBodyModal = $.removeFixedBodyModal;

    // Inview Observer initialization
    if (typeof inview !== 'undefined' && inview.observer) {
        const movement = new inview.observer({
            aniDelay: 300,
            optionView: { bottom: -50 },
        });
        movement.init();
    }

    // Global document ready interactions
    $(function () {
        const $header = $('.c-header');

        // Smooth anchor scroll
        $(document).on('click', 'a[href^="#"]', function (e) {
            const $this = $(this);
            const hash = $this.attr('href');
            if (hash === '#') return;
            const $target = $(hash);
            if ($target.length) {
                e.preventDefault();
                const offset = $target.offset().top - (($header.length ? $header.outerHeight() : 0) + 30);
                $htmlBody.stop().animate({ scrollTop: offset }, 600);
            }
        });

        // Auto scroll to anchor if URL has hash (Safe against selector injection/syntax errors)
        if (location.hash) {
            try {
                const targetId = decodeURIComponent(location.hash.substring(1));
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    const $target = $(targetEl);
                    const offset = $target.offset().top - (($header.length ? $header.outerHeight() : 0) + 30);
                    $htmlBody.stop().animate({ scrollTop: offset }, 600);
                }
            } catch (e) {
                // Silently ignore malformed URI/hash
            }
        }

        // Inview / scroll animation & Keyboard focus / Tab accessibility support
        $(document).on('focusin', function (e) {
            const $target = $(e.target);

            // Auto-reveal fade/scroll animations if element receives focus (e.g. via Tab navigation)
            const $fadeEl = $target.closest('.js-fadeani, .js-inview');
            if ($fadeEl.length) {
                $fadeEl.addClass('active is-inview').css({ opacity: 1, transform: 'none' });
            }

            // Keyboard Tab accessibility for collapsible blocks:
            // Visual reveal is handled natively by pure CSS (:focus-within) with ZERO JS DOM mutation.
            const $searchable = $target.closest('.js-searchable');
            if ($searchable.length) {
                $searchable.trigger('searchable:found', { target: $target });
            }
        });

        // Native HTML5 Find-in-page support (beforematch event fired by browser Ctrl+F on searchable blocks)
        $(document).on('beforematch', function (e) {
            const $target = $(e.target);
            const $fadeEl = $target.closest('.js-fadeani, .js-inview');
            if ($fadeEl.length) {
                $fadeEl.addClass('active is-inview').css({ opacity: 1, transform: 'none' });
            }

            // Auto-open mobile drawer if match is inside it
            const $gnavi = $target.closest('.c-gnavi');
            if ($gnavi.length && !$gnavi.hasClass('is-open')) {
                $('.c-toggle').addClass('active');
                $gnavi.addClass('is-open');
                if (typeof $.addFixedBodyModal === 'function') {
                    $.addFixedBodyModal();
                }
            }

            // If match is inside a submenu, mark its parent item as is-open
            const $sub = $target.closest('.c-gnavi-sub');
            if ($sub.length) {
                $sub.parent('.c-gnavi-list__item.is-sub').addClass('is-open');
                $sub.addClass('is-open').removeAttr('hidden').show();
            }

            const $searchable = $target.closest('.js-searchable, [hidden="until-found"]');
            if ($searchable.length) {
                $searchable.addClass('is-open').removeAttr('hidden');
                $searchable.trigger('searchable:found', { target: $target });
            }
        });
    });

    // On Window Load
    $window.on('load', function () {
        // Init ScrollHint
        if ($('.js-scrollable, .has-fixed-layout').length && typeof ScrollHint !== 'undefined') {
            new ScrollHint('.js-scrollable, .has-fixed-layout', {
                scrollHintIconAppendClass: 'scroll-hint-icon-white',
                applyToParents: true,
                i18n: {
                    scrollable: 'スクロールできます',
                },
            });
        }

        // Fade animation on scroll - add .active to .js-fadeani elements
        const $fadeEls = $('.js-fadeani');
        if ($fadeEls.length) {
            function checkFadeElements() {
                const windowBottom = $window.scrollTop() + $window.height();
                $fadeEls.each(function () {
                    const $el = $(this);
                    if (!$el.hasClass('active')) {
                        const elTop = $el.offset().top;
                        if (windowBottom > elTop + 50) {
                            $el.addClass('active');
                        }
                    }
                });
            }
            checkFadeElements();
            $window.on('scroll.fade resize.fade', typeof $.debounce === 'function' ? $.debounce(checkFadeElements, 50) : checkFadeElements);
        }
    });

})(jQuery);

/* ==========================================================================
   [Component: header]
   ========================================================================== */
(function ($) {
    'use strict';

    $(function () {
        const $window = $(window);
        const $header = $('.c-header');
        if (!$header.length) return;

        function updateHeaderState() {
            if ($window.scrollTop() > 50) {
                $header.addClass('active');
            } else {
                $header.removeClass('active');
            }
        }

        updateHeaderState();
        $window.on('scroll.header resize.header', typeof $.debounce === 'function' ? $.debounce(updateHeaderState, 50) : updateHeaderState);
    });
})(jQuery);

/* ==========================================================================
   [Component: totop]
   ========================================================================== */
(function ($) {
    'use strict';

    $(function () {
        const $window = $(window);
        const $totop = $('.c-totop');
        if (!$totop.length) return;

        function updateToTopState() {
            if ($window.scrollTop() > 50) {
                $totop.css('transform', 'translateY(0)');
            } else {
                $totop.removeAttr('style');
            }
        }

        updateToTopState();
        $window.on('scroll.totop resize.totop', typeof $.debounce === 'function' ? $.debounce(updateToTopState, 50) : updateToTopState);

        $(document).on('click.totop', '.c-totop', function (e) {
            e.preventDefault();
            $('html, body').stop().animate({ scrollTop: 0 }, 600);
        });
    });
})(jQuery);

/* ==========================================================================
   [Component: toggle]
   ========================================================================== */
(function ($) {
    'use strict';

    $(function () {
        const $window = $(window);
        let fallbackScrollPos = 0;

        function lockBody() {
            if (typeof $.addFixedBodyModal === 'function') {
                $.addFixedBodyModal();
            } else {
                fallbackScrollPos = $window.scrollTop();
                $('body').addClass('overflow_modal').css({ top: -fallbackScrollPos + 'px' });
            }
        }

        function unlockBody() {
            if (typeof $.removeFixedBodyModal === 'function') {
                $.removeFixedBodyModal();
            } else {
                $('body').removeClass('overflow_modal').css({ top: '' });
                $window.scrollTop(fallbackScrollPos);
            }
        }

        // Delegated click event for menu toggle
        $(document).on('click.toggle', '.c-toggle', function (e) {
            e.preventDefault();
            const $this = $(this);
            const $gnavi = $('.c-gnavi');
            const isActive = $this.hasClass('active');

            $this.toggleClass('active');
            $gnavi.toggleClass('is-open');

            if (isActive) {
                unlockBody();
                $('.c-gnavi-list__item.is-sub').removeClass('is-open');
                $('.c-gnavi-sub').removeClass('is-open').removeAttr('style').attr('hidden', 'until-found');
            } else {
                lockBody();
            }
        });

        // Reset mobile menu when resizing back to desktop screen
        $window.on('resize.toggle', typeof $.debounce === 'function' ? $.debounce(function () {
            if ($window.width() >= 768) {
                $('.c-toggle').removeClass('active');
                $('.c-gnavi').removeClass('is-open').removeAttr('style');
                unlockBody();
            }
        }, 100) : function () {
            if ($window.width() >= 768) {
                $('.c-toggle').removeClass('active');
                $('.c-gnavi').removeClass('is-open').removeAttr('style');
                unlockBody();
            }
        });
    });
})(jQuery);

/* ==========================================================================
   [Component: gnavi]
   ========================================================================== */
(function ($) {
    'use strict';

    $(function () {
        const $window = $(window);

        // Submenu accordion toggle for mobile screen
        $(document).on('click.gnavi', '.c-gnavi-list__item.is-sub > .c-gnavi-link', function (e) {
            if ($window.width() < 768) {
                e.preventDefault();
                const $link = $(this);
                const $parent = $link.parent();
                const $targetSub = $parent.children('.c-gnavi-sub');
                const isOpen = $parent.hasClass('is-open');

                $parent.toggleClass('is-open', !isOpen);
                if (isOpen) {
                    $targetSub.removeClass('is-open').stop().slideUp(300, function () {
                        $(this).attr('hidden', 'until-found');
                    });
                } else {
                    $targetSub.removeAttr('hidden').addClass('is-open').stop().slideDown(300);
                }

                // Close other open submenus
                $('.c-gnavi-list__item.is-sub').not($parent).filter('.is-open')
                    .removeClass('is-open')
                    .children('.c-gnavi-sub')
                    .removeClass('is-open')
                    .stop()
                    .slideUp(300, function () {
                        $(this).attr('hidden', 'until-found');
                    });
            }
        });

        // Reset submenu styles when resizing back to desktop screen
        $window.on('resize.gnavi', typeof $.debounce === 'function' ? $.debounce(function () {
            if ($window.width() >= 768) {
                $('.c-gnavi-list__item.is-sub').removeClass('is-open');
                $('.c-gnavi-sub').removeAttr('hidden').removeClass('is-open').removeAttr('style');
            } else {
                $('.c-gnavi-list__item.is-sub:not(.is-open) .c-gnavi-sub').attr('hidden', 'until-found');
            }
        }, 100) : function () {
            if ($window.width() >= 768) {
                $('.c-gnavi-list__item.is-sub').removeClass('is-open');
                $('.c-gnavi-sub').removeAttr('hidden').removeClass('is-open').removeAttr('style');
            } else {
                $('.c-gnavi-list__item.is-sub:not(.is-open) .c-gnavi-sub').attr('hidden', 'until-found');
            }
        });
    });
})(jQuery);