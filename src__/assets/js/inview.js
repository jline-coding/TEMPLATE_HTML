var inview = (function (exports) {
  'use strict';

  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };
  const styleAnimation = function() {
    let styleDefault = {
      fadeRight: {
        opacity: 0,
        x: -100,
        library: "gsap"
      },
      fadeLeft: {
        opacity: 0,
        x: 100,
        library: "gsap"
      },
      zoom: {
        opacity: 0,
        scale: 0.5,
        library: "gsap"
      },
      fadeUp: {
        opacity: 0,
        y: 100,
        library: "gsap"
      }
    };
    let handler = {
      set(obj, prop, value) {
        if (prop in obj) {
          throw Error(`property ${prop} is existed please choose other property`);
        } else {
          if (typeof value === "function" || typeof value === "object") {
            return Reflect.set(obj, prop, value);
          } else {
            throw Error(`property ${value} expected is function or object`);
          }
        }
      }
    };
    return new Proxy(styleDefault, handler);
  }();
  class utility {
    constructor(optionScreen = {}) {
      this.optionScreen = optionScreen;
      this.stateScreen = "none";
    }
    getScrollTop() {
      return document.documentElement.scrollTop || document.body.scrollTop || window.scrollY || window.pageYOffset;
    }
    getStateScreen() {
      if (window.innerWidth >= (this.optionScreen.md || 768)) {
        if (this.optionScreen.xl && window.innerWidth < (this.optionScreen.xl || 1025)) {
          if (this.stateScreen !== "md")
            this.stateScreen = "md";
        } else {
          if (this.stateScreen !== "xl")
            this.stateScreen = "xl";
        }
      } else {
        if (this.stateScreen !== "sm")
          this.stateScreen = "sm";
      }
    }
    getOffsetTop(ele) {
      return ele.getBoundingClientRect().top + this.getScrollTop();
    }
  }
  class animationView extends utility {
    constructor(option) {
      super();
      this.delay = option.delay || 200;
      this.spaceSync = option.spaceSync || 0;
      this.duration = option.duration || 1;
      this.classView = option.class || "inview";
      this.animateBy = option.animateBy || "css";
      this.areaView = __spreadValues({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }, option.optionView);
      this.mapView = /* @__PURE__ */ new Map();
      this.idSettimeout = null;
      this.storeSettimeout = [];
      this.timeTrigger = 0;
      this.countDelay = 0;
      this.elePosition = 0;
      this.inview = null;
      this.aniDelay = option.aniDelay || 0;
    }
    animateMethod(ele, delay) {
      let aniMethod = ele.dataset.method || this.animateBy;
      switch (aniMethod) {
        case "css": {
          this.animateElePerDelay(this.animateByCss, delay, ele);
          break;
        }
        case "js": {
          this.animateElePerDelay(this.animateByJs, delay, ele);
          break;
        }
        default: {
          throw Error("not animate method you defined please set again");
        }
      }
    }
    // animateElePerDelay(
    //   callback: Function,
    //   delay: number,
    //   ...arg: [HTMLElement, ...any]
    // ) {
    //   this.idSettimeout = window.setTimeout(() => {
    //     this.timeTrigger = new Date().getTime();
    //     callback.apply(this, arg);
    //   }, delay);
    //   this.storeSettimeout.push(this.idSettimeout);
    // }
    animateElePerDelay(callback, delay, ele) {
      this.idSettimeout = window.setTimeout(() => {
        this.timeTrigger = (/* @__PURE__ */ new Date()).getTime();
        this.unsetObserver(ele, callback);
      }, delay);
      this.storeSettimeout.push(this.idSettimeout);
    }
    unsetObserver(ele, callback) {
      var _a;
      (_a = this.inview) == null ? void 0 : _a.unobserve(ele);
      this.mapView.delete(ele.dataset.map);
      let nameAni;
      let nameFn = ele.dataset.fn;
      if (ele.dataset.ani) {
        nameAni = ele.dataset.ani;
      } else {
        if (!nameFn) {
          nameAni = "fadeUp";
        }
      }
      if (this.aniDelay) {
        setTimeout(() => {
          callback.apply(this, [ele, nameAni, nameFn]);
        }, this.aniDelay);
      } else {
        callback.apply(this, [ele, nameAni, nameFn]);
      }
    }
    animateByCss(ele, nameAni, nameFn) {
      if (nameAni) {
        ele.addEventListener("animationend", () => {
          ele.classList.remove(nameAni);
        });
        ele.addEventListener("webkitAnimationEnd", () => {
          ele.classList.remove(nameAni);
        });
        ele.classList.add(nameAni);
        this.animateFn(ele, nameFn);
      } else {
        this.animateFn(ele, nameFn);
      }
      ele.classList.remove(this.classView);
    }
    animateFn(ele, nameFn) {
      if (nameFn) {
        if (styleAnimation[nameFn]) {
          if (typeof styleAnimation[nameFn] === "function") {
            styleAnimation[nameFn](ele);
          } else {
            throw Error(
              nameFn + "required is function but found is not function"
            );
          }
        } else {
          throw Error(
            "not found property " + nameFn + " in object styleAnimation please extends it before when call fn animation name " + nameFn
          );
        }
      }
    }
    animateByJs(ele, nameAni, nameFn) {
      if (nameAni) {
        if (styleAnimation[nameAni]) {
          this.styleAniJs(ele, nameAni, nameFn);
        } else {
          throw Error(
            "not found property " + ele.dataset.ani + " in object styleAnimation please extends it before when set animation name " + ele.dataset.ani
          );
        }
      } else {
        this.animateFn(ele, nameFn);
        ele.classList.remove(this.classView);
      }
    }
    styleAniJs(ele, nameAni, nameFn) {
      let _a = styleAnimation[nameAni], { library } = _a, restOption = __objRest(_a, ["library"]);
      if (library) {
        let methodName = `style${library.charAt(0).toUpperCase() + library.slice(1)}`;
        if (this[methodName]) {
          let option = Array.from(Object.keys(restOption), (attr) => {
            return [
              attr,
              ele.dataset[attr] ? parseFloat(ele.dataset[attr]) : styleAnimation[nameAni][attr]
            ];
          });
          ele.style.transition = "none";
          this.animateFn(ele, nameFn);
          this[methodName](ele, Object.fromEntries(option), this.classView);
        } else {
          throw Error(`method ${methodName} not defined please set method animation before use it ex: myClass.setMethoAnimateJS(type, callbackMehod)`);
        }
      } else {
        ele.style.transition = "none";
        styleAnimation[nameAni](ele, this.classView);
      }
    }
    styleGsap(ele, option) {
      gsap.from(ele, __spreadProps(__spreadValues({}, option), {
        duration: this.duration,
        force3D: true,
        ease: ele.dataset.ease || "ease",
        onStart: () => {
          ele.classList.remove(this.classView);
        },
        onComplete: () => {
          ele.style.transform = "";
          ele.style.transition = "";
          ele.style.opacity = "";
        }
      }));
    }
    setStyleAniJs(library, methodFn) {
      let methodName = `style${library.charAt(0).toUpperCase() + library.slice(1)}`;
      this[methodName] = methodFn;
    }
    clearRuned(ele) {
      ele.classList.remove(this.classView);
      this.mapView.delete(ele.dataset.map);
      let clearAni = [ele.dataset.ani, ele.dataset.fn].filter(
        (name) => !!name
      );
      if (clearAni.length) {
        clearAni.forEach((nameAni) => {
          if (typeof styleAnimation[nameAni] == "function") {
            styleAnimation[nameAni](ele, "clear");
          }
        });
      }
    }
    clearAniWait() {
      if (this.storeSettimeout.length) {
        this.storeSettimeout.forEach((id) => {
          clearTimeout(id);
        });
        this.storeSettimeout = [];
      }
    }
    getOffsetTime() {
      let timerun = (/* @__PURE__ */ new Date()).getTime();
      let timeOffset = 0;
      if (timerun - this.timeTrigger < this.delay) {
        timeOffset = this.delay - (timerun - this.timeTrigger);
      }
      return timeOffset;
    }
  }
  class scrollView extends animationView {
    constructor(option) {
      super(option);
      this.timer = null;
    }
    setmapView() {
      let groupEles = [].slice.call(document.querySelectorAll("." + this.classView)).sort((a, b) => {
        return this.getOffsetTop(a) - this.getOffsetTop(b);
      });
      groupEles.forEach((ele) => {
        this.mapView.set(ele.dataset.map, ele);
      });
    }
    animate(ele, timeoffset) {
      if (this.elePosition) {
        if (this.elePosition + this.spaceSync < this.getOffsetTop(ele)) {
          this.countDelay++;
        } else {
          if (ele.classList.contains("delay")) {
            this.countDelay++;
          }
        }
      }
      this.elePosition = this.getOffsetTop(ele);
      this.animateMethod(ele, this.delay * this.countDelay + timeoffset);
    }
    checkInView() {
      this.countDelay = 0;
      this.elePosition = 0;
      this.clearAniWait();
      this.mapView.forEach((ele) => {
        let eleInfo = ele.getBoundingClientRect();
        if (eleInfo.bottom > this.areaView.top) {
          if (eleInfo.top < window.innerHeight - this.areaView.bottom) {
            this.animate(ele, this.getOffsetTime());
          }
        } else {
          this.clearRuned(ele);
        }
      });
    }
    dispatchScroll() {
      window.addEventListener("scroll", () => {
        if (this.timer) {
          clearInterval(this.timer);
        }
        this.timer = window.setTimeout(() => this.checkInView(), 40);
      });
    }
    dispatchResize() {
      window.addEventListener("resize", () => {
        if (this.timer) {
          clearInterval(this.timer);
        }
        this.timer = window.setTimeout(() => {
          let sortEles = Array.from(this.mapView, ([key, value]) => ({
            name: key,
            ele: value
          })).sort((a, b) => {
            return this.getOffsetTop(a.ele) - this.getOffsetTop(b.ele);
          });
          this.mapView.clear();
          sortEles.forEach(({ name, ele }) => {
            this.mapView.set(name, ele);
          });
          this.checkInView();
        }, 200);
      });
    }
    init() {
      this.setmapView();
      this.checkInView();
      this.dispatchScroll();
      this.dispatchResize();
    }
  }
  class intersection extends animationView {
    constructor(option) {
      super(option);
      this.timeObserver = 0;
    }
    animate(ele, offsetTop, timestep, timeoffset) {
      if (this.timeObserver) {
        if (this.timeObserver === timestep) {
          if (Math.abs(this.elePosition - offsetTop) > this.spaceSync) {
            this.countDelay++;
          } else {
            if (ele.classList.contains("delay")) {
              this.countDelay++;
            }
          }
        } else {
          this.countDelay++;
        }
      }
      this.timeObserver = timestep;
      this.elePosition = offsetTop;
      this.animateMethod(ele, this.delay * this.countDelay + timeoffset);
    }
    setObserverEle() {
      this.inview = new IntersectionObserver((e) => this.handleObserve(e), {
        rootMargin: `${this.areaView.top}px ${this.areaView.right}px ${this.areaView.bottom}px ${this.areaView.left}px`
      });
      document.querySelectorAll("." + this.classView).forEach((ele) => {
        if (this.inview) {
          this.inview.observe(ele);
        }
      });
    }
    handleObserve(eleObserve) {
      this.countDelay = 0;
      this.timeObserver = 0;
      this.clearAniWait();
      let eleSort = eleObserve.sort((a, b) => {
        return a.boundingClientRect.top - b.boundingClientRect.top;
      });
      eleSort.forEach((ele) => {
        this.mapView.set(
          ele.target.dataset.map,
          ele
        );
      });
      this.mapView.forEach(
        ({ boundingClientRect, isIntersecting, target, time }) => {
          var _a;
          if (boundingClientRect.bottom >= 0) {
            if (isIntersecting) {
              this.animate(
                target,
                boundingClientRect.top,
                time,
                this.getOffsetTime()
              );
            }
          } else {
            (_a = this.inview) == null ? void 0 : _a.unobserve(target);
            this.clearRuned(target);
          }
        }
      );
    }
    init() {
      this.setObserverEle();
    }
  }
  class inview {
    constructor(observer = {}) {
      this.observer = observer.method || "intersection";
      this.class = observer.class || "inview";
      this.option = __spreadValues({ class: this.class }, observer);
      this.tool = (() => {
        document.querySelectorAll("." + this.class).forEach((ele, index) => {
          ele.dataset.map = index.toString();
        });
        this.setObserverTool();
        let _a = this.option, option = __objRest(_a, ["method"]);
        if (this.observer === "intersection") {
          return new intersection(option);
        } else {
          return new scrollView(option);
        }
      })();
    }
    setObserverTool() {
      if (this.observer !== "scroll") {
        if (!("IntersectionObserver" in window) || !("IntersectionObserverEntry" in window) || !("intersectionRatio" in window.IntersectionObserverEntry.prototype)) {
          this.observer = "scroll";
        }
      }
    }
    setMethodAnimateJs(type, callback) {
      this.tool.setStyleAniJs(type, callback);
    }
    init() {
      this.tool.init();
    }
  }

  exports.observer = inview;
  exports.style = styleAnimation;

  return exports;

})({});
