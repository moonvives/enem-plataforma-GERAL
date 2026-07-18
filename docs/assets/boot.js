/* Bootstrap comum: remove instalações PWA antigas e ativa a trava de acesso
   pessoal. A plataforma é exclusivamente online. */
(function () {
  "use strict";
  // Only touch this app's own service worker / caches, never other apps that
  // may share the origin (e.g. multiple projects under user.github.io).
  var appScope = new URL("./", location.href).href;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          if (registration.scope && registration.scope.indexOf(appScope) === 0) {
            registration.unregister();
          }
        });
      }).catch(function () {});
    });
  }
  if ("caches" in window) {
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        // Old PWA cache names for this app: "enem-*" and the legacy "enemcn-v1".
        return key.indexOf("enem") === 0;
      }).map(function (key) { return caches.delete(key); }));
    }).catch(function () {});
  }
  if (window.Auth) window.Auth.require();
})();
