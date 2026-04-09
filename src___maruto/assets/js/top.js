const gear = document.querySelectorAll(".js_gear");
gear.forEach(ele => {
    let rotate = {
        z: 0
    };
    gsap.to(rotate, {
        z: 360, repeat: -1, ease: "linear", duration: Math.max(Math.random() * 5, 3), onUpdate: () => {
            Object.assign(ele.style, { rotate: rotate.z + "deg" });
        }
    });
});
gsap.to(".js_wave01", 1.5, { x: -44, repeat: -1, ease: "linear" })
gsap.to(".js_wave02", 1.5, { x: 44, repeat: -1, ease: "linear" })
gsap.to(".js_bar01", 2, { x: 68, repeat: -1, yoyo: "ease" });
gsap.to(".js_bar03", 2, { x: -68, repeat: -1, yoyo: "ease" });
gsap.to(".js_bar02", {
    keyframes: [
        { x: 28, duration: 0.8 },
        { x: -40, duration: 2 },
        { x: 0, duration: 1.2 },
    ],
    repeat: -1
});
gsap.to(".js_sign01", 1, { x: 20, repeat: -1, yoyo: "ease" });
gsap.to(".js_sign02", 1, { y: 20, repeat: -1, yoyo: "ease" });
gsap.to(".mv_ttl_head__line01", 2, { x: -10, repeat: -1, yoyo: "ease" });
gsap.to(".mv_ttl_head__line_desc", 2, { x: -20, repeat: -1, yoyo: "ease" });

inview.style.odometer = (ele) => {
    let od = new Odometer({
        el: ele.querySelector('.mv_ttl_price__txt01'),
        value: 0,
        format: '(,ddd)',
        duration: 5000,
    });
    od.update(5000)
}

const voice = document.querySelector(".voice_slider");

if(voice) {
    let splide1 = new Splide(voice, {
        type: "loop",
        focus: "center",
        speed: 1200,
        interval: 7000,
        autoWidth: true,
        resetProgress: false,
        pauseOnFocus: false,
        pauseOnHover: false,
        arrows: true,
        autoplay: true,
        pagination: true,
    });
    splide1.mount();
}

localStorage.setItem("marutto-jline", Date.now());

// window.addEventListener("load", () => {
//     const iframe = document.querySelector("iframe");
//     iframe.setAttribute("src", './contact/');
//     if (iframe) {
//         let iframeSrc = iframe.src;
//         iframe.addEventListener("load", function () {
//             if (this.contentWindow.location.href !== iframeSrc) {
//                 window.location.href = window.location.href + "thanks.html";
//             }
//         })
//     }
// });

//Iframe 
// const iframe = document.querySelector("#contact2 iframe");
// let iframeEleInside;
// function iframeContact() {
//     if(iframeEleInside) {
//         if(window.innerWidth < 768) {
//             iframeEleInside.classList.add("is_sp");
//         }else {
//             iframeEleInside.classList.remove("is_sp");
//         }
//         iframe.style.height = iframeEleInside.clientHeight + "px";
        
//     }
// }

// iframe.addEventListener("load", () => {
//     iframeEleInside = iframe.contentWindow.document.querySelector(".mv_form");
//     iframeContact();
// });

// window.addEventListener("resize", () => {
//     iframeContact()
// });