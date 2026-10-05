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

    /**
     * Initializes Slick Sliders on elements with .js-slider, .js-slider-fade, .js-slider-center
     */
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

    // Auto-init on DOM Ready & Window Load
    $(function () {
        initSlickSliders();
    });

    $(window).on('load', function () {
        initSlickSliders();
    });

    window.initSlickSliders = initSlickSliders;

})(window.jQuery || window.$);
