const faq = document.querySelectorAll(".faq_question");
if (faq.length) {
    faq.forEach((ele) => {
        let target = ele.nextElementSibling;
        let child = target.querySelector(".faq_answer_contain");
        ele.addEventListener("click", function () {
            if (!ele.classList.contains("active")) {
                ele.classList.add("active");
                gsap.set(target, { display: "block" });
                gsap.fromTo(target, { height: 0 }, {
                    height: child.clientHeight, duration: 0.5, onComplete: () => {
                        gsap.set(target, { height: "" });
                    }
                });
            } else {
                ele.classList.remove("active");
                gsap.to(target, 0.5, {
                    height: 0, onComplete: () => {
                        gsap.set(target, { display: "", height: "" });
                    }
                });
            }

        })
    })
}

const anchor = document.querySelectorAll("a[href^='#'");
if (anchor.length) {
    anchor.forEach(ele => {
        let target = document.querySelector(ele.hash);
        ele.addEventListener("click", (e) => {
            e.preventDefault();
            if (document.querySelector(".c_header_btn").classList.contains("active")) {
                document.querySelector(".c_header_btn").click();
            }
            let scroll = {
                y: window.scrollY,
            }
            let offset = target.getBoundingClientRect().top + window.scrollY - document.querySelector(".c_header").clientHeight - 20;
            gsap.to(scroll, {
                y: offset, duration: 1, onUpdate: () => {
                    window.scrollTo({
                        top: scroll.y,
                    });
                }
            })
        })
    })
}

const toTop = document.querySelector(".c_totop_btn");
const contactOther = document.querySelector(".c_btn_contact");
if(toTop) {
    toTop.addEventListener("click", function(e) {
        e.preventDefault();
        let scroll = {
            y: window.scrollY,
        }
        gsap.to(scroll, {
            y: 0, duration: 1, onUpdate: () => {
                window.scrollTo({
                    top: scroll.y,
                });
            }
        })
    });
    let trackScroll = window.scrollY;
    let currentScroll = window.scrollY;
    let offsetAppear = 40;
    let limitScroll = [window.innerHeight, document.body.clientHeight - window.innerHeight - document.querySelector(".c_footer").clientHeight];
    let scrollDown = true;
    window.addEventListener("scroll", function() {
        if(this.window.scrollY > trackScroll) {
            scrollDown = true;
        }else {
            scrollDown = false;
        }
        if(this.window.scrollY > limitScroll[0] && this.window.scrollY < limitScroll[1]) {
            if(Math.abs(this.window.scrollY - currentScroll) >= offsetAppear) {
                if(scrollDown) {
                    toTop.classList.remove("show");
                }else {
                    toTop.classList.add("show");
                }
            }
            
        } else {
            if(this.window.scrollY <= limitScroll[0]) {
                toTop.classList.remove("show");
            }
            if(this.window.scrollY >= limitScroll[1]) {
                toTop.classList.add("show");
            }
        }
        if(Math.abs(this.window.scrollY - currentScroll) >= offsetAppear) {
            currentScroll = this.window.scrollY;
        }
        trackScroll = this.window.scrollY;
        if(this.window.scrollY > this.window.innerHeight) {
            contactOther.classList.add("is_show");
        }else {
            contactOther.classList.remove("is_show");
        }
    });
    window.addEventListener("resize", function() {
        limitScroll = [window.innerHeight, document.body.clientHeight - window.innerHeight ];
    })

}

const movement = new inview.observer({
    // method: "scroll",
    // animateBy: "js"
    optionView: { bottom: -50 }
});



window.addEventListener('load', function () {
    if (document.documentElement.classList.contains('is_loadding')) {
        document.documentElement.classList.remove('is_loadding');
        setTimeout(function () {
            movement.init();
        }, 300);
    } else {
        movement.init();
    }
});

if (window.location.hash) {
    let target = document.querySelector(window.location.hash).querySelector(".c_heading");
    if (target) {
        let scroll = {
            y: window.scrollY,
        }
        let offset = target.getBoundingClientRect().top + window.scrollY - document.querySelector(".c_header").clientHeight - 20;
        gsap.to(scroll, {
            y: offset, duration: 1, onUpdate: () => {
                window.scrollTo({
                    top: scroll.y,
                });
            }
        })
    }
}

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









