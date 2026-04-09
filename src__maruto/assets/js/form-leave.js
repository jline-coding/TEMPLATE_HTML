(function () {
    const form = document.querySelector('.js_leavecheck');
    if (!form) return;

    let isDirty = false;
    let isSubmitting = false;

    form.addEventListener('input', () => {
        isDirty = true;
    });

    form.addEventListener('change', () => {
        isDirty = true;
    });

    form.addEventListener('submit', () => {
        isSubmitting = true;
    });

    window.addEventListener('beforeunload', function (e) {
        if (!isDirty || isSubmitting) return;

        e.preventDefault();
        e.returnValue = '';
    });
})();
