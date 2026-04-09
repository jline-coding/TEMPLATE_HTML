$(window).on("load resize", function () {
    const $header = $(".c-header");
    const $logo = $header.find(".c-header__logo__link");
    const $logoPic = $header.find(".c-header__logo__link picture");
    let lastHeight = 0;
    $logo.css("display", "block");
    $logoPic.css("display", "block");

    const ro = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const currentHeight = Math.round(entry.contentRect.height);
            
            if (currentHeight !== lastHeight) {
                lastHeight = currentHeight;
                let headerHeight = $header.innerHeight();
                document.querySelector("body").style.setProperty("--header-height", `${headerHeight}px`);
            }
        }
    });

    ro.observe($logoPic[0]);
});
