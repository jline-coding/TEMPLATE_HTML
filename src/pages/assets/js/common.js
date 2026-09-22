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

(function ($) {
    const $window = $(window);
    const $body = $('body');
    const $htmlBody = $('html, body');
    const $header = $('.c-header');
    const $totop = $('.c-totop');
    const $toggle = $('.c-toggle');
    const $gnavi = $('.c-gnavi');
    const $gnaviSubParent = $('.c-gnavi-list__item.is-sub');
    const $gnaviSubLink = $gnaviSubParent.children('.c-gnavi-link');
    const $gnaviSub = $gnaviSubParent.children('.c-gnavi-sub');

    let scroll_pos1 = 0;
    // Inview
    const movement = new inview.observer({
        aniDelay: 300,
        optionView: { bottom: -50 },
    });

    // run inview 
    movement.init();
    // =============================
    // Helper: Body lock/unlock (Modal)
    // =============================
    function addFixedBodyModal() {
        scroll_pos1 = $window.scrollTop();
        $body
            .addClass('overflow_modal')
            .css({ top: -scroll_pos1 + 'px' });
    }

    function removeFixedBodyModal() {
        $body.removeClass('overflow_modal').css({ top: '' });
        $window.scrollTop(scroll_pos1);
    }

    // =============================
    // Helper: Debounce
    // =============================
    function debounce(func, wait = 100) {
        let timeout;
        return function () {
            clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }

    // =============================
    // Scroll Behavior
    // =============================
    function handleScroll() {
        const scrollTop = $window.scrollTop();

        // Header active & ToTop visibility
        if (scrollTop > 50) {
            $totop.css("transform", "translateY(0)");
            $header.addClass("active");
        } else {
            $totop.removeAttr("style");
            $header.removeClass("active");
        }
    }

    // =============================
    // On Document Ready
    // =============================
    $(function () {
        // Smooth anchor scroll
        $('a[href^="#"]').on('click', function (e) {
            const $this = $(this);
            const hash = $this.attr("href");
            if (hash === "#") return;
            const $target = $(hash);
            if ($target.length) {
                e.preventDefault();
                const offset = $target.offset().top - ($header.outerHeight() + 30);
                $htmlBody.animate({ scrollTop: offset }, 600);
            }
        });

        // Auto scroll to anchor if URL has hash
        const hash = location.hash;
        if (hash) {
            const $target = $(hash);
            if ($target.length) {
                const offset = $target.offset().top - ($header.outerHeight() + 30);
                $htmlBody.animate({ scrollTop: offset }, 600);
            }
        }

        // Menu toggle
        $toggle.on("click", function () {
            const $this = $(this);
            const isActive = $this.hasClass("active");
            $this.toggleClass("active");

            $gnavi.stop().slideToggle("fast");
            if (isActive) {
                removeFixedBodyModal();
                $gnaviSubParent.removeClass("is-open");
                $gnaviSub.hide();
            } else {
                addFixedBodyModal();
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

                // Toggle menu hiện tại
                $parent.toggleClass("is-open", !isOpen);
                $targetSub.stop().slideToggle(300);

                // Đóng các submenu khác nếu có nhiều mục submenu
                const $otherParents = $gnaviSubParent.not($parent).filter('.is-open');
                $otherParents.removeClass("is-open").children('.c-gnavi-sub').stop().slideUp(300);
            }
        });

        // Initial scroll state
        handleScroll();
    });

    // =============================
    // On Window Load
    // =============================
    $window.on('load', function () {
        // Init AOS
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 1000,
                once: true,
            });
        }

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
        const fadeEls = document.querySelectorAll('.js-fadeani');
        if (fadeEls.length && 'IntersectionObserver' in window) {
            const fadeObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.2 });

            fadeEls.forEach(function (el) {
                fadeObserver.observe(el);
            });
        }

        // header
        handleScroll();
    });

    // =============================
    // On Scroll
    // =============================
    $window.on('scroll', debounce(handleScroll, 50));

    // =============================
    // On Resize
    // =============================
    $window.on('resize', debounce(function () {
        if (window.matchMedia('(min-width: 768px)').matches) {
            $gnavi.removeAttr("style");
            $toggle.removeClass("active");
            $gnaviSub.removeAttr("style");
            $gnaviSubParent.removeClass("is-open");
            if ($body.hasClass('overflow_modal')) {
                removeFixedBodyModal();
            }
        }
        handleScroll();
    }, 150));

})(jQuery);
