'use strict';

/* ==========================================================================
   [Component: c-file]
   ========================================================================== */

(function ($) {
    'use strict';
    if (!$) return;

    $(document).on('change.cFile', '.js-file input[type="file"]', function () {
        const file = this.files && this.files[0];
        const $wrapper = $(this).closest('.js-file');
        const $content = $wrapper.find('.js-file__content');
        const $clearBtn = $wrapper.find('.js-file-clear');

        if (!$content.data('default-text')) {
            $content.data('default-text', $content.text().trim() || '添付する');
        }

        if (file) {
            $content.text(file.name).addClass('is-active');
            $clearBtn.addClass('is-active').show();
        } else {
            $content.text($content.data('default-text')).removeClass('is-active');
            $clearBtn.removeClass('is-active').hide();
        }
    });

    $(document).on('click.cFile', '.js-file-clear', function (e) {
        e.preventDefault();
        const $wrapper = $(this).closest('.js-file');
        const $input = $wrapper.find('input[type="file"]');
        const $content = $wrapper.find('.js-file__content');

        $input.val('');
        const defaultText = $content.data('default-text') || '添付する';
        $content.text(defaultText).removeClass('is-active');
        $(this).removeClass('is-active').hide();
    });

})(window.jQuery || window.$);
