$(function () {
    'use strict';
    var obj = {
        init: function () {
            this.topSlider();
            this.topSlider1();
        },
        topSlider: function () {
            const prev_arrow = '<div class="slick-prev"></div>',
                next_arrow = '<div class="slick-next"></div>';
            $('.production_slide').slick({
                dots: true,
                infinite: true,
                speed: 800,
                autoplay: true,
                autoplaySpeed: 3000,
                arrows: true,
                fade: false,
                draggable: true,
                prevArrow: prev_arrow,
                nextArrow: next_arrow,
                slidesToShow: 3,
                slidesToScroll: 1,
                variableWidth: true,
                cssEase: 'linear',
                centerMode: true,
            });
        },
        topSlider1: function () {
            const prev_arrow = '<div class="slick-prev"></div>',
                next_arrow = '<div class="slick-next"></div>';
            const a = $('.people_slide');
            const aSlider = {
                trans_left: 'translateX(-40px)',
                trans_right: 'translateX(40px)',
                trans_scale: 'scale3d(1.267,1.267, 1)',
            };
            a.on('init', function (slick) {
                $(this)
                    .find('.slick-center.slick-active.slick-current')
                    .addClass('active');
                $(this)
                    .find('.active')
                    .prevAll()
                    .each(function () {
                        $(this).css('transform', aSlider.trans_left);
                    });
                $(this)
                    .find('.active')
                    .nextAll()
                    .each(function () {
                        $(this).css('transform', aSlider.trans_right);
                    });
            });
            a.slick({
                dots: true,
                slidesToShow: 1,
                slidesToScroll: 1,
                prevArrow: prev_arrow,
                nextArrow: next_arrow,
                centerMode: true,
                centerPadding: 0,
                autoplay: false,
                autoplaySpeed: 2000,
                speed: 300,
                dotsClass: 'slide_count',
                customPaging: function (slider, i) {
                    var slideNumber = i + 1,
                        totalSlides = slider.slideCount;
                    return (
                        '<span class="count"><span class="current">' +
                        slideNumber +
                        ' </span>' +
                        totalSlides +
                        '</span>'
                    );
                },
            });

            // // On before slide change
            a.on(
                'beforeChange',
                function (event, slick, currentSlide, nextSlide) {
                    $(this).find('.slick-slide').css('transition', '');

                    slick.$slides[currentSlide].classList.remove('active');
                    slick.$slides[nextSlide].classList.add('active');

                    $(this)
                        .find('.active')
                        .prevAll()
                        .each(function () {
                            $(this).css('transform', aSlider.trans_left);
                        });
                    $(this)
                        .find('.active')
                        .nextAll()
                        .each(function () {
                            $(this).css('transform', aSlider.trans_right);
                        });
                    $(this)
                        .find('.active')
                        .css('transform', aSlider.trans_scale);

                    if (
                        nextSlide === 0 &&
                        currentSlide === slick.$slides.length - 1
                    ) {
                        $(this)
                            .find('.slick-current.slick-active.slick-center')
                            .css('transform', aSlider.trans_left);
                        $(this)
                            .find('.slick-current.slick-active.slick-center')
                            .prevAll()
                            .css('transform', aSlider.trans_left);
                        $(this)
                            .find('.slick-current.slick-active.slick-center')
                            .next()
                            .css('transform', aSlider.trans_scale);
                    }
                    if (
                        currentSlide === 0 &&
                        nextSlide === slick.$slides.length - 1
                    ) {
                        $(this)
                            .find('.slick-current.slick-active.slick-center')
                            .css('transform', aSlider.trans_right);
                        $(this)
                            .find('.slick-current.slick-active.slick-center')
                            .nextAll()
                            .css('transform', aSlider.trans_right);
                        $(this)
                            .find('.slick-current.slick-active.slick-center')
                            .prev()
                            .css('transform', aSlider.trans_scale);
                    }
                }
            );

            // // // On before slide change
            a.on(
                'afterChange',
                function (event, slick, currentSlide, nextSlide) {
                    $(this).find('.slick-slide').css('transition', 'none');
                    $(this)
                        .find('.active')
                        .prevAll()
                        .each(function () {
                            $(this).css('transform', aSlider.trans_left);
                        });
                    $(this)
                        .find('.active')
                        .nextAll()
                        .each(function () {
                            $(this).css('transform', aSlider.trans_right);
                        });
                    $(this)
                        .find('.active')
                        .css('transform', aSlider.trans_scale);
                }
            );
        },
    };
    obj.init();
});
