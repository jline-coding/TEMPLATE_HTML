$(function () {
    'use strict';
    const obj = {
        init: function () {
            this.menu();
            this.toTop();
            this.anchorScroll();
        },
        //Totop
        toTop: function () {
            $('#to_top').click(function () {
                $('html,body').animate(
                    {
                        scrollTop: 0,
                    },
                    800
                );
                return false;
            });
        },
        //menu
        menu: function () {
            $('.nav_btn_hamburger').click(function () {
                if ($(this).hasClass('active')) {
                    $('html').removeClass('overflow');
                    $('#header').removeClass('active');
                    $('.nav_btn_hamburger').removeClass('active');
                    $('#nav').stop().fadeOut(300);
                } else {
                    $('html').stop().toggleClass('overflow');
                    $(this).stop().toggleClass('active');
                    $('#header').stop().toggleClass('active');
                    $('#nav').stop().fadeToggle(300);
                }
            });
        },
        //anchor scroll
        anchorScroll: function () {
            const hash1 = location.hash;
            const root = 'html, body';
            if (hash1 !== '') {
                const top = $(hash1).offset().top;
                if ($(window).width() > 767) {
                    $(root).animate({ scrollTop: top - 120 }, 800);
                } else {
                    $(root).animate({ scrollTop: top - 70 }, 800);
                }
            }
        },
    };
    obj.init();
});
//Smooth scroll
$(window).on('load', function () {
    $('.js_anchor').click(function () {
        let id = $(this).attr('href');
        const vw = $(window).width();
        const $target = $(id);
        $('.nav_btn_hamburger').removeClass('active');
        $('html').removeClass('overflow');
        if (vw > 767) {
            $('#nav').removeAttr('style');
        } else {
            $('#nav').stop().fadeOut(300);
        }
        if ($target.length > 0) {
            $('html, body').animate(
                {
                    scrollTop: $target.offset().top,
                },
                {
                    duration: 800,
                    step: (now, fx) => {
                        let realPos =
                            vw > 767
                                ? $target.offset().top - 80
                                : $target.offset().top - 50;
                        if (fx.end !== realPos) {
                            fx.end = realPos;
                        }
                    },
                }
            );
        }
        return false;
    });
});
//remove overflow on PC
$(window).on('resize load', function () {
    if ($(window).width() > 767) {
        $('html').removeClass('overflow');
        $('#header').removeClass('active');
    } else {
        if ($('.nav_btn_hamburger').hasClass('active')) {
            $('html').addClass('overflow');
            $('#header').addClass('active');
        } else {
            $('#nav').removeAttr('style');
            $('#header').removeClass('active');
        }
    }
});
$(window).on('resize load scroll', function () {
    var vW = $(window).width();
    var pTop = $(window).scrollTop();
    var fCta = $('.footer_cta').outerHeight();
    if (vW <= 767) {
        if (pTop > 0) {
            $('#footer').css('marginBottom', fCta);
        } else {
            $('#footer').css('marginBottom', '');
        }
    } else {
        $('#footer').removeAttr('style');
    }
});
//FadeIn every section
function fadeInSection() {
    const js_inview = $('.js_inview');
    js_inview.map((a, b) => {
        let _ = $(b).attr('data-offset')
            ? $(b).attr('data-offset') * $(b).outerHeight()
            : 0;
        if ($(b).offset().top < window.innerHeight + window.scrollY - _) {
            $(b).addClass('is_show');
        }
    });
}

//fixed header when scroll
// $(window).on('resize load scroll', function () {
//     const pTop = $(window).scrollTop();
//     if (pTop > 0) {
//         $('#header').addClass('fixed');
//     } else {
//         $('#header').removeClass('fixed');
//     }
// });

//remove class flag
// $(window).bind('load resize', function () {
//     var vw = $(window).width();
//     if (vw > 767) {
//         $('.has_sub').removeClass('flag');
//         $('.has_sub').removeClass('active');
//         $('.nav_sub_menu').removeAttr('style');
//     } else {
//         $('.has_sub').addClass('flag');
//     }
// });

//show hide totop button
$(window).on('load scroll', function () {
    if ($(this).scrollTop() > 100) {
        $('#to_top').fadeIn();
    } else {
        $('#to_top').fadeOut();
    }
    if ($(this).scrollTop() > 200) {
        $('.footer_cta').addClass('show');
    } else {
        $('.footer_cta').removeClass('show');
    }
});
//set up preloading page
$(window).on('load scroll', function () {
    if ($('html').hasClass('is_loading')) {
        $('html').removeClass('is_loading');
        setTimeout(function () {
            fadeInSection();
        }, 2600);
    } else {
        fadeInSection();
    }
});

