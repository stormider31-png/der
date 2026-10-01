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

  function initNav() {
    var tabs = document.querySelectorAll(".tab");
    var screens = document.querySelectorAll(".screen");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-target");
        tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
        screens.forEach(function (s) {
          s.classList.toggle("active", s.getAttribute("data-screen") === target);
        });
      });
    });
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
      btn.addEventListener("click", function () {
        var uname = sanitizeUsername(input.value);
        if (!uname) {
          clear(results);
          showError(results, "Önce bir kullanıcı adı girin.");
          return;
        }
        var target = p.url(uname);
        clear(results);
        var b = block(results, p.name.toUpperCase());
        renderKV(b, [["Kullanıcı adı", uname], ["Açılan bağlantı", target]]);
        b.appendChild(el("div", "muted", "Profil sayfası tarayıcıda açıldı — hesabın var olup olmadığını orada gözle teyit edin."));
        openExternal(target);
      });
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
            var num = u32(ratOffset), den = u32(ratOffset + 4);
            value = den ? (num / den).toFixed(4) : num;
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
    return { tags: tags, gps: gps };
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
          }
        } catch (err) {
          var b5 = block(results, "EXIF");
          showError(b5, "Dosya çözümlenemedi: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
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
  });
})();
