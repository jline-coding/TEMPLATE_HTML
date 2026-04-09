(function () {   
    
    function initSlider() {
        $('.c_scrollcontent__content').slick({
            slidesToShow: 1,
            slidesToScroll: 1,
            autoplay: true,
            autoplaySpeed: 5000,
            arrows: false,
            appendDots: $('.c_scrollcontent__dots'),
            dots: true
        });
    }

    function destroySlider() {
        $('.c_scrollcontent__content').slick('unslick');
    }

    if(window.innerWidth >= 768) {
        initSlider(); 
    }

    $(window).resize(function(){
        if(window.innerWidth >= 768) {
            if (!$('.c_scrollcontent__content').hasClass('slick-initialized')) {
                initSlider(); 
            }
        } else {
            if ($('.c_scrollcontent__content').hasClass('slick-initialized')) {
                destroySlider(); 
            }
        }
    });


    $(window).on("load", function () {
        $('.c_loading').delay(500).fadeOut('fast')
    });   
})();
$(function(){
    $('.readmore .c_btn02').on('click',function(){
        console.log($(this).closest('.readmore-content'))
      const t = $(this).closest('.readmore').find('.readmore-content');
      t.toggleClass('is_open');
      if(t.hasClass('is_open')){
        const h = t.get(0).scrollHeight;
        t.css('height', h);
        $(this).text('元に戻す')
      }else{
        t.css('height','');
        $(this).text('続きを見る');
      }
    });
});

gsap.to(".c_bgani", {
    opacity: 1,
    scrollTrigger: {
        trigger: ".c_bgani",
        start: `top ${window.innerHeight/2}`,
        end: `+=${window.innerHeight/2}`,
        scrub: 1.5,  
    }
});



let root =  $(".c_scrollcontent__inner");
let parent = $(".c_scrollcontent__content");
let child = $(".c_scrollcontent__item");
let hScroll = root.clientHeight - window.innerHeight;



$('.c_scrollcontent__item').on('click',function(){
    const id =  $(this).data('id'); 
    $('#modal_'+id).fadeIn();
    $('body').css('overflow','hidden')
})
$('.c_modal .close').on('click',function(){ 
    $('.c_modal').fadeOut()
    $('body').removeAttr('style')
})





