/* ==========================================================================
   OSİN KATMAN5
   Yalnızca herkese açık (public) kaynaklardan veri toplar.
   - Platform sekmesi: kullanıcı adından profil URL'si üretir ve açar
     (var/yok teyidi kullanıcı tarafından görsel olarak yapılır).
   - Alan adı / IP sekmeleri: herkese açık DNS, RDAP ve sertifika şeffaflığı
     (Certificate Transparency) servislerini sorgular.
   - EXIF sekmesi: seçilen fotoğrafı yalnızca cihaz üzerinde çözümler,
     hiçbir veri dışarı gönderilmez.
   - URL sekmesi: bağlantıyı yalnızca istemci tarafında ayrıştırır.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------- Gezinme (tabs) --------------------------- */

  function go(target) {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-target") === target); });
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.toggle("active", s.getAttribute("data-screen") === target); });
    document.querySelectorAll(".drawer__item").forEach(function (d) { d.classList.toggle("active", d.getAttribute("data-go") === target); });
    if (target === "gecmis") renderHistory();
  }

  function initNav() {
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () { go(tab.getAttribute("data-target")); });
    });
    var drawer = document.getElementById("drawer");
    var overlay = document.getElementById("overlay");
    function toggle(open) { drawer.classList.toggle("open", open); overlay.classList.toggle("open", open); }
    document.getElementById("menuBtn").addEventListener("click", function () { toggle(true); });
    overlay.addEventListener("click", function () { toggle(false); });
    document.querySelectorAll(".drawer__item").forEach(function (d) {
      d.addEventListener("click", function () { go(d.getAttribute("data-go")); toggle(false); });
    });
    document.addEventListener("backbutton", function () {
      if (drawer.classList.contains("open")) toggle(false);
    });
    go("profil");
  }

  /* ------------------------------ Ağ durumu ------------------------------ */

  function initNetStatus() {
    var dot = document.getElementById("netDot");
    var label = document.getElementById("netLabel");
    function update() {
      var online = navigator.onLine !== false;
      dot.className = "dot " + (online ? "online" : "offline");
      label.textContent = online ? "çevrimiçi" : "çevrimdışı";
    }
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
  }

  /* ----------------------- Yardımcılar (render/fetch) --------------------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderKV(container, pairs) {
    pairs.forEach(function (p) {
      var row = el("div", "kv");
      row.appendChild(el("span", null, p[0]));
      row.appendChild(el("strong", null, p[1] === undefined || p[1] === null || p[1] === "" ? "—" : String(p[1])));
      container.appendChild(row);
    });
  }

  function block(container, title) {
    var b = el("div", "result-block");
    b.appendChild(el("div", "result-block__title", title));
    container.appendChild(b);
    return b;
  }

  function clear(container) { container.innerHTML = ""; }

  function showError(container, msg) {
    container.appendChild(el("div", "error-text", msg));
  }

  async function fetchJSON(url, opts) {
    var res = await fetch(url, opts || {});
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* --------------------------- Platform taraması -------------------------- */

  var PLATFORMS = [
    { key: "telegram", name: "Telegram", glyph: "TG", url: function (u) { return "https://t.me/" + u; } },
    { key: "instagram", name: "Instagram", glyph: "IG", url: function (u) { return "https://instagram.com/" + u; } },
    { key: "x", name: "X (Twitter)", glyph: "X", url: function (u) { return "https://x.com/" + u; } },
    { key: "tiktok", name: "TikTok", glyph: "TT", url: function (u) { return "https://www.tiktok.com/@" + u; } }
  ];

  function sanitizeUsername(raw) {
    return (raw || "").trim().replace(/^@/, "");
  }

  function openExternal(url) {
    if (window.cordova && navigator.app && window.open) {
      window.open(url, "_system");
    } else {
      window.open(url, "_blank");
    }
  }

  function openInApp(url) {
    window.open(url, window.cordova ? "_blank" : "_blank", "location=yes");
  }

  function copyText(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).catch(function () {});
  }

  /* Geçmiş (yalnızca cihazda) */
  function histGet() { try { return JSON.parse(localStorage.getItem("k5_hist") || "[]"); } catch (e) { return []; } }
  function histAdd(type, q, key) {
    var h = histGet().filter(function (x) { return !(x.type === type && x.q === q && x.key === key); });
    h.unshift({ type: type, q: q, key: key || "", t: Date.now() });
    try { localStorage.setItem("k5_hist", JSON.stringify(h.slice(0, 50))); } catch (e) {}
  }
  function renderHistory() {
    var box = document.getElementById("histList");
    clear(box);
    var h = histGet();
    if (!h.length) { box.appendChild(el("div", "muted", "Henüz kayıt yok.")); return; }
    h.forEach(function (x) {
      var b = el("button", "hist-item", x.q);
      b.appendChild(el("small", null, x.type + (x.key ? " · " + x.key : "") + " · " + new Date(x.t).toLocaleString("tr-TR")));
      b.addEventListener("click", function () {
        if (x.type === "Profil") {
          document.getElementById("unameInput").value = x.q;
          go("profil");
          var p = PLATFORMS.filter(function (pl) { return pl.key === x.key; })[0];
          if (p) lookupProfile(p, document.getElementById("unameInput"), document.getElementById("profilResults"));
        }
      });
      box.appendChild(b);
    });
  }

  /* Herkese açık sayfa ön izlemesini uygulama içinde oku (CORS'u aşmak için native http) */
  function httpGetText(url) {
    return new Promise(function (resolve, reject) {
      var hdr = { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", "Accept-Language": "en" };
      if (window.cordova && cordova.plugin && cordova.plugin.http) {
        cordova.plugin.http.setRequestTimeout(15);
        cordova.plugin.http.get(url, {}, hdr, function (r) { resolve({ status: r.status, text: r.data }); },
          function (err) { if (err && err.status) resolve({ status: err.status, text: err.error || "" }); else reject(new Error(err && err.error || "ağ hatası")); });
      } else {
        fetch(url).then(function (r) { return r.text().then(function (t) { resolve({ status: r.status, text: t }); }); }).catch(reject);
      }
    });
  }

  function parsePreview(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    function meta(n) {
      var m = doc.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]');
      return m ? (m.getAttribute("content") || "").trim() : "";
    }
    function txt(sel) { var n = doc.querySelector(sel); return n ? n.textContent.trim() : ""; }
    return {
      title: meta("og:title") || (doc.title || "").trim(),
      desc: meta("og:description") || meta("description"),
      image: meta("og:image"),
      tgName: txt(".tgme_page_title"),
      tgDesc: txt(".tgme_page_description"),
      tgExtra: txt(".tgme_page_extra")
    };
  }

  async function lookupProfile(p, input, results) {
    var uname = sanitizeUsername(input.value);
    clear(results);
    if (!uname) { showError(results, "Önce bir kullanıcı adı girin."); return; }
    if (!/^[A-Za-z0-9_.]{1,64}$/.test(uname)) { showError(results, "Geçersiz kullanıcı adı. Yalnızca harf, rakam, _ ve . kullanın."); return; }
    histAdd("Profil", uname, p.key);
    var target = p.url(uname);
    var b = block(results, p.name.toUpperCase());
    renderKV(b, [["Kullanıcı adı", uname], ["Bağlantı", target]]);
    var status = el("div", "muted", "Sayfa ön izlemesi okunuyor…");
    b.appendChild(status);
    try {
      var r = await httpGetText(target);
      var pv = parsePreview(r.text || "");
      status.remove();
      var found = null;
      if (p.key === "telegram") found = !!pv.tgName;
      else if (r.status === 404) found = false;
      if (found === false) {
        b.appendChild(el("div", "error-text", "Bu kullanıcı adıyla herkese açık bir profil bulunamadı."));
      } else {
        var card = el("div", "profile-card");
        if (pv.image && found !== null || (pv.image && p.key === "telegram")) {
          var img = el("img"); img.src = pv.image; img.alt = ""; card.appendChild(img);
        }
        var info = el("div");
        info.appendChild(el("strong", null, pv.tgName || pv.title || "—"));
        card.appendChild(info);
        b.appendChild(card);
        var rows = [["Durum", found ? "Profil bulundu" : "Önizleme alındı (varlık kesin değil)"]];
        var d = pv.tgDesc || pv.desc;
        if (d) rows.push(["Açıklama", d]);
        if (pv.tgExtra) rows.push(["Bilgi", pv.tgExtra]);
        renderKV(b, rows);
        if (found === null) b.appendChild(el("div", "muted", "Bu platform giriş duvarı kullanıyor; kesin sonuç için uygulama içi tarayıcıda açın."));
      }
    } catch (err) {
      status.remove();
      showError(b, "Önizleme alınamadı: " + err.message);
    }
    var row = el("div", "btn-row");
    var b1 = el("button", "btn", "Uygulama içinde aç");
    b1.addEventListener("click", function () { openInApp(target); });
    var b2 = el("button", "btn", "Tarayıcıda aç");
    b2.addEventListener("click", function () { openExternal(target); });
    var b3 = el("button", "btn", "Bağlantıyı kopyala");
    b3.addEventListener("click", function () { copyText(target); });
    [b1, b2, b3].forEach(function (x) { row.appendChild(x); });
    results.appendChild(row);
  }

  /* Dönüştürücü */
  function initConverter() {
    var input = document.getElementById("convInput");
    var out = document.getElementById("convResults");
    var enc = new TextEncoder(), dec = new TextDecoder();
    function toB64(s) { var bin = ""; enc.encode(s).forEach(function (c) { bin += String.fromCharCode(c); }); return btoa(bin); }
    function fromB64(s) { var bin = atob(s.trim()); var a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return dec.decode(a); }
    async function sha(s) {
      var buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
      return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    }
    document.querySelectorAll("[data-conv]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var v = input.value, k = btn.getAttribute("data-conv"), res;
        clear(out);
        if (!v) { showError(out, "Önce bir metin girin."); return; }
        try {
          if (k === "b64e") res = toB64(v);
          else if (k === "b64d") res = fromB64(v);
          else if (k === "urle") res = encodeURIComponent(v);
          else if (k === "urld") res = decodeURIComponent(v);
          else if (k === "hexe") res = Array.prototype.map.call(enc.encode(v), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
          else res = await sha(v);
        } catch (e) { showError(out, "Dönüştürülemedi: geçersiz girdi."); return; }
        var b = block(out, btn.textContent.toUpperCase());
        b.appendChild(el("div", "out-text", res));
        var c = el("button", "btn", "Kopyala");
        c.addEventListener("click", function () { copyText(res); });
        b.appendChild(c);
      });
    });
  }

  /* Notlar */
  function initNotes() {
    var area = document.getElementById("noteArea");
    var state = document.getElementById("noteState");
    try { area.value = localStorage.getItem("k5_note") || ""; } catch (e) {}
    area.addEventListener("input", function () {
      try { localStorage.setItem("k5_note", area.value); state.textContent = "Kaydedildi"; } catch (e) { state.textContent = "Kaydedilemedi"; }
    });
    document.getElementById("btnCopyNote").addEventListener("click", function () { copyText(area.value); state.textContent = "Kopyalandı"; });
    document.getElementById("btnClearNote").addEventListener("click", function () { area.value = ""; try { localStorage.removeItem("k5_note"); } catch (e) {} state.textContent = "Temizlendi"; });
  }

  function initHistoryUi() {
    document.getElementById("btnClearHist").addEventListener("click", function () {
      try { localStorage.removeItem("k5_hist"); } catch (e) {}
      renderHistory();
    });
  }

  function initPlatformGrid() {
    var grid = document.getElementById("platformGrid");
    var input = document.getElementById("unameInput");
    var results = document.getElementById("profilResults");

    PLATFORMS.forEach(function (p) {
      var btn = el("button", "platform-btn");
      var glyph = el("span", "platform-btn__glyph", p.glyph);
      var name = el("span", "platform-btn__name", p.name);
      var urlPreview = el("span", "platform-btn__url", p.url("kullanıcı"));
      btn.appendChild(glyph);
      btn.appendChild(name);
      btn.appendChild(urlPreview);
      btn.addEventListener("click", function () { lookupProfile(p, input, results); });
      grid.appendChild(btn);
    });
  }

  /* ------------------------------ Alan adı -------------------------------- */

  function initDomainTools() {
    var input = document.getElementById("domainInput");
    var results = document.getElementById("domainResults");

    function getDomain() {
      var v = (input.value || "").trim().toLowerCase();
      v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      return v;
    }

    document.getElementById("btnDns").addEventListener("click", async function () {
      var domain = getDomain();
      clear(results);
      if (!domain) { showError(results, "Önce bir alan adı girin."); return; }
      var b = block(results, "DNS KAYITLARI — " + domain.toUpperCase());
      b.appendChild(el("div", "muted", "Sorgulanıyor…"));
      var types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"];
      try {
        var out = [];
        for (var i = 0; i < types.length; i++) {
          var t = types[i];
          try {
            var data = await fetchJSON("https://dns.google/resolve?name=" + encodeURIComponent(domain) + "&type=" + t);
            if (data.Answer && data.Answer.length) {
              data.Answer.forEach(function (ans) {
                out.push([t, ans.data]);
              });
            }
          } catch (e) { /* bu tip için kayıt yok veya erişilemedi */ }
        }
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "DNS KAYITLARI — " + domain.toUpperCase()));
        if (!out.length) {
          b.appendChild(el("div", "muted", "Kayıt bulunamadı."));
        } else {
          renderKV(b, out);
        }
      } catch (err) {
        b.innerHTML = "";
        showError(b, "DNS sorgusu başarısız: " + err.message);
      }
    });

    document.getElementById("btnRdap").addEventListener("click", async function () {
      var domain = getDomain();
      clear(results);
      if (!domain) { showError(results, "Önce bir alan adı girin."); return; }
      var b = block(results, "KAYIT BİLGİSİ (RDAP) — " + domain.toUpperCase());
      b.appendChild(el("div", "muted", "Sorgulanıyor…"));
      try {
        var data = await fetchJSON("https://rdap.org/domain/" + encodeURIComponent(domain));
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "KAYIT BİLGİSİ (RDAP) — " + domain.toUpperCase()));
        var registrar = "—";
        if (data.entities) {
          var reg = data.entities.find(function (e2) { return (e2.roles || []).indexOf("registrar") !== -1; });
          if (reg && reg.vcardArray) {
            try { registrar = reg.vcardArray[1].find(function (f) { return f[0] === "fn"; })[3]; } catch (e3) {}
          }
        }
        var events = data.events || [];
        function findEvent(action) {
          var ev = events.find(function (e2) { return e2.eventAction === action; });
          return ev ? ev.eventDate : null;
        }
        renderKV(b, [
          ["Alan adı", data.ldhName || domain],
          ["Durum", (data.status || []).join(", ")],
          ["Kayıt eden (registrar)", registrar],
          ["Oluşturma", findEvent("registration")],
          ["Son güncelleme", findEvent("last changed")],
          ["Son kullanma", findEvent("expiration")]
        ]);
      } catch (err) {
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "KAYIT BİLGİSİ (RDAP) — " + domain.toUpperCase()));
        showError(b, "RDAP verisine ulaşılamadı (bazı uzantılar RDAP desteklemeyebilir).");
      }
    });

    document.getElementById("btnSubs").addEventListener("click", async function () {
      var domain = getDomain();
      clear(results);
      if (!domain) { showError(results, "Önce bir alan adı girin."); return; }
      var b = block(results, "ALT ALAN ADLARI (crt.sh) — " + domain.toUpperCase());
      b.appendChild(el("div", "muted", "Sertifika şeffaflığı günlükleri taranıyor…"));
      try {
        var data = await fetchJSON("https://crt.sh/?q=%25." + encodeURIComponent(domain) + "&output=json");
        var set = new Set();
        data.forEach(function (row) {
          (row.name_value || "").split("\n").forEach(function (n) {
            if (n && n.indexOf("*") === -1) set.add(n.toLowerCase());
          });
        });
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "ALT ALAN ADLARI (crt.sh) — " + domain.toUpperCase()));
        if (!set.size) {
          b.appendChild(el("div", "muted", "Sonuç bulunamadı."));
        } else {
          var list = Array.from(set).sort();
          var pre = el("div", "mono-block", list.slice(0, 200).join("\n"));
          b.appendChild(pre);
          b.appendChild(el("div", "muted", list.length + " benzersiz kayıt bulundu" + (list.length > 200 ? " (ilk 200 gösteriliyor)" : "") + "."));
        }
      } catch (err) {
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "ALT ALAN ADLARI (crt.sh) — " + domain.toUpperCase()));
        showError(b, "crt.sh şu an yanıt vermiyor. https://crt.sh/?q=%25." + domain + " adresinden manuel bakabilirsiniz.");
      }
    });
  }

  /* -------------------------------- IP bilgisi ----------------------------- */

  function initIpTool() {
    var input = document.getElementById("ipInput");
    var results = document.getElementById("ipResults");

    document.getElementById("btnIp").addEventListener("click", async function () {
      var ip = (input.value || "").trim();
      clear(results);
      if (!ip) { showError(results, "Önce bir IP adresi girin."); return; }
      var b = block(results, "IP BİLGİSİ — " + ip);
      b.appendChild(el("div", "muted", "Sorgulanıyor…"));
      try {
        var data = await fetchJSON("https://ipapi.co/" + encodeURIComponent(ip) + "/json/");
        if (data.error) throw new Error(data.reason || "geçersiz IP");
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "IP BİLGİSİ — " + ip));
        renderKV(b, [
          ["Şehir", data.city],
          ["Bölge", data.region],
          ["Ülke", data.country_name],
          ["Servis sağlayıcı (ISP)", data.org],
          ["ASN", data.asn],
          ["Saat dilimi", data.timezone]
        ]);
      } catch (err) {
        b.innerHTML = "";
        b.appendChild(el("div", "result-block__title", "IP BİLGİSİ — " + ip));
        showError(b, "Sorgu başarısız: " + err.message);
      }
    });
  }

  /* -------------------------------- URL analiz ----------------------------- */

  var SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rebrand.ly", "shorturl.at"];

  function initUrlTool() {
    var input = document.getElementById("urlInput");
    var results = document.getElementById("urlResults");

    document.getElementById("btnUrl").addEventListener("click", function () {
      var raw = (input.value || "").trim();
      clear(results);
      if (!raw) { showError(results, "Önce bir bağlantı girin."); return; }
      var u;
      try {
        u = new URL(raw.match(/^https?:\/\//i) ? raw : "http://" + raw);
      } catch (err) {
        showError(results, "Geçersiz bağlantı.");
        return;
      }
      var b = block(results, "YAPI");
      var isPunycode = u.hostname.indexOf("xn--") !== -1;
      var isShortener = SHORTENERS.indexOf(u.hostname.replace(/^www\./, "")) !== -1;
      renderKV(b, [
        ["Protokol", u.protocol.replace(":", "")],
        ["Ana makine (host)", u.hostname],
        ["Port", u.port || "varsayılan"],
        ["Yol", u.pathname || "/"],
        ["Bilinen kısaltma servisi", isShortener ? "evet" : "hayır"],
        ["Punycode / IDN", isPunycode ? "evet — gözle kontrol edin" : "hayır"]
      ]);
      var params = Array.from(u.searchParams.entries());
      if (params.length) {
        var b2 = block(results, "SORGU PARAMETRELERİ");
        renderKV(b2, params);
      }
    });
  }

  /* --------------------------------- EXIF ---------------------------------- */
  /* Basit bir JPEG/EXIF (APP1 - TIFF IFD) çözümleyici. Dosya hiçbir zaman
     cihaz dışına gönderilmez; tamamen bu fonksiyon içinde okunur. */

  var EXIF_TAGS = {
    0x010F: "Üretici (Make)",
    0x0110: "Model",
    0x0112: "Yönlendirme (Orientation)",
    0x0131: "Yazılım",
    0x0132: "Değiştirilme tarihi",
    0x9003: "Çekim tarihi",
    0x829A: "Pozlama süresi",
    0x829D: "F değeri (F-number)",
    0x8827: "ISO"
  };
  var GPS_TAGS = { 1: "GPSLatitudeRef", 2: "GPSLatitude", 3: "GPSLongitudeRef", 4: "GPSLongitude" };

  function readExif(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    if (view.getUint16(0) !== 0xFFD8) return null; // JPEG imzası yok
    var offset = 2;
    var exifOffset = null;
    while (offset < view.byteLength - 1) {
      if (view.getUint8(offset) !== 0xFF) break;
      var marker = view.getUint8(offset + 1);
      if (marker === 0xE1) {
        var size = view.getUint16(offset + 2);
        var start = offset + 4;
        if (view.getUint32(start) === 0x45786966) { // "Exif"
          exifOffset = start + 6;
          break;
        }
        offset += 2 + size;
      } else if (marker === 0xD8 || marker === 0xD9) {
        offset += 2;
      } else {
        var segSize = view.getUint16(offset + 2);
        offset += 2 + segSize;
      }
    }
    if (exifOffset === null) return null;

    var little = view.getUint16(exifOffset) === 0x4949;
    function u16(o) { return view.getUint16(o, little); }
    function u32(o) { return view.getUint32(o, little); }

    var firstIFDOffset = u32(exifOffset + 4);
    var tags = {};
    var gps = {};

    function readIFD(ifdOffset, tagMap, targetObj) {
      var entries = u16(exifOffset + ifdOffset);
      for (var i = 0; i < entries; i++) {
        var entryOffset = exifOffset + ifdOffset + 2 + i * 12;
        var tag = u16(entryOffset);
        var type = u16(entryOffset + 2);
        var count = u32(entryOffset + 4);
        var valueOffset = entryOffset + 8;
        var name = tagMap[tag];
        if (!name) continue;
        var value = null;
        try {
          if (type === 2) { // ASCII
            var strOffset = count > 4 ? exifOffset + u32(valueOffset) : valueOffset;
            var bytes = [];
            for (var c = 0; c < count - 1; c++) bytes.push(view.getUint8(strOffset + c));
            value = String.fromCharCode.apply(null, bytes);
          } else if (type === 3) { // SHORT
            value = u16(valueOffset);
          } else if (type === 4) { // LONG
            value = u32(valueOffset);
          } else if (type === 5) { // RATIONAL
            var ratOffset = exifOffset + u32(valueOffset);
            if (count > 1) {
              value = [];
              for (var r = 0; r < count; r++) {
                var n1 = u32(ratOffset + r * 8), d1 = u32(ratOffset + r * 8 + 4);
                value.push(d1 ? n1 / d1 : 0);
              }
            } else {
              var num = u32(ratOffset), den = u32(ratOffset + 4);
              value = den ? (num / den).toFixed(4) : num;
            }
          }
        } catch (e) { value = null; }
        if (value !== null) targetObj[name] = value;
      }
      // sonraki IFD'ye bağlantı (ExifIFD) varsa onu da oku
      var exifIfdEntry = null;
      for (var j = 0; j < entries; j++) {
        var eo = exifOffset + ifdOffset + 2 + j * 12;
        if (u16(eo) === 0x8769) { exifIfdEntry = u32(eo + 8); }
        if (u16(eo) === 0x8825) { // GPS IFD pointer
          try { readIFD(u32(eo + 8), GPS_TAGS, gps); } catch (e) {}
        }
      }
      if (exifIfdEntry !== null) {
        try { readIFD(exifIfdEntry, EXIF_TAGS, targetObj); } catch (e) {}
      }
    }

    readIFD(firstIFDOffset, EXIF_TAGS, tags);

    // GPS: derece/dakika/saniye -> ondalık koordinat
    var coords = null;
    function dms(a, ref) {
      if (!Array.isArray(a) || a.length < 3) return null;
      var d = a[0] + a[1] / 60 + a[2] / 3600;
      return (ref === "S" || ref === "W") ? -d : d;
    }
    var lat = dms(gps.GPSLatitude, gps.GPSLatitudeRef);
    var lon = dms(gps.GPSLongitude, gps.GPSLongitudeRef);
    if (lat !== null && lon !== null && isFinite(lat) && isFinite(lon)) {
      coords = { lat: lat, lon: lon };
      gps.GPSLatitude = lat.toFixed(6);
      gps.GPSLongitude = lon.toFixed(6);
    }
    return { tags: tags, gps: gps, coords: coords };
  }

  function initExifTool() {
    var fileInput = document.getElementById("exifFile");
    var results = document.getElementById("exifResults");

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      clear(results);
      if (!file) return;
      var b = block(results, "DOSYA");
      renderKV(b, [["Ad", file.name], ["Boyut", (file.size / 1024).toFixed(1) + " KB"], ["Tür", file.type]]);

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var parsed = readExif(e.target.result);
          if (!parsed || (!Object.keys(parsed.tags).length && !Object.keys(parsed.gps).length)) {
            var b2 = block(results, "EXIF");
            b2.appendChild(el("div", "muted", "Bu dosyada okunabilir EXIF verisi bulunamadı (sosyal medya ve mesajlaşma uygulamaları genelde bu veriyi siler)."));
            return;
          }
          if (Object.keys(parsed.tags).length) {
            var b3 = block(results, "EXIF ETİKETLERİ");
            renderKV(b3, Object.keys(parsed.tags).map(function (k) { return [k, parsed.tags[k]]; }));
          }
          if (Object.keys(parsed.gps).length) {
            var b4 = block(results, "KONUM (GPS)");
            renderKV(b4, Object.keys(parsed.gps).map(function (k) { return [k, parsed.gps[k]]; }));
            if (parsed.coords) {
              var c = parsed.coords.lat.toFixed(6) + ", " + parsed.coords.lon.toFixed(6);
              var mapUrl = "https://www.openstreetmap.org/?mlat=" + parsed.coords.lat.toFixed(6) +
                "&mlon=" + parsed.coords.lon.toFixed(6) + "#map=16/" + parsed.coords.lat.toFixed(6) + "/" + parsed.coords.lon.toFixed(6);
              var row = el("div", "btn-row");
              var bm = el("button", "btn", "Haritada Aç");
              bm.addEventListener("click", function () { openExternal(mapUrl); });
              var bc = el("button", "btn", "Koordinatı Kopyala");
              bc.addEventListener("click", function () { copyText(c); bc.textContent = "Kopyalandı"; });
              row.appendChild(bm); row.appendChild(bc);
              b4.appendChild(row);
              b4.appendChild(el("div", "muted", "Konum yalnızca bu cihazda çözüldü; harita bağlantısı sen dokunana kadar açılmaz."));
            }
          }
        } catch (err) {
          var b5 = block(results, "EXIF");
          showError(b5, "Dosya çözümlenemedi: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }


  /* ---------------------- Ek modüller: Wayback / SSL / InternetDB ---------------------- */

  function simpleBlock(results, title) {
    clear(results);
    var b = block(results, title);
    var note = el("div", "muted", "Sorgulanıyor…");
    b.appendChild(note);
    return { b: b, done: function () { if (note.parentNode) note.parentNode.removeChild(note); } };
  }

  function initExtraDomainTools() {
    var input = document.getElementById("domainInput");
    var results = document.getElementById("domainResults");
    function getDomain() {
      return (input.value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    document.getElementById("btnWayback").addEventListener("click", async function () {
      var domain = getDomain();
      if (!domain) { clear(results); showError(results, "Önce bir alan adı girin."); return; }
      var h = simpleBlock(results, "WAYBACK MACHINE — " + domain.toUpperCase());
      try {
        var data = await fetchJSON("https://archive.org/wayback/available?url=" + encodeURIComponent(domain));
        h.done();
        var snap = data && data.archived_snapshots && data.archived_snapshots.closest;
        if (!snap) { h.b.appendChild(el("div", "muted", "Bu alan adı için arşivlenmiş kayıt bulunamadı.")); }
        else {
          var ts = snap.timestamp || "";
          var pretty = ts.length >= 8 ? ts.slice(6, 8) + "." + ts.slice(4, 6) + "." + ts.slice(0, 4) : ts;
          renderKV(h.b, [["En yakın arşiv", pretty], ["Durum", snap.status]]);
          var row = el("div", "btn-row");
          var b1 = el("button", "btn", "Arşivi Aç");
          b1.addEventListener("click", function () { openInApp(snap.url.replace(/^http:/, "https:")); });
          var b2 = el("button", "btn", "Tüm Kayıtlar");
          b2.addEventListener("click", function () { openInApp("https://web.archive.org/web/*/" + domain); });
          row.appendChild(b1); row.appendChild(b2); h.b.appendChild(row);
        }
      } catch (err) { h.done(); showError(h.b, "Wayback sorgusu başarısız: " + err.message); }
    });

    document.getElementById("btnSsl").addEventListener("click", async function () {
      var domain = getDomain();
      if (!domain) { clear(results); showError(results, "Önce bir alan adı girin."); return; }
      var h = simpleBlock(results, "SSL SERTİFİKASI — " + domain.toUpperCase());
      try {
        var data = await fetchJSON("https://crt.sh/?q=" + encodeURIComponent(domain) + "&output=json");
        h.done();
        if (!data.length) { h.b.appendChild(el("div", "muted", "Sertifika kaydı bulunamadı.")); return; }
        data.sort(function (a, b) { return String(b.not_before).localeCompare(String(a.not_before)); });
        var c = data[0];
        function d(x) { return x ? String(x).slice(0, 10) : "—"; }
        var exp = c.not_after ? new Date(c.not_after + "Z") : null;
        var left = exp ? Math.round((exp - Date.now()) / 86400000) : null;
        renderKV(h.b, [
          ["Düzenleyen (CA)", c.issuer_name],
          ["Ortak ad", c.common_name],
          ["Başlangıç", d(c.not_before)],
          ["Bitiş", d(c.not_after)],
          ["Kalan süre", left === null ? "—" : (left >= 0 ? left + " gün" : "süresi " + (-left) + " gün önce dolmuş")],
          ["Toplam kayıt (CT)", data.length]
        ]);
      } catch (err) {
        h.done();
        showError(h.b, "crt.sh şu an yanıt vermiyor. https://crt.sh/?q=" + domain + " adresinden manuel bakabilirsiniz.");
      }
    });
  }

  function initExtraIpTool() {
    var input = document.getElementById("ipInput");
    var results = document.getElementById("ipResults");
    document.getElementById("btnShodan").addEventListener("click", async function () {
      var ip = (input.value || "").trim();
      if (!ip) { clear(results); showError(results, "Önce bir IP adresi girin."); return; }
      var h = simpleBlock(results, "SHODAN INTERNETDB — " + ip);
      try {
        var data = await fetchJSON("https://internetdb.shodan.io/" + encodeURIComponent(ip));
        h.done();
        function j(a) { return a && a.length ? a.join(", ") : "—"; }
        renderKV(h.b, [
          ["Açık portlar", j(data.ports)],
          ["Ana bilgisayar adları", j(data.hostnames)],
          ["Etiketler", j(data.tags)],
          ["Bilinen CVE sayısı", (data.vulns || []).length],
          ["CPE", j(data.cpes)]
        ]);
        if ((data.vulns || []).length) {
          h.b.appendChild(el("div", "mono-block", data.vulns.slice(0, 50).join("\n")));
        }
        h.b.appendChild(el("div", "muted", "Pasif, herkese açık Shodan verisidir; uygulama hedefe hiçbir tarama yapmaz."));
      } catch (err) {
        h.done();
        showError(h.b, /404/.test(err.message) ? "Bu IP için kayıt yok." : "InternetDB sorgusu başarısız: " + err.message);
      }
    });
  }

  /* ------------------------------ E-posta (teknik) ------------------------------ */
  /* Kişi hakkında profil çıkarmaz; yalnızca adresin biçimini ve alan adının
     herkese açık posta altyapısını inceler. */

  var DISPOSABLE = ["mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org","sharklasers.com","10minutemail.com","10minutemail.net","tempmail.com","temp-mail.org","temp-mail.io","throwawaymail.com","yopmail.com","yopmail.fr","trashmail.com","trashmail.net","getnada.com","nada.email","dispostable.com","maildrop.cc","fakeinbox.com","mailnesia.com","mintemail.com","mytemp.email","tempail.com","tempinbox.com","spamgourmet.com","mohmal.com","emailondeck.com","burnermail.io","anonaddy.me","moakt.com","mailcatch.com","spambox.us","tmpmail.org","tmpmail.net","discard.email","dropmail.me","33mail.com","mail.tm","inboxkitten.com","harakirimail.com","tempr.email","luxusmail.org","emailfake.com","crazymailing.com","fakemail.net","tempmailo.com","mailsac.com","spam4.me","guerrillamailblock.com","grr.la","byom.de","trbvm.com","owlymail.com","mail7.io","minuteinbox.com","tempmailaddress.com","eyepaste.com","jetable.org","mailforspam.com","getairmail.com","tmail.ws","email-fake.com","1secmail.com","1secmail.net","1secmail.org","wegwerfmail.de","trash-mail.com"];

  async function sha256hex(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }

  async function dnsAnswers(name, type) {
    try {
      var d = await fetchJSON("https://dns.google/resolve?name=" + encodeURIComponent(name) + "&type=" + type);
      return { status: d.Status, answers: (d.Answer || []).map(function (a) { return a.data; }) };
    } catch (e) { return { status: -1, answers: [] }; }
  }

  function checkGravatar(hash) {
    return new Promise(function (resolve) {
      var img = new Image();
      var timer = setTimeout(function () { resolve(null); }, 8000);
      img.onload = function () { clearTimeout(timer); resolve(true); };
      img.onerror = function () { clearTimeout(timer); resolve(false); };
      img.src = "https://gravatar.com/avatar/" + hash + "?d=404&s=1";
    });
  }

  function initEmailTool() {
    var input = document.getElementById("emailInput");
    var results = document.getElementById("emailResults");
    document.getElementById("btnEmail").addEventListener("click", async function () {
      var email = (input.value || "").trim().toLowerCase();
      clear(results);
      if (!email) { showError(results, "Önce bir e-posta adresi girin."); return; }

      var bf = block(results, "1 · BİÇİM / GEÇERLİLİK");
      var ok = /^[a-z0-9._%+\-]+@([a-z0-9\-]+\.)+[a-z]{2,}$/.test(email) && email.length <= 254;
      if (!ok) { renderKV(bf, [["Söz dizimi", "Geçersiz"]]); return; }
      var domain = email.split("@")[1];
      renderKV(bf, [["Söz dizimi", "Geçerli"], ["Alan adı", domain]]);
      var domState = el("div", "muted", "Alan adı denetleniyor…");
      bf.appendChild(domState);

      var mxP = dnsAnswers(domain, "MX");
      var txtP = dnsAnswers(domain, "TXT");
      var dmP = dnsAnswers("_dmarc." + domain, "TXT");
      var mx = await mxP;
      var aRes = mx.answers.length ? null : await dnsAnswers(domain, "A");
      var exists = mx.status !== 3 && (mx.answers.length || (aRes && aRes.answers.length));
      domState.textContent = mx.status === -1 ? "Alan adı sorgusu yapılamadı (ağ)." :
        (exists ? "Alan adı DNS'te mevcut." : "Alan adı DNS'te bulunamadı.");

      var b2 = block(results, "2 · MX / SPF / DMARC");
      var txt = await txtP, dm = await dmP;
      var spf = txt.answers.filter(function (t) { return /v=spf1/i.test(t); });
      var dmarc = dm.answers.filter(function (t) { return /v=DMARC1/i.test(t); });
      renderKV(b2, [
        ["MX", mx.answers.length ? mx.answers.join("\n") : "Yok"],
        ["SPF", spf.length ? spf[0].replace(/^"|"$/g, "") : "Yok"],
        ["DMARC", dmarc.length ? dmarc[0].replace(/^"|"$/g, "") : "Yok"]
      ]);
      if (!mx.answers.length) b2.appendChild(el("div", "muted", "MX kaydı yok: bu alan adı muhtemelen e-posta almıyor."));

      var b3 = block(results, "3 · GEÇİCİ / TEK KULLANIMLIK");
      var isDisp = DISPOSABLE.indexOf(domain) !== -1 || DISPOSABLE.some(function (d) { return domain.endsWith("." + d); });
      renderKV(b3, [["Bilinen geçici servis", isDisp ? "Evet" : "Listede yok"]]);
      b3.appendChild(el("div", "muted", "Gömülü kısa bir listeye bakar; “Listede yok” kesin kanıt değildir."));

      var b4 = block(results, "4 · GRAVATAR");
      b4.appendChild(el("div", "muted", "Denetleniyor…"));
      var g = await checkGravatar(await sha256hex(email));
      clear(b4);
      b4.appendChild(el("div", "result-block__title", "4 · GRAVATAR"));
      renderKV(b4, [["Herkese açık avatar", g === null ? "Belirlenemedi" : (g ? "Var" : "Yok")]]);
      b4.appendChild(el("div", "muted", "Yalnızca var/yok bilgisi verilir; görsel indirilmez veya gösterilmez."));

      var b5 = block(results, "5 · ALAN ADI SIZINTI İSTATİSTİĞİ (HIBP)");
      b5.appendChild(el("div", "muted", "Sorgulanıyor…"));
      try {
        var br = await fetchJSON("https://haveibeenpwned.com/api/v3/breaches?domain=" + encodeURIComponent(domain));
        clear(b5);
        b5.appendChild(el("div", "result-block__title", "5 · ALAN ADI SIZINTI İSTATİSTİĞİ (HIBP)"));
        if (!br.length) {
          b5.appendChild(el("div", "muted", "Bu alan adına ait bir servisin kayıtlı sızıntısı yok (kişisel e-postalar bu sorguyla kontrol edilmez)."));
        } else {
          renderKV(b5, br.map(function (x) { return [x.Name, (x.BreachDate || "") + " · " + (x.PwnCount || 0).toLocaleString("tr-TR") + " hesap"]; }));
        }
        b5.appendChild(el("div", "muted", "Bu, alan adının kendi servisinin yaşadığı sızıntıları gösterir; adresin sızıntıda olup olmadığını göstermez."));
      } catch (err) {
        clear(b5);
        b5.appendChild(el("div", "result-block__title", "5 · ALAN ADI SIZINTI İSTATİSTİĞİ (HIBP)"));
        showError(b5, "HIBP sorgusu başarısız: " + err.message);
      }
    });
  }

  /* --------------------------------- Başlat --------------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initNetStatus();
    initPlatformGrid();
    initDomainTools();
    initIpTool();
    initUrlTool();
    initExifTool();
    initExtraDomainTools();
    initExtraIpTool();
    initEmailTool();
    initConverter();
    initNotes();
    initHistoryUi();
  });
})();
