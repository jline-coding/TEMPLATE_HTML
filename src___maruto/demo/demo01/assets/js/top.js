;
(function () {
    const people_slick = $('.people_slider_slick');
    people_slick.slick({
        infinite: true,
        slidesToShow: 2,
        dots: 0,
        prevArrow: $('.people_slider_prev'),
        nextArrow: $('.people_slider_next'),
        responsive: [{
            breakpoint: 768,
            settings: {
                slidesToShow: 1,
            }
        }, ]
    });
})();