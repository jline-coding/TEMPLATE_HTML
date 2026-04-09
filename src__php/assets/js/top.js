(function () {
  $(function () {
    $('.c-slider').slick({
      arrows: false,
      dots: true,
      slidesToShow: 1,
      slidesToScroll: 1,
      speed: 800,
      autoplay: true,
      autoplaySpeed: 5000,
      fade: true,
    });

    $('.c-slider01__inner').slick({
      arrows: true,
      dots: true,
      prevArrow: $('.c-slider01__arrow__prev'),
      nextArrow: $('.c-slider01__arrow__next'),
      slidesToShow: 1,
      slidesToScroll: 1,
      speed: 800,
      autoplay: true,
      autoplaySpeed: 5000,
    });
  });

  $(function () {
    const odometer = $(".odometer");

    const HanldeOdometerState = () => {
        odometer.map((a, b) => {
            const _ = $(b);
            const { scrollY, innerHeight } = window;

            if (_.offset().top < scrollY + innerHeight * 0.8 && !_.hasClass("run")) {
                let _num = +_.attr("data-num");
                _.text(_num);
                _.addClass("run");
            }
        });
    };

    function initOdometer() {
      $('.c-loading').delay(500).fadeOut('fast');
      HanldeOdometerState();
    }

    if (document.readyState === 'complete') {
      initOdometer();
    } else {
      $(window).on("load", initOdometer);
    }

    $(window).on("scroll", function () {
      HanldeOdometerState();
    });
  });

})();
