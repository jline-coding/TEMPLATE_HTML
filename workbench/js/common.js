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

    // Elements inside header (supports both new .c-header-* and fallback classes)
    const $toggle = $header.find('.c-header-toggle, .c-toggle');
    const $gnavi = $header.find('.c-header-gnavi, .c-gnavi');
    const $subParent = $gnavi.find('.c-header-gnavi__item.is-sub, .c-gnavi-list__item.is-sub');
    const $subLink = $subParent.children('.c-header-gnavi__link, .c-gnavi-link');

    let scrollPos = 0;

    // --- 1. Header scroll active state (RAF 60fps) ---
    function updateScrollState() {
        $header.toggleClass('active', $window.scrollTop() > 50);
    }

    let ticking = false;
    $window.on('scroll.header resize.header', function () {
        if (!ticking) {
            requestAnimationFrame(function () {
                updateScrollState();
                ticking = false;
            });
            ticking = true;
        }
    });
    $window.on('load.header', updateScrollState);
    $(updateScrollState);

    // --- 2. Body scroll lock (Preserves scroll position) ---
    function lockBody() {
        scrollPos = $window.scrollTop();
        $body.addClass('overflow_modal').css({ top: -scrollPos + 'px' });
    }

    function unlockBody() {
        $body.removeClass('overflow_modal').css({ top: '' });
        $window.scrollTop(scrollPos);
    }

    // --- 3. Close submenu helper ---
    function closeSub($items) {
        $items.removeClass('is-open').children('.c-header-gnavi__sub, .c-gnavi-sub').each(function () {
            const $sub = $(this);
            $sub.css({ overflow: 'hidden' }).stop().animate({ height: 0 }, 300, function () {
                $sub.attr('hidden', 'until-found').css({ height: '', overflow: '' });
            });
        });
    }

    // --- 4. Close mobile menu completely ---
    function closeMenu() {
        $toggle.removeClass('active');
        $gnavi.removeClass('active is-open');
        $header.removeClass('is-open');
        if (window.matchMedia('(max-width: 767px)').matches) {
            $gnavi.attr('hidden', 'until-found');
        }
        if ($body.hasClass('overflow_modal')) {
            unlockBody();
        }
        closeSub($subParent);
    }

    // --- 5. Toggle mobile menu on button click ---
    $toggle.on('click.header', function () {
        const isActive = $(this).hasClass('active');

        if (isActive) {
            closeMenu();
        } else {
            $gnavi.removeAttr('hidden');
            $(this).addClass('active');
            $gnavi.addClass('active is-open');
            $header.addClass('is-open');
            lockBody();
        }
    });

    // --- 6. Submenu accordion on SP (< 768px) ---
    $subLink.on('click.header', function (e) {
        if (window.matchMedia('(min-width: 768px)').matches) return;
        e.preventDefault();

        const $parent = $(this).parent();
        const $targetSub = $parent.children('.c-header-gnavi__sub, .c-gnavi-sub');
        const isOpen = $parent.hasClass('is-open');

        $parent.toggleClass('is-open', !isOpen);
        if (!isOpen) {
            $targetSub.removeAttr('hidden');
            const targetHeight = $targetSub.css({ height: 'auto' }).outerHeight();
            $targetSub.css({ height: 0, overflow: 'hidden' })
                .stop()
                .animate({ height: targetHeight }, 300, function () {
                    $(this).css({ height: '', overflow: '' });
                });
        } else {
            $targetSub.css({ overflow: 'hidden' })
                .stop()
                .animate({ height: 0 }, 300, function () {
                    $(this).attr('hidden', 'until-found').css({ height: '', overflow: '' });
                });
        }

        // Close sibling submenus
        closeSub($subParent.not($parent).filter('.is-open'));
    });

    // --- 7. Auto close menu when clicking SP anchor links ---
    $gnavi.on('click.header', 'a[href^="#"]', function () {
        if (window.matchMedia('(max-width: 767px)').matches) {
            closeMenu();
        }
    });

    // --- 8. Ctrl+F / Native Find-in-page: auto reveal menu and submenu ---
    function handleBeforeMatch(e) {
        const target = e.target;
        const $target = $(target);

        // Check if the matched element is inside header navigation
        const $gnaviMatch = $target.closest('.c-header-gnavi, .c-gnavi');
        if ($gnaviMatch.length) {
            // 1. If mobile menu is closed, automatically open it!
            if (!$toggle.hasClass('active')) {
                $toggle.addClass('active');
                $gnavi.removeAttr('hidden').addClass('active is-open');
                $header.addClass('is-open');
                lockBody();
            }

            // 2. If matched text is inside a submenu, automatically open that submenu!
            const $sub = $target.closest('.c-header-gnavi__sub, .c-gnavi-sub');
            if ($sub.length) {
                const $parent = $sub.closest('.c-header-gnavi__item, .c-gnavi-list__item');
                $parent.addClass('is-open');
                $sub.removeAttr('hidden').css({ height: '', overflow: '' });
            }
        }
    }

    document.addEventListener('beforematch', handleBeforeMatch, true);

    // --- 9. Initial sync & reset states when resizing to desktop (>= 768px) ---
    function syncGnaviState() {
        if (window.matchMedia('(min-width: 768px)').matches) {
            $gnavi.removeAttr('hidden');
        } else {
            if (!$toggle.hasClass('active')) {
                $gnavi.attr('hidden', 'until-found');
            }
        }
    }
    syncGnaviState();

    let resizeTimer;
    $window.on('resize.header', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (window.matchMedia('(min-width: 768px)').matches) {
                closeMenu();
                $gnavi.removeAttr('hidden');
                $subParent.children('.c-header-gnavi__sub, .c-gnavi-sub').removeAttr('style');
            } else {
                syncGnaviState();
            }
        }, 150);
    });

})(window.jQuery || window.$);
