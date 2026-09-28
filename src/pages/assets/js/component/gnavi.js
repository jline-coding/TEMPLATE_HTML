/**
 * Header & Global Navigation Controller
 * Features:
 * - Hamburger menu toggle with background body scroll lock
 * - Mobile submenu accordion dropdown
 * - Auto-closes on desktop resize
 */
(function ($) {
  $(function () {
    const $window = $(window);
    const $header = $('.c-header');
    const $totop = $('.c-totop');
    const $toggle = $('.c-toggle');
    const $gnavi = $('.c-gnavi');
    const $gnaviSubParent = $('.c-gnavi-list__item.is-sub');
    const $gnaviSubLink = $gnaviSubParent.children('.c-gnavi-link');
    const $gnaviSub = $gnaviSubParent.children('.c-gnavi-sub');

    // Menu toggle
    $toggle.on("click", function () {
      const $this = $(this);
      const isActive = $this.hasClass("active");
      $this.toggleClass("active");
      $gnavi.stop().slideToggle("fast");
      if (isActive) {
        $('body').removeClass('overflow_modal').css({ top: '' });
        $gnaviSubParent.removeClass("is-open");
        $gnaviSub.hide();
      } else {
        const scroll_pos = $window.scrollTop();
        $('body').addClass('overflow_modal').css({ top: -scroll_pos + 'px' });
      }
    });

    // Submenu accordion toggle on SP
    $gnaviSubLink.on("click", function (e) {
      if (!window.matchMedia('(min-width: 768px)').matches) {
        e.preventDefault();
        const $this = $(this);
        const $parent = $this.parent();
        const $targetSub = $parent.children('.c-gnavi-sub');
        const isOpen = $parent.hasClass("is-open");

        $parent.toggleClass("is-open", !isOpen);
        if (!isOpen) {
          $targetSub.removeAttr('hidden').stop().slideDown(300);
        } else {
          $targetSub.stop().slideUp(300, function () {
            $(this).attr('hidden', 'until-found').css('display', '');
          });
        }

        const $otherParents = $gnaviSubParent.not($parent).filter('.is-open');
        $otherParents.removeClass("is-open").children('.c-gnavi-sub').stop().slideUp(300, function () {
          $(this).attr('hidden', 'until-found').css('display', '');
        });
      }
    });
  });
})(typeof jQuery !== 'undefined' ? jQuery : window.$);
