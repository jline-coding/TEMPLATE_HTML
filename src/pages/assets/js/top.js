(function ($) { 
  const $slider = $('.c-slider');
  const $naviRun = $('.c-slider__navi__run');

  if ($slider.length) {
    $slider.on('init', function(event, slick){
      $('.c-slider__navi__count').text(slick.slideCount);
      $naviRun.text(1);
    });

    $slider.slick({
      arrows: true,
      prevArrow: $('.c-slider__arrows__prev'),
      nextArrow: $('.c-slider__arrows__next'),
      appendArrows: $('.c-slider__arrows'),
      centerMode: true,
      slidesToShow: 1,
      slidesToScroll: 1,
      speed: 500,
      autoplay: true,
      autoplaySpeed: 2000,
    });

    $slider.on('afterChange', function(event, slick, currentSlide){
      const i = currentSlide + 1;
      $naviRun.text(i);
    });
  }

  $(window).on("load", function () {
    $('.c-loading').delay(500).fadeOut('fast');
  });
})(jQuery);



