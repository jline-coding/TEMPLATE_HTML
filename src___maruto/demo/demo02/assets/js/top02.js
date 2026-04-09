class slider {
    constructor(s, i) {
        this.optionSlick = i, this.class = $(s)
    }
    animate(s, i = ".active") {
        let e = 295 / 540,
            t = function () {
                return 135 * e / 1.83 - 6.5
            },
            l = function (s) {
                return 65 * s + t()
            };
        s.find(i).css({
            transform: "scale(0.89) translateX(-28px)"
        }), s.find(i).prevAll().each(function (s, i) {
            $(this).css("transform", "scale(" + e + ") translateX(-" + (0 === s ? t() : l(s)) + "%)")
        }), s.find(i).nextAll().each(function (s, i) {
            $(this).css("transform", "scale(" + e + ") translateX(-" + (0 === s ? t() : l(s)) + "%)")
        })
    }
    initSlider() {
        let s = this.animate;
        this.class.on("init", function (i, e) {
            $(this).find(".slick-slide").css("transition", "none"), $(this).find(".slick-current").addClass("active"), $(".people_index_current").html(e.currentSlide + 1), $(".people_index_total").html(e.$slides.length), s.call(slider, $(this))
        })
    }
    before() {
        let s = this.animate;
        this.class.on("beforeChange", function (i, e, t, l) {
            $(this).find(".slick-slide").css("transition", "0.5s"), e.$slides[t].classList.remove("active"), e.$slides[l].classList.add("active"), $(".people_index_current").html(l + 1), s.call(slider, $(this)), 0 === l && t === e.$slides.length - 1 && (e.$slides[t].nextSibling.classList.add("active"), s.call(slider, $(this), ".slick-cloned.active")), 0 === t && l === e.$slides.length - 1 && (e.$slides[t].previousSibling.classList.add("active"), s.call(slider, $(this), ".slick-cloned.active"))
        })
    }
    after() {
        let s = this.animate;
        this.class.on("afterChange", function (i, e, t, l) {
            $(this).find(".slick-slide").css("transition", "none"), $(this).find(".slick-cloned").removeClass("active"), s.call(slider, $(this))
        })
    }
    play() {
        this.initSlider(), this.class.slick(this.optionSlick), this.before(), this.after()
    }
}
const peopleList = new slider(".c_slider02", {
    dots: !1,
    infinite: !0,
    arrows: !0,
    speed: 500,
    autoplay: !0,
    autoplaySpeed: 2e3,
    slidesToShow: 2,
    slidesToScroll: 1,
    nextArrow: $('.btn_next'),
    prevArrow: $('.btn_prev'),
    responsive: [{
        breakpoint: 769,
        settings: {
            slidesToShow: 2
        },
        breakpoint: 425,
        settings: {
            slidesToShow: 2
        }
    }]
});
$(".p_top04__slider").slick({
    slidesToShow: 5,
    slidesToScroll: 1,
    speed: 1e3,
    arrows: !0,
    autoplay: !0,
    autoplaySpeed: 1e3,
    variableWidth: !0
}), peopleList.play();