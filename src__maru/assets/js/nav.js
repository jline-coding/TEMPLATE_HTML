class nav {
    constructor(option = {}) {
        this.mediaQuery = Object.entries(
            option.mediaQuery || {
                sm: "(max-width: 767.99999px)",
                md: "(min-width: 768px)",
            }
        );
        this.cache = {};
        this.mediaQuery.forEach(([key]) => {
            this.cache[key] = new Map();
        });
        this.screen = this.getScreen();
        this.scrollH = 0;
    }

    disableScroll(type = "default") {
        if (type !== "body") {
            this.$addCss(document.documentElement, { overflow: "hidden" });
        } else {
            this.$addCss(document.body, { position: "fixed", left: 0, width: "100%", top: -this.scrollH });
        }
    }
    unableScroll(type = "default") {
        if (type !== "body") {
            this.$addCss(document.documentElement, { overflow: "" });
        } else {
            this.$addCss(document.body, { position: "", left: "", width: "", top: "" });
            window.scrollTo(0, this.scrollH);
        }
    }

    getScreen() {
        for (let i = 0; i < this.mediaQuery.length; i++) {
            let media = window.matchMedia(this.mediaQuery[i][1]);
            if (media.matches) {
                return this.mediaQuery[i][0];
            }
        }
    }

    setCache(keyEle, keyAttr, data, screen) {
        let obj = this.cache[screen].get(keyEle) || {};
        switch (keyAttr) {
            case "events":
                if (obj.events) {
                    obj.events.push(data);
                } else {
                    obj.events = [data];
                }
                break;
            case "style":
                if (obj.style) {
                    obj.style = { ...obj.style, ...data };
                } else {
                    obj.style = data;
                }
                break;
            case "styleActive":
                if (obj.styleActive) {
                    Object.entries(data).forEach(([i, v]) => {
                        if (!(obj.styleActive[i] || obj.styleActive[i] === 0)) {
                            obj.styleActive[i] = v;
                        }
                    });
                } else {
                    obj.styleActive = data;
                }
                // console.log(obj.styleActive);
                // if (obj.styleActive) {
                //   obj.styleActive = { ...obj.styleActive, ...data };
                // } else {
                //   obj.styleActive = data;
                // }
                // console.log(obj.styleActive);
                break;
            case "class":
                if (obj.class) {
                    data.forEach((className) => {
                        if (!obj.class.some((str) => str === className)) {
                            obj.class.push(className);
                        }
                    });
                } else {
                    obj.class = data;
                }
                break;
            case "classActive":
                if (obj.classActive) {
                    data.forEach((className) => {
                        if (!obj.classActive.some((str) => str === className)) {
                            obj.classActive.push(className);
                        }
                    });
                } else {
                    obj.classActive = data;
                }
                break;
            case "active":
                if (obj.active) {
                    obj.active = false;
                } else {
                    obj.active = true;
                }
                break;
            default:
                throw Error(`${keyAttr} not founded`);
        }
        this.cache[screen].set(keyEle, obj);
    }

    setActive(ele, screen) {
        this.setCache(ele, "active", null, screen);
    }

    setClass(ele, keyClass, className, screen) {
        if (ele.length) {
            ele.forEach((el) => {
                this.setCache(el, keyClass, className, screen);
            });
        }
        this.setCache(ele, keyClass, className, screen);
    }

    $class(screen, ele, className) {
        this.setClass(ele, "class", className.split(" "), screen);
    }

    $addClass(ele, className, screen = this.screen) {
        let classList = className.split(" ");
        this.setClass(ele, "classActive", classList, screen);
        if (ele.length) {
            ele.forEach((el) => {
                el.classList.add(...classList);
            });
        } else {
            ele.classList.add(...classList);
        }
    }

    $removeClass(ele, className) {
        let classList = className.split(" ");
        if (ele.length) {
            ele.forEach((el) => {
                el.classList.remove(...classList);
            });
        } else {
            ele.classList.remove(...classList);
        }
    }

    cleanClass(ele, classList) {
        ele.classList.remove(...classList);
    }

    addStyle(eles, attrStyle, keyAttr, screen) {
        if (eles.length) {
            eles.forEach((ele) => {
                this.setCache(ele, keyAttr, attrStyle, screen);
            });
        } else {
            this.setCache(eles, keyAttr, attrStyle, screen);
        }
    }

    $css(screen, data, cssProperty) {
        if (Array.isArray(data)) {
            data.forEach(({ ele, css }) => {
                this.addStyle(ele, css, "style", screen);
            });
        } else {
            this.addStyle(data, cssProperty, "style", screen);
        }
    }

    $addCss(ele, cssProperty, screen = this.screen) {
        this.addStyle(ele, cssProperty, "styleActive", screen);
        gsap.set(ele, { ...cssProperty });
    }

    $(selectName, scopeEle = false) {
        return (scopeEle || document.body).querySelectorAll(selectName);
    }

    $one(selectName) {
        return document.querySelector(selectName);
    }

    $aniTo(ele, properties, optionGsap, screen = this.screen) {
        this.addStyle(ele, properties, "styleActive", screen);
        gsap.to(ele, { ...properties, ...optionGsap });
    }

    cleanStyle(ele, style) {
        let properties = {};
        Object.entries(style).forEach(([key, val]) => {
            switch (key) {
                case "autoAlpha":
                    properties["opacity"] = "";
                    properties["visibility"] = "";
                    break;
                // case "xPercent" | "yPercent" | "x" | "y":
                //   properties["transform"] = "";
                //   break;
                default:
                    properties[key] = "";
            }
        });
        gsap.set(ele, properties);
    }

    addEvent(screen, ele, nameEvent, fnEvent, actScroll, classActive) {
        this.setCache(
            ele,
            "events",
            {
                name: nameEvent,
                fn: () => {
                    let target = this.cache[screen].get(ele);
                    fnEvent(ele, target);
                    if (target.active) {
                        this.$removeClass(ele, classActive);
                    } else {
                        this.$addClass(ele, classActive);
                    }
                    if (actScroll) {
                        if (target.active) {
                            this.unableScroll(actScroll);
                        } else {
                            this.scrollH = window.scrollY;
                            this.disableScroll(actScroll)
                        }
                    }
                    this.setActive(ele, screen);
                },
            },
            screen
        );
    }

    $on(screen, eles, nameEvent, fnEvent, actScroll = false, actionClass = "active") {
        if (eles.length) {
            eles.forEach((ele) => {
                this.addEvent(screen, ele, nameEvent, fnEvent, actScroll, actionClass);
            });
        } else {
            this.addEvent(screen, eles, nameEvent, fnEvent, actScroll, actionClass);
        }
    }

    attachEvents(ele, events) {
        events.forEach(({ name, fn }) => {
            ele.addEventListener(name, fn);
        });
    }
    cleanEvent(ele, events) {
        events.forEach(({ name, fn }) => {
            ele.removeEventListener(name, fn);
        });
    }

    onMount() {
        if (this.cache[this.screen].size) {
            this.cache[this.screen].forEach((data, ele) => {
                if (data.events) {
                    this.attachEvents(ele, data.events);
                }
                if (data.style) {
                    gsap.set(ele, { ...data.style });
                }
                if (data.class) {
                    ele.classList.add(...data.class);
                }
            });
        }
    }
    cleanDom(screen) {
        if (this.cache[screen].size) {
            this.cache[screen].forEach((data, ele) => {
                if (data.events) {
                    this.cleanEvent(ele, data.events);
                }
                if (data.style) {
                    this.cleanStyle(ele, data.style);
                }
                if (data.styleActive) {
                    this.cleanStyle(ele, data.styleActive);
                }
                if (data.class) {
                    this.cleanClass(ele, data.class);
                }
                if (data.classActive) {
                    this.cleanClass(ele, data.classActive);
                }
                if (data.active) {
                    this.setActive(ele, screen);
                }
            });
        }
    }
    resize() {
        window.addEventListener("resize", () => {
            if (this.getScreen() !== this.screen) {
                this.cleanDom(this.screen);
                this.screen = this.getScreen();
                this.onMount();
            }
        });
    }

    init() {
        this.onMount();
        this.resize();
    }
}

