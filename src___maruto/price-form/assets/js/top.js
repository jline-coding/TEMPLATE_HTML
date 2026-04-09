(function () { 
    const eleOther = document.querySelector("#other");
    if (eleOther) {
        let otherContent = document.querySelector("#other_content");
        otherContent.addEventListener("input", function () {
            if (this.value) {
                eleOther.value = `その他(${this.value})`;
            } else {
                eleOther.value = "その他";
            }
        });
        otherContent.addEventListener("focus", function() {
            eleOther.checked = true;
        })
    }

    const eleContent = document.querySelector("#content");
    if (eleContent) {
        let placeholder = "・プロジェクトの詳細：\n・不明点：";
        let valueInit = true;
        eleContent.addEventListener("focus", function() {
            if(valueInit || !this.value) {
                this.value = placeholder;
            }
        })
        eleContent.addEventListener("input", function() {
            valueInit = false;
        });

        eleContent.addEventListener("blur", function() {
            if(valueInit) {
                this.value = "";
            }
        });
    }

    $('.js_number_top, .js_number_child').on('input', function () {
        let value = $(this).val();    
        if(value < 0){
            value = 0;
        }
        $(this).val(value);
    })
    

    $('.js_inputchange').on('input', function () {
        let number_top  = parseInt($('.js_number_top ').val()) ? parseInt($('.js_number_top ').val()) : 0;
        let price_top = 30000;

        let number_child  = parseInt($('.js_number_child').val()) ? parseInt($('.js_number_child').val()) : 0;
        let price_child = 15000;

        let checked_sp = $('.js_check_sp:checked').data('value') ? $('.js_check_sp:checked').data('value') : 1;

        let checked_wp = $('.js_check_wp:checked').data('value') ? $('.js_check_wp:checked').data('value') : 0;

        let checked_form = $('.js_check_form:checked').data('value') ? $('.js_check_form:checked').data('value') : 0;

        let total = ((((number_top * price_top) + (number_child * price_child))*checked_sp) + checked_wp + checked_form);

        $('.js_total').val(total.toLocaleString('ja-JP') + ' 円');

    });
})();

