(function ($) {
    let scroll_pos1 = 0;
    // Inview
    const movement = new inview.observer({
        aniDelay: 300,
        optionView: { bottom: -50 },
    });

    // run inview 
    movement.init();
    function addFixedBodyModal() {
        scroll_pos1 = $(window).scrollTop();
        $('body')
            .addClass('overflow_modal')
            .css({ top: -scroll_pos1 + 'px' });
    }

    function removeFixedBodyModal() {
        $('body').removeClass('overflow_modal').css({ top: '' });
        $(window).scrollTop(scroll_pos1);
    }

    function debounce(func, wait = 100) {
        let timeout;
        return function () {
            clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }

    var BP = 767;
    var TOGGLE_SEL = ".menu_sub, .btn_sub";
    var SUB_SEL = "> .c-gnavi__sub, > .c-header__sub";
    var mqlSP = window.matchMedia("(max-width: " + BP + "px)");

    function findSub($item) {
        return $item.find(SUB_SEL);
    }

    function isSP() {
        return mqlSP.matches;
    }

    function handleScroll() {
        const scrollTop = $(window).scrollTop();

        if (scrollTop > 50) {
            $(".c-totop").css("transform", "translateY(0)");
            $(".c-header").addClass("active");
        } else {
            $(".c-totop").removeAttr("style");
            $(".c-header").removeClass("active");
        }
    }

    $(function () {
        $('a[href^="#"]').on('click', function (e) {
            var hash = $(this).attr("href");
            if (hash === "#") return;
            var el = document.getElementById(hash.substring(1));
            if (el) {
                e.preventDefault();
                var offset = $(el).offset().top - ($('.c-header').outerHeight() + 30);
                $('html, body').animate({ scrollTop: offset }, 600);
            }
        });

        var hashId = location.hash ? document.getElementById(location.hash.substring(1)) : null;
        if (hashId) {
            var offset = $(hashId).offset().top - ($('.c-header').outerHeight() + 30);
            $('html, body').animate({ scrollTop: offset }, 600);
        }

        $(".c-toggle").on("click", function () {
            var isActive = $(this).hasClass("active");
            $(this).toggleClass("active");

            $(".c-gnavi").stop().slideToggle("fast");

            if (isActive) {
                $(".menu_sub, .btn_sub").removeClass("is-open");
                $(".menu_sub > .c-gnavi__sub, .btn_sub > .c-header__sub").removeAttr("style");
                removeFixedBodyModal();
            } else {
                addFixedBodyModal();
            }
        });



        function closeSubmenu($item) {
            clearTimeout($item.data("hoverTimer"));
            $item.removeClass("is-open");
            var $sub = findSub($item);
            $sub.stop().slideUp(300, function () {
                $sub.css({ left: '', right: '', transform: '' });
            });
        }

        function adjustSubPosition($sub) {
            if (isSP()) return;

            $sub.css({ left: '', right: '', transform: '' });

            var rect = $sub[0].getBoundingClientRect();
            var viewportWidth = window.innerWidth;
            var margin = 8;

            if (rect.right > viewportWidth - margin) {
                $sub.css({
                    left: 'auto',
                    right: '0',
                    transform: 'none'
                });
            }
            else if (rect.left < margin) {
                $sub.css({
                    left: '0',
                    transform: 'none'
                });
            }
        }

        function openSubmenu($item) {
            $item.addClass("is-open");
            var $sub = findSub($item);

            if (!isSP()) {
                $sub.css({ visibility: 'hidden', display: 'block' });
                adjustSubPosition($sub);
                $sub.css({ visibility: '', display: 'none' });
            }

            $sub.stop().slideDown(300);
        }

        $(TOGGLE_SEL).on("touchstart", function () {
            $(this).data("isTouched", true);
        });

        $(TOGGLE_SEL).on("click", function (e) {
            if ($(e.target).closest(".c-gnavi__sub, .c-header__sub").length) return;

            var $link = $(e.target).closest(".c-gnavi__link, .c-btn");
            if ($link.length) {
                if ($link.hasClass("c-gnavi__link") && $(this).hasClass("menu_sub")) {
                    
                } else {
                    return;
                }
            }
            e.preventDefault();

            var $parent = $(this);
            var isOpen = $parent.hasClass("is-open");

            $parent.data("isTouched", false);

            $(TOGGLE_SEL).not($parent).each(function () {
                closeSubmenu($(this));
            });

            if (isOpen) {
                closeSubmenu($parent);
            } else {
                openSubmenu($parent);
            }
        });

        $(".c-gnavi a").on("click", function (e) {
            if (!isSP()) return;

            var $link = $(this);
            var href = ($link.attr("href") || "").trim();
            var target = $link.attr("target");

            if ($link.hasClass("c-gnavi__link") && $link.closest(".menu_sub").length) return;

            if (target === "_blank") {
                $(".c-gnavi").slideUp(300, function () {
                    $(".c-toggle").removeClass("active");
                    $(".menu_sub, .btn_sub").removeClass("is-open");
                    $(".c-gnavi__sub, .c-header__sub").removeAttr("style");
                    removeFixedBodyModal();
                });
                return;
            }

            e.preventDefault();
            $(".c-gnavi").slideUp(300, function () {
                removeFixedBodyModal();
                window.location.href = href;
            });
        });

        $(document).on("click", function (e) {
            var $openItems = $(TOGGLE_SEL + ".is-open");
            if (!$openItems.length) return;
            if (!$(e.target).closest(TOGGLE_SEL).length) {
                $openItems.each(function () {
                    closeSubmenu($(this));
                });
            }
        });

        $(".js-popup-video").on("click", function (e) {
            var youtubeUrl = $(this).attr("href");
            if (!youtubeUrl) return;

            var videoIdMatch = youtubeUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
            var videoId = videoIdMatch ? videoIdMatch[1] : null;

            if (videoId) {
                e.preventDefault();
                var iframeHtml = '<iframe src="https://www.youtube.com/embed/' + videoId + '?rel=0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
                $("#js-popup-video-wrap").html(iframeHtml);
                $("#js-popup-video").addClass("is-active");
            
                if (!$('body').hasClass('overflow_modal')) {
                    addFixedBodyModal();
                }
            }
        });

        $(".js-popup-close").on("click", function () {
            $("#js-popup-video").removeClass("is-active");
            
            setTimeout(function() {
                $("#js-popup-video-wrap").empty();
            }, 300);
            
            if (!$(".c-toggle").hasClass("active")) {
                removeFixedBodyModal();
            }
        });

        handleScroll();
    });

    $(window).on('load', function () {
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 1000,
                once: true,
            });
        }

        if ($('.js_scrollable, .has-fixed-layout').length && typeof ScrollHint !== 'undefined') {
            new ScrollHint('.js_scrollable, .has-fixed-layout', {
                scrollHintIconAppendClass: 'scroll-hint-icon-white',
                applyToParents: true,
                i18n: {
                    scrollable: 'スクロールできます',
                },
            });
        }

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

        handleScroll();
    });

    window.addEventListener('scroll', debounce(handleScroll, 30), { passive: true });

    $(window).on('resize', debounce(function () {
        if (!isSP()) {
            $(".c-gnavi").removeAttr("style");
            $(".c-toggle").removeClass("active");
            if ($('body').hasClass('overflow_modal')) {
                removeFixedBodyModal();
            }
        }

        $(".menu_sub, .btn_sub").removeClass("is-open");
        $(".menu_sub > .c-gnavi__sub, .btn_sub > .c-header__sub").removeAttr("style");

        handleScroll();
    }, 150));

})(jQuery);
