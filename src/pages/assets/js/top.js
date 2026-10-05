(function ($) { 
  $(window).on("load", function () {
    $('.c-loading').delay(500).fadeOut('fast');
  });

  // // Initialize Inview engine
  // if (typeof inview !== 'undefined' && inview.observer) {
  //   const movement = new inview.observer({
  //     simultaneous: false,
  //     loop: false,
  //   });
  // }
})(jQuery);
