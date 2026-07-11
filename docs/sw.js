/* Service worker — cache para uso offline / instalação como app (PWA). */
var CACHE = "enemcn-v1";
var CORE = [
  "index.html", "questao.html", "painel.html", "painel-oficial.html",
  "materiais.html", "sobre.html", "estudar.html", "meu-painel.html",
  "manifest.webmanifest",
  "assets/styles.css", "assets/app.js", "assets/boot.js",
  "assets/auth.js", "assets/tracker.js",
  "assets/data.js", "assets/microdados.js", "assets/materiais.js",
  "assets/provas.js", "assets/estudar.js", "assets/meu-painel.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) {
      return c.add(u).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  // navegação: rede primeiro, cache como reserva
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(function () { return caches.match(req).then(function (r) { return r || caches.match("index.html"); }); }));
    return;
  }
  // demais: cache primeiro
  e.respondWith(caches.match(req).then(function (r) {
    return r || fetch(req).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return resp;
    }).catch(function () { return r; });
  }));
});
