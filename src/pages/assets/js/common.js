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

                $parent.toggleClass("is-open", !isOpen);
                if (!isOpen) {
                    $targetSub.removeAttr('hidden').stop().slideDown(300);
                } else {
                    $targetSub.stop().slideUp(300, function () {
                        $(this).attr('hidden', 'until-found').css('display', '');
                    });
                }

                // Close other open submenus
                const $otherParents = $gnaviSubParent.not($parent).filter('.is-open');
                $otherParents.removeClass("is-open").children('.c-gnavi-sub').stop().slideUp(300, function () {
                    $(this).attr('hidden', 'until-found').css('display', '');
                });
            }
        });

        // =============================
        // In-Page Search (Ctrl+F) & Accordion Controller
        // =============================
        // 1. Accordions with hidden="until-found" and beforematch
        const customAccordions = document.querySelectorAll('.c-accordion:not(details), .js-accordion:not(details)');
        customAccordions.forEach(function (accordion, idx) {
            const head = accordion.querySelector('.c-accordion__head, .js-accordion__head');
            const body = accordion.querySelector('.c-accordion__body, .js-accordion__body');
            if (!head || !body) return;

            const isOpen = accordion.classList.contains('is-open');
            const uid = body.id || ('accordion-panel-' + idx);
            body.id = uid;
            head.setAttribute('aria-controls', uid);
            head.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

            if (!isOpen) {
                body.setAttribute('hidden', 'until-found');
            }

            // Auto-expand when matched by in-page search (Ctrl+F)
            body.addEventListener('beforematch', function () {
                accordion.classList.add('is-open');
                head.setAttribute('aria-expanded', 'true');
                $(body).css('display', '');
            });

            // Smooth toggle click
            head.addEventListener('click', function (e) {
                e.preventDefault();
                const willOpen = !accordion.classList.contains('is-open');
                accordion.classList.toggle('is-open', willOpen);
                head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');

                if (willOpen) {
                    body.removeAttribute('hidden');
                    $(body).hide().slideDown(250);
                } else {
                    $(body).slideUp(250, function () {
                        body.setAttribute('hidden', 'until-found');
                        $(body).css('display', '');
                    });
                }
            });
        });

        // 2. Progressive enhancement for standard <details class="c-accordion"> elements
        const detailAccordions = document.querySelectorAll('details.c-accordion, details.js-accordion');
        detailAccordions.forEach(function (details) {
            const summary = details.querySelector('.c-accordion__head, summary');
            const body = details.querySelector('.c-accordion__body');
            if (!summary || !body) return;

            let isAnimating = false;
            summary.addEventListener('click', function (e) {
                e.preventDefault();
                if (isAnimating) return;

                if (details.open) {
                    isAnimating = true;
                    $(body).slideUp(250, function () {
                        details.open = false;
                        $(body).css('display', '');
                        isAnimating = false;
                    });
                } else {
                    isAnimating = true;
                    details.open = true;
                    $(body).hide().slideDown(250, function () {
                        isAnimating = false;
                    });
                }
            });
        });

        // 3. Header submenu: in-page search (Ctrl+F) support
        document.querySelectorAll('.c-gnavi-sub').forEach(function (sub) {
            sub.addEventListener('beforematch', function () {
                const parent = sub.closest('.c-gnavi-list__item, .c-gnavi__item') || sub.parentElement;
                if (parent) {
                    parent.classList.add('is-open');
                }
                sub.removeAttribute('hidden');

                if (window.matchMedia('(min-width: 768px)').matches) {
                    sub.style.opacity = '1';
                    sub.style.contentVisibility = 'visible';
                    sub.style.pointerEvents = 'auto';
                    sub.style.transform = 'translateX(-50%) translateY(0)';
                } else {
                    const gnavi = sub.closest('.c-gnavi');
                    if (gnavi && !gnavi.classList.contains('is-open')) {
                        $toggle.addClass('active');
                        $gnavi.show();
                    }
                    $(sub).show();
                }
            });
        });

        // Click outside on desktop to reset opened submenu
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.c-gnavi-list__item.is-sub').length) {
                if (window.matchMedia('(min-width: 768px)').matches) {
                    $gnaviSubParent.filter('.is-open').each(function () {
                        const $item = $(this);
                        $item.removeClass('is-open');
                        const $sub = $item.children('.c-gnavi-sub');
                        $sub.attr('hidden', 'until-found');
                        $sub.removeAttr('style');
                    });
                }
            }
        });

        // 4. Inview / scroll animation: auto-reveal immediately when focused by in-page search
        document.addEventListener('focusin', function (e) {
            const fadeEl = e.target.closest('.js-fadeani, .js-inview, [data-aos]');
            if (fadeEl) {
                fadeEl.classList.add('active', 'is-inview', 'aos-animate');
                if (fadeEl.style) {
                    fadeEl.style.opacity = '1';
                    fadeEl.style.transform = 'none';
                }
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
