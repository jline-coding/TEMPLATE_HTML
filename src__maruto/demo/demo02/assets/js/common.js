function fadeInSection() {
    $(".js_inview").on("inview", function (t, e) {
        e && $(this).addClass("is_show")
    })
}
$(document).ready(function () {
    $("html, body");
    let t = location.hash;

    function e(t, e) {
        let s = $(t);
        s.length > 0 && (s.offset().top, $("html, body").animate({
            scrollTop: 0
        }, {
            duration: e ? 300 : 0,
            step(t, e) {
                0 !== e.end && (e.end = 0)
            }
        }))
    }
    $(window).on("load", function () {
        e(t)
    }), $("a[href^='#']").on("click", function (t) {
        t.preventDefault(), console.log(t);
        e(t.currentTarget.hash, !0)
    }), $(".toggle").click(function () {
        $(this).hasClass("active") ? ($(".toggle").removeClass("active"), $(".gnavi").stop().fadeToggle(), $("html").css("overflow", "")) : ($(this).toggleClass("active"), $(".gnavi").stop().fadeToggle("fast"), $("html").css("overflow", "hidden"))
    }), $(window).scroll(function () {
        $(this).scrollTop() > 0 ? ($(".totop").css("transform", "translateY(0)"), $(".header").addClass("active")) : ($(".totop").removeAttr("style"), $(".header").removeClass("active"))
    }), $(window).bind("load resize", function () {
        $(window).width() > 1023 && ($(".gnavi").removeAttr("style"), $(".toggle").removeClass("active")), $(this).scrollTop() > 100 ? ($(".totop").css("transform", "translateY(0)"), $(".header").addClass("active")) : ($(".totop").removeAttr("style"), $(".header").removeClass("active"))
    })
}), $(".accordion_js").on("click", function () {
    $(this).hasClass("active") ? ($(this).removeClass("active"), $(this).next().slideUp(300)) : ($(this).addClass("active"), $(this).next().slideDown(300))
}), $(window).on("load", function () {
    fadeInSection()
});