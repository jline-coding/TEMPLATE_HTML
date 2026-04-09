(function ($) {
  "use strict";

  $(function () {
    $(".p-event__slider").each(function () {
      var $slider = $(this);
      var $items = $slider.find(".p-event__slider__item");
      var total = $items.length;
      if (total <= 0) return;

      var current = 0;
      var isAnimating = false;
      var autoplayTimer = null;
      var autoplayDelay = 5000;

      $items.wrapAll('<div class="p-event__slider__track"></div>');
      var $track = $slider.find(".p-event__slider__track");
      $track.wrap('<div class="p-event__slider__viewport"></div>');

      $items.first().addClass("is-active");

      var thumbHtml = '<div class="p-event__slider__thumbs"><div class="p-event__slider__thumbs-track">';
      $items.each(function (i) {
        var src = $(this).find("img").attr("src");
        thumbHtml += '<div class="p-event__slider__thumb' + (i === 0 ? " is-active" : "") + '" data-index="' + i + '"><img src="' + src + '" alt=""></div>';
      });
      thumbHtml += "</div></div>";
      $slider.append(thumbHtml);

      var $thumbs = $slider.find(".p-event__slider__thumb");
      var $thumbsContainer = $slider.find(".p-event__slider__thumbs");

      function scrollThumbs(index) {
        if (typeof isDraggingThumbs !== 'undefined' && isDraggingThumbs) return;
        var $activeThumb = $thumbs.eq(index);
        if (!$activeThumb.length) return;
        var containerWidth = $thumbsContainer.outerWidth();
        var thumbLeft = $activeThumb.position().left;
        var thumbWidth = $activeThumb.outerWidth(true);
        var targetScroll = $thumbsContainer.scrollLeft() + thumbLeft - (containerWidth / 2) + (thumbWidth / 2);
        $thumbsContainer.stop().animate({ scrollLeft: targetScroll }, 300);
      }

      function goTo(index) {
        if (isAnimating) return;
        var realIndex = index;
        if (realIndex < 0) realIndex = total - 1;
        if (realIndex >= total) realIndex = 0;
        if (realIndex === current) return;

        isAnimating = true;
        $items.removeClass("is-active");
        $items.eq(realIndex).addClass("is-active");

        $thumbs.removeClass("is-active");
        $thumbs.eq(realIndex).addClass("is-active");
        scrollThumbs(realIndex);

        current = realIndex;
        setTimeout(function () {
          isAnimating = false;
        }, 500);
      }

      function goNext() { goTo(current + 1); }
      function goPrev() { goTo(current - 1); }

      function startAutoplay() {
        stopAutoplay();
        autoplayTimer = setInterval(goNext, autoplayDelay);
      }

      function stopAutoplay() {
        if (autoplayTimer) {
          clearInterval(autoplayTimer);
          autoplayTimer = null;
        }
      }

      var isDraggingThumbs = false;
      var startXThumbs = 0;
      var scrollLeftThumbs = 0;
      var hasDraggedThumbs = false;
      var rAF_Thumbs = null;
      var dragNS = ".tDrag_" + Math.random().toString(36).substr(2, 5);

      $thumbsContainer.on("dragstart", function (e) {
          e.preventDefault();
      });

      $thumbsContainer.on("mousedown", function (e) {
        if (e.which !== 1) return;
        isDraggingThumbs = true;
        hasDraggedThumbs = false;
        startXThumbs = e.pageX;
        scrollLeftThumbs = $thumbsContainer.scrollLeft();
        $thumbsContainer.css("cursor", "grabbing");

        $(document).on("mousemove" + dragNS, function (e) {
          if (!isDraggingThumbs) return;
          if (e.buttons === 0 || e.which === 0) {
              $(document).trigger("mouseup" + dragNS);
              return;
          }
          var walk = (e.pageX - startXThumbs) * 1.5;
          if (Math.abs(e.pageX - startXThumbs) > 5) {
            hasDraggedThumbs = true;
            e.preventDefault();
          }
          if (hasDraggedThumbs) {
            if (rAF_Thumbs) cancelAnimationFrame(rAF_Thumbs);
            rAF_Thumbs = requestAnimationFrame(function () {
              $thumbsContainer.scrollLeft(scrollLeftThumbs - walk);
            });
          }
        });

        $(document).on("mouseup" + dragNS, function () {
          isDraggingThumbs = false;
          $thumbsContainer.css("cursor", "");
          if (rAF_Thumbs) cancelAnimationFrame(rAF_Thumbs);
          $(document).off("mousemove" + dragNS + " mouseup" + dragNS);
        });
      });

      $thumbs.on("click", function (e) {
        if (hasDraggedThumbs) {
            e.preventDefault();
            return;
        }
        var idx = $(this).data("index");
        if (idx === current) return;
        stopAutoplay();
        goTo(idx);
        startAutoplay();
      });

      $slider.on("mouseenter", function () { stopAutoplay(); });
      $slider.on("mouseleave", function () { startAutoplay(); });

      var isDraggingMain = false;
      var startXMain = 0;
      var diffXMain = 0;
      var viewDragNS = ".vDrag_" + Math.random().toString(36).substr(2, 5);
      var $viewport = $slider.find(".p-event__slider__viewport");

      $viewport.on("dragstart", function (e) {
         e.preventDefault();
      });

      $viewport.on("mousedown touchstart", function (e) {
        if (e.type === "mousedown" && e.which !== 1) return;
        isDraggingMain = true;
        startXMain = e.type === "touchstart" ? e.originalEvent.touches[0].clientX : e.pageX;
        diffXMain = 0;
        stopAutoplay();
        $viewport.css("cursor", "grabbing");

        $(document).on("mousemove" + viewDragNS + " touchmove" + viewDragNS, function (e) {
          if (!isDraggingMain) return;
          if (e.type === "mousemove" && (e.buttons === 0 || e.which === 0)) {
              $(document).trigger("mouseup" + viewDragNS);
              return;
          }
          var currentX = e.type === "touchmove" ? e.originalEvent.touches[0].clientX : e.pageX;
          diffXMain = currentX - startXMain;
          if (e.type === "mousemove" && Math.abs(diffXMain) > 5) {
            e.preventDefault();
          }
        });

        $(document).on("mouseup" + viewDragNS + " touchend" + viewDragNS, function () {
          isDraggingMain = false;
          $viewport.css("cursor", "");
          if (Math.abs(diffXMain) > 40) {
            if (diffXMain < 0) {
              goNext();
            } else {
              goPrev();
            }
          }
          startAutoplay();
          $(document).off("mousemove" + viewDragNS + " touchmove" + viewDragNS + " mouseup" + viewDragNS + " touchend" + viewDragNS);
        });
      });

      $thumbsContainer.on("touchstart", function () { stopAutoplay(); });
      $thumbsContainer.on("touchend", function () { startAutoplay(); });

      startAutoplay();
    });
  });
})(jQuery);
