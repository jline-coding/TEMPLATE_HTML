;
(function () {
    const html = $('html');
    const nav = $('.nav');
    const nav_inner = $('.nav .inner');
    const nav_toggler = $('.nav_toggler');
    const nav_toggler_opts = {
        active: 'is_active'
    }
    const handleNavTogglerState = (sta = true) => {
        if (sta) {
            // close
            nav.removeClass(nav_toggler_opts.active);
            nav_toggler.removeClass(nav_toggler_opts.active);
            html.css({
                overflow: ''
            });
        } else {
            // open
            nav.addClass(nav_toggler_opts.active);
            nav_toggler.addClass(nav_toggler_opts.active);
            html.css({
                overflow: 'hidden'
            });
        }

    }
    nav_toggler.on('click', function () {
        const sta = nav_toggler.hasClass(nav_toggler_opts.active);
        handleNavTogglerState(sta);
    });
    nav_inner.on('click', function () {
        handleNavTogglerState();
    });
    const totop = $('.totop');
    totop.on('click', function () {
        $('html').animate({
            scrollTop: 0
        }, 600);
    });
    $(window).on('load scroll', function () {
        const {
            scrollY
        } = window;
        if (scrollY > 100) {
            totop.addClass('is_active');
        } else {
            totop.removeClass('is_active');
        }
    })

    function fadeInSection() {
        $('.js_inview').on('inview', function (event, isInView) {
            if (isInView) {
                let _this = $(this);
                _this.addClass('is_show');
            } else {
                // element has gone out of viewport
            }
        });
    }
    $(window).on('load', function () {
        if ($('html').hasClass('is_loading')) {
            $('html').removeClass('is_loading');
            setTimeout(function () {
                fadeInSection();
            }, 2600);
        } else {
            fadeInSection();
        }
    })
})();
(function () {
    let html = `<div id="cookiewrap" class="cookie_wrap">
        <div class="cookie_container">
        <p class="cookie_txt">このウェブサイトではサイトの利便性の向上を目的にクッキーを使用します。ブラウザの設定によりクッキーの機能を変更することもできます。サイトを閲覧いただく際には、クッキーの使用に同意いただく必要があります。</p>
        <p class="cookie_close"><a href="javascript:void(0)" class="cookie_btn">同意する</a></p>
        </div>
    </div>`;
    $("#wrapper").append(html);
    /**
     * クッキー操作
     */
    var COOKIECTRL = {
        get: function (name) {
            var cookies = document.cookie.split(';');
            for (var index = 0, length = cookies.length; index < length; index += 1) {
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
            var expires_date = new Date(today.getTime() + (expires));
            d.cookie = name + '=' + encodeURIComponent(value) +
                ((expires) ? ';expires=' + expires_date.toUTCString() : '') +
                ((path) ? ';path=' + path : '') +
                ((domain) ? ';domain=' + domain : '') +
                ((secure) ? ';secure' : '');
        },
        del: function (name, path, domain) {
            var d = document;
            if (this.get(name)) {
                d.cookie = name + '=' +
                    ((path) ? ';path=' + path : '') +
                    ((domain) ? ';domain=' + domain : '') +
                    ';expires=Thu, 01-Jan-1970 00:00:01 GMT';
            }
        }
    };

    var body = document.querySelector('body');
    var wrap = document.querySelector('#cookiewrap');
    var button = document.querySelector('.cookie_btn');
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
            body.className = classes.filter(function (className) {
                return className !== GDPR;
            }).join(' ');

            // クッキーにフラグをGDPR非表示フラグを立てる
            COOKIECTRL.set(COOKIE_NAME, 'true', 365, '/');

            // GDPRを非表示にする
            wrap.style.display = 'none';
        });
    }
})();