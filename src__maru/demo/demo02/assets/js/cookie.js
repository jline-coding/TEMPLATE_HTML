! function () {
    var e = {
            get: function (e) {
                for (var t = document.cookie.split(";"), n = 0, r = t.length; n < r; n += 1) {
                    var i = t[n].replace(/\s/g, "").split("=");
                    if (i[0] === e) return decodeURIComponent(i[1])
                }
                return null
            },
            set: function (e, t, n, r, i, o) {
                var a = document,
                    c = new Date;
                n && (n *= 864e5);
                var l = new Date(c.getTime() + n);
                a.cookie = e + "=" + encodeURIComponent(t) + (n ? ";expires=" + l.toUTCString() : "") + (r ? ";path=" + r : "") + (i ? ";domain=" + i : "") + (o ? ";secure" : "")
            },
            del: function (e, t, n) {
                var r = document;
                this.get(e) && (r.cookie = e + "=" + (t ? ";path=" + t : "") + (n ? ";domain=" + n : "") + ";expires=Thu, 01-Jan-1970 00:00:01 GMT")
            }
        },
        t = document.querySelector("body"),
        n = document.querySelector('div[data-gdpr="wrap"]'),
        r = document.querySelector('a[data-gdpr="button"]'),
        i = "dinc_cookieAccepted",
        o = "gdpr",
        a = function () {
            return Array.prototype.slice.call(t.classList)
        };
    if (e.get(i)) n.style.display = "none";
    else {
        var c = a();
        c.push(o), t.className = c.join(" "), r.addEventListener("click", function () {
            var r = a();
            t.className = r.filter(function (e) {
                return e !== o
            }).join(" "), e.set(i, "true", 365, "/"), n.style.display = "none"
        }), n.style.display = "block"
    }
}();