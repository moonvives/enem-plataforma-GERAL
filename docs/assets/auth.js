/* Trava de acesso pessoal (single-user).
   NÃO é autenticação de servidor: é um bloqueio local por PIN no próprio
   aparelho. O hash do PIN fica em localStorage; a sessão desbloqueada vale
   enquanto a aba estiver aberta (sessionStorage). Adequado para uso pessoal
   em um dispositivo de confiança. */
(function () {
  "use strict";
  var KEY_HASH = "enemcn.pin.hash";
  var KEY_NAME = "enemcn.user.name";
  var KEY_UNLOCK = "enemcn.unlocked";

  async function sha256(txt) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("enemcn::" + txt));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function injectStyles() {
    if (document.getElementById("auth-styles")) return;
    var s = document.createElement("style");
    s.id = "auth-styles";
    s.textContent = [
      "#auth-gate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;",
      "background:radial-gradient(1200px 600px at 50% -10%,#123b2b,#0c1116 60%);",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:1.5rem}",
      "#auth-gate .box{width:min(400px,92vw);background:#171b21;border:1px solid #2a313a;",
      "border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);padding:2rem 1.75rem;color:#e7eaef;text-align:center}",
      "#auth-gate .logo{display:inline-grid;place-items:center;width:52px;height:52px;border-radius:14px;",
      "background:linear-gradient(150deg,#2f7d59,#0f3d2c);color:#fff;font-weight:800;font-size:1.05rem;",
      "letter-spacing:.02em;margin-bottom:.9rem;box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}",
      "#auth-gate h1{font-size:1.3rem;margin:.2rem 0 .1rem;letter-spacing:-.01em}",
      "#auth-gate p{color:#9aa3b0;font-size:.9rem;margin:.2rem 0 1.4rem}",
      "#auth-gate input{width:100%;font:inherit;font-size:1.4rem;letter-spacing:.4em;text-align:center;",
      "padding:.7rem;border-radius:12px;border:1px solid #2a313a;background:#0f1216;color:#fff;margin-bottom:.4rem}",
      "#auth-gate input.name{font-size:1rem;letter-spacing:normal}",
      "#auth-gate input:placeholder-shown{letter-spacing:normal;font-size:1rem}",
      "#auth-gate input:focus{outline:2px solid #5aa87c}",
      "#auth-gate button{width:100%;font:inherit;font-weight:700;cursor:pointer;border:0;margin-top:.8rem;",
      "background:linear-gradient(180deg,#5aa87c,#3a7d55);color:#04140c;padding:.8rem;border-radius:12px;font-size:1rem}",
      "#auth-gate button:hover{filter:brightness(1.06)}",
      "#auth-gate .msg{min-height:1.2em;color:#e88;font-size:.85rem;margin-top:.6rem}",
      "#auth-gate .hint{color:#6b7280;font-size:.72rem;margin-top:1rem}",
      "body.locked{overflow:hidden}"
    ].join("");
    document.head.appendChild(s);
  }

  function gate(mode, name) {
    injectStyles();
    document.body.classList.add("locked");
    var isSetup = mode === "setup";
    var wrap = document.createElement("div");
    wrap.id = "auth-gate";
    wrap.innerHTML =
      '<div class="box">' +
        '<div class="logo">CN</div>' +
        "<h1>" + (isSetup ? "Criar acesso" : "Bem-vindo(a) de volta" + (name ? ", " + name : "")) + "</h1>" +
        "<p>" + (isSetup
          ? "Defina um PIN para proteger seu progresso neste aparelho."
          : "Digite seu PIN para entrar.") + "</p>" +
        (isSetup ? '<input class="name" id="auth-name" type="text" placeholder="Seu nome (opcional)" autocomplete="name">' : "") +
        '<input id="auth-pin" type="password" inputmode="numeric" maxlength="8" placeholder="••••" autocomplete="off">' +
        (isSetup ? '<input id="auth-pin2" type="password" inputmode="numeric" maxlength="8" placeholder="Repita o PIN" autocomplete="off">' : "") +
        '<button id="auth-go">' + (isSetup ? "Criar e entrar" : "Entrar") + "</button>" +
        '<div class="msg" id="auth-msg"></div>' +
        '<div class="hint">Bloqueio local no dispositivo — seus dados de estudo ficam salvos só aqui.</div>' +
      "</div>";
    document.body.appendChild(wrap);
    var pin = wrap.querySelector("#auth-pin");
    var msg = wrap.querySelector("#auth-msg");
    setTimeout(function () { pin.focus(); }, 60);

    async function submit() {
      var v = pin.value.trim();
      if (v.length < 4) { msg.textContent = "Use ao menos 4 dígitos."; return; }
      if (isSetup) {
        var v2 = wrap.querySelector("#auth-pin2").value.trim();
        if (v !== v2) { msg.textContent = "Os PINs não coincidem."; return; }
        localStorage.setItem(KEY_HASH, await sha256(v));
        var nm = wrap.querySelector("#auth-name").value.trim();
        if (nm) localStorage.setItem(KEY_NAME, nm);
        unlock(wrap);
      } else {
        if (await sha256(v) === localStorage.getItem(KEY_HASH)) {
          unlock(wrap);
        } else {
          msg.textContent = "PIN incorreto."; pin.value = ""; pin.focus();
        }
      }
    }
    wrap.querySelector("#auth-go").addEventListener("click", submit);
    wrap.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function unlock(wrap) {
    sessionStorage.setItem(KEY_UNLOCK, "1");
    document.body.classList.remove("locked");
    if (wrap) wrap.remove();
    document.dispatchEvent(new CustomEvent("enem:unlocked"));
  }

  var Auth = {
    name: function () { return localStorage.getItem(KEY_NAME) || ""; },
    logout: function () { sessionStorage.removeItem(KEY_UNLOCK); location.reload(); },
    reset: function () {
      if (confirm("Isso apaga seu PIN. Seu progresso de estudo é mantido. Continuar?")) {
        localStorage.removeItem(KEY_HASH); location.reload();
      }
    },
    require: function () {
      if (sessionStorage.getItem(KEY_UNLOCK) === "1") { document.dispatchEvent(new CustomEvent("enem:unlocked")); return; }
      gate(localStorage.getItem(KEY_HASH) ? "enter" : "setup", localStorage.getItem(KEY_NAME));
    }
  };
  window.Auth = Auth;
})();
