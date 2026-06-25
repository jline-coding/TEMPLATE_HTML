(function($){
    $(window).on("load",function(){
        $(".js-mCustomScrollbar").mCustomScrollbar();
    });

    $(function() {
        var defaultText = '添付する';

        $('.js-file input[type="file"]').on('change', function() {
            var file = $(this)[0].files[0];
            var $wrapper = $(this).closest('.js-file');
            var $content = $wrapper.find('.js-file__content');
            var $clearBtn = $wrapper.find('.js-file-clear');

            if (file) {
                $content.text(file.name).addClass('is-active');
                $clearBtn.show();
            } else {
                $content.text(defaultText).removeClass('is-active');
                $clearBtn.hide();
            }
        });

        $('.js-file-clear').on('click', function() {
            var $wrapper = $(this).closest('.js-file');
            var $input = $wrapper.find('input[type="file"]');
            var $content = $wrapper.find('.js-file__content');

            $input.val('');
            $content.text(defaultText).removeClass('is-active');
            $(this).hide();
        });
    });
   
    $.datepicker.regional['ja'] = {
        closeText: '閉じる',
        prevText: '&#x3c;前',
        nextText: '次&#x3e;',
        currentText: '今日',
        monthNames: ['1月','2月','3月','4月','5月','6月',
        '7月','8月','9月','10月','11月','12月'],
        monthNamesShort: ['1月','2月','3月','4月','5月','6月',
        '7月','8月','9月','10月','11月','12月'],
        dayNames: ['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'],
        dayNamesShort: ['日','月','火','水','木','金','土'],
        dayNamesMin: ['日','月','火','水','木','金','土'],
        weekHeader: '週',
        dateFormat: 'yy/mm/dd',
        firstDay: 0,
        isRTL: false,
        showMonthAfterYear: true,
        yearSuffix: '年'
    };

    $.datepicker.setDefaults($.datepicker.regional['ja']);

    $(function() {
        if ($('.js-datepicker').length) {
            $('.js-datepicker').datepicker();
        }
    });

})(jQuery);
