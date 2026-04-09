$(window).on("load", function () {
    $("html").is(".is_loadding") && $("html").removeClass("is_loadding")
}), $(".p_top04__slider").slick({
    slidesToShow: 5,
    slidesToScroll: 1,
    speed: 1e3,
    arrows: !0,
    autoplay: !0,
    autoplaySpeed: 1e3,
    variableWidth: !0
});