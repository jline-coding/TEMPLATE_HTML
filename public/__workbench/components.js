/* Workbench Interactive Component Scripts */

/* --- common.js --- */
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