const menu = new nav({
    mediaQuery: {
        sm: "(max-width: 767.98px)",
        md: "(min-width: 768px) and (max-width: 1299.98px)",
        xl: "(min-width: 1300px)",
    },
});

menu.$css("md", [
    {
        ele: menu.$one('.c_header_nav'),
        css: { x: 400, autoAlpha: 1, display: "block" }
    }
]);

menu.$css("sm", [
    {
        ele: menu.$one('.c_header_nav'),
        css: { autoAlpha: 0, y: 40, display: "block" },
    },
]);

menu.$on("md", menu.$one(".c_header_btn"), "click", (e, b) => {
    if (b.active) {
        menu.$removeClass(menu.$one(".c_header"), "active", "md");
        menu.$aniTo(
            menu.$one(".c_header_nav"),
            { x: 400 },
            { overwrite: true }
        );
    } else {
        menu.$addClass(menu.$one(".c_header"), "active", "md");
        menu.$aniTo(
            menu.$one(".c_header_nav"),
            { x: 0 },
            { overwrite: true }
        );
    }
}, "body");

menu.$on("sm", menu.$one(".c_header_btn"), "click", (e, b) => {
    if (b.active) {
        menu.$aniTo(
            menu.$one(".c_header_nav"),
            { autoAlpha: 0, y: 40 },
            { overwrite: true }
        );
    } else {
        menu.$aniTo(
            menu.$one(".c_header_nav"),
            { autoAlpha: 1, y: 0 },
            { overwrite: true }
        );
    }
}, "body");

menu.init();