//Stop scroll content on ios mobile when click open menu ios
$(document).ready(function () {
    (function () {
        let _overlay = document.getElementById('nav');
        let _clientY = null;
        _overlay.addEventListener(
            'touchstart',
            function (event) {
                if (event.targetTouches.length === 1) {
                    _clientY = event.targetTouches[0].clientY;
                }
            },
            false
        );

        _overlay.addEventListener(
            'touchmove',
            function (event) {
                if (event.targetTouches.length === 1) {
                    disableRubberBand(event);
                }
            },
            false
        );
        function disableRubberBand(event) {
            let clientY = event.targetTouches[0].clientY - _clientY;
            if (_overlay.scrollTop === 0 && clientY > 0) {
                event.preventDefault();
            }
            if (isOverlayTotallyScrolled() && clientY < 0) {
                event.preventDefault();
            }
        }

        function isOverlayTotallyScrolled() {
            return (
                _overlay.scrollHeight - _overlay.scrollTop <=
                _overlay.clientHeight
            );
        }
    })();
    (function () {
        let html = `<div id="cookiewrap" class="cookie_wrap">
            <div class="cookie_container">
            <p class="cookie_txt">このウェブサイトではサイトの利便性の向上を目的にクッキーを使用します。ブラウザの設定によりクッキーの機能を変更することもできます。サイトを閲覧いただく際には、クッキーの使用に同意いただく必要があります。</p>
            <p class="cookie_close"><a href="javascript:void(0)" class="cookie_btn">同意する</a></p>
            </div>
        </div>`;
        $('#wrapper').append(html);
        /**
         * クッキー操作
         */
        var COOKIECTRL = {
            get: function (name) {
                var cookies = document.cookie.split(';');
                for (
                    var index = 0, length = cookies.length;
                    index < length;
                    index += 1
                ) {
                    var temp = cookies[index].replace(/\s/g, '').split('=');
                    if (temp[0] === name) {
                        return decodeURIComponent(temp[1]);
                    }
                }
                return null;
            },
            set: function (name, value, expires, path, domain, secure) {
                var d = document;
                var today = new Date();
                if (expires) {
                    expires = expires * 1000 * 60 * 60 * 24;
                }
                var expires_date = new Date(today.getTime() + expires);
                d.cookie =
                    name +
                    '=' +
                    encodeURIComponent(value) +
                    (expires ? ';expires=' + expires_date.toUTCString() : '') +
                    (path ? ';path=' + path : '') +
                    (domain ? ';domain=' + domain : '') +
                    (secure ? ';secure' : '');
            },
            del: function (name, path, domain) {
                var d = document;
                if (this.get(name)) {
                    d.cookie =
                        name +
                        '=' +
                        (path ? ';path=' + path : '') +
                        (domain ? ';domain=' + domain : '') +
                        ';expires=Thu, 01-Jan-1970 00:00:01 GMT';
                }
            },
        };

        var body = document.querySelector('body');
        var wrap = document.querySelector('#cookiewrap');
        var button = document.querySelector('#cookiewrap .cookie_btn');
        var COOKIE_NAME = 'dinc_cookieAccepted';
        var GDPR = 'gdpr';

        var getClassList = function () {
            return Array.prototype.slice.call(body.classList);
        };

        if (COOKIECTRL.get(COOKIE_NAME)) {
            // GDPR表示なし
            // GDPRを非表示にする
            wrap.style.display = 'none';
        } else {
            // GDPR表示あり
            // body要素のclass属性値に「gdpr」を付加する
            var classes = getClassList();
            classes.push(GDPR);
            body.className = classes.join(' ');

            // ボタンをクリックされた際の動作
            button.addEventListener('click', function () {
                // body要素のclass属性値から「gdpr」を削除する
                var classes = getClassList();
                body.className = classes
                    .filter(function (className) {
                        return className !== GDPR;
                    })
                    .join(' ');

                // クッキーにフラグをGDPR非表示フラグを立てる
                COOKIECTRL.set(COOKIE_NAME, 'true', 365, '/');

                // GDPRを非表示にする
                wrap.style.display = 'none';
            });
        }
    })();
});
