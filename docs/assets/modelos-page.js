/* Modelos de questões — renderiza padrões de cobrança e o catálogo de modelos
   reais do ENEM (CN) a partir de window.ENEM_MODELOS. Aguarda o desbloqueio
   pessoal (evento enem:unlocked) para exibir o conteúdo. */
(function () {
  "use strict";

  var TIER_ROT = { 1: "Muito fácil", 2: "Fácil", 3: "Mediana", 4: "Difícil", 5: "Muito difícil" };
  function br(n) { return n == null ? "—" : String(n).replace(".", ","); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function el(id) { return document.getElementById(id); }
  function tierChip(t) {
    if (!t) return "";
    return '<span class="tier t' + t + '"><span class="lvl l' + t + '">' + t + "</span>" + TIER_ROT[t] + "</span>";
  }

  document.addEventListener("enem:unlocked", function () {
    var D = window.ENEM_MODELOS;
    if (!D) return;
    var meta = D.meta, modelos = D.modelos || [], padroes = D.padroes || [];
    var byId = {};
    modelos.forEach(function (m) { byId[m.id] = m; });

    // ---- KPIs ----
    function kpi(n, l) { return '<div class="kpi"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
    el("kpis").innerHTML =
      kpi(meta.n_modelos, "Modelos de questões") +
      kpi(meta.n_padroes, "Padrões de cobrança") +
      kpi(meta.com_gabarito, "Com gabarito") +
      kpi(meta.com_figura, "Com imagem original") +
      kpi(meta.habilidades.length, "Habilidades") +
      kpi(meta.anos[0] + "–" + meta.anos[meta.anos.length - 1], "Período");
    el("foot-src").textContent = "Fonte: " + meta.fonte;

    // ---- Padrões (habilidade x tema, ordenados por recorrência) ----
    el("pad-note").textContent =
      padroes.length + " padrões recorrentes identificados nas " + meta.n_modelos +
      " questões reais. Cada card agrupa itens da mesma habilidade e mesmo tema — ordenados do mais recorrente ao menos recorrente.";
    el("padroes").innerHTML = padroes.map(function (p) {
      var anos = p.anos.map(function (a) { return '<span class="yr">' + a + "</span>"; }).join("");
      return '<div class="pcard">' +
        '<div class="top"><span class="tema">' + esc(p.tema) + '</span>' +
          '<span class="badge hab">H' + p.hab + "</span>" + tierChip(p.tier) + "</div>" +
        '<div class="metrics">' +
          '<div class="metric"><div class="l">Recorrência</div><div class="v">' + p.n + ' questões</div></div>' +
          '<div class="metric"><div class="l">Dificuldade típica</div><div class="v">' + br(p.dif_media) + "</div></div>" +
          '<div class="metric"><div class="l">Comando típico</div><div class="v">' + esc(p.comando) + "</div></div>" +
          '<div class="metric"><div class="l">Contexto típico</div><div class="v">' + esc(p.contexto) + "</div></div>" +
        "</div>" +
        '<div><div class="l" style="font-size:.66rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:.3rem">Anos em que apareceu</div>' +
          '<div class="yearline">' + anos + "</div></div>" +
        '<button class="linklike" data-goto-hab="' + p.hab + '" data-goto-tema="' + esc(p.tema) +
          '" style="align-self:flex-start;background:none;border:0;color:var(--brand);font:inherit;font-weight:600;cursor:pointer;padding:0">Ver as ' + p.n + " questões deste padrão →</button>" +
        "</div>";
    }).join("");

    // ---- Catálogo (filtros + questões) ----
    var habs = meta.habilidades.slice().sort(function (a, b) { return a - b; });
    el("f-hab").innerHTML += habs.map(function (h) { return '<option value="' + h + '">H' + h + "</option>"; }).join("");
    var temas = Object.keys(meta.por_tema);
    el("f-tema").innerHTML += temas.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join("");
    var comandos = {}; modelos.forEach(function (m) { comandos[m.comando] = 1; });
    el("f-comando").innerHTML += Object.keys(comandos).sort().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
    el("f-ano").innerHTML += meta.anos.map(function (a) { return '<option value="' + a + '">' + a + "</option>"; }).join("");

    function questionCard(m) {
      var fig = (m.figs || []).map(function (f) {
        return '<figure><img loading="lazy" alt="Figura do enunciado" src="assets/img/' + esc(f) + '"></figure>';
      }).join("");
      var alts = (m.alts || []).map(function (a) {
        var ok = a.l === m.gab;
        var altImages = (a.imgs && a.imgs.length ? a.imgs : (a.img ? [a.img] : []));
        var body = altImages.length
          ? '<span class="alt-images">' + altImages.map(function (image, imageIndex) {
              return '<img loading="lazy" alt="Alternativa ' + a.l + ', figura ' + (imageIndex + 1) +
                '" src="assets/img/' + esc(image) + '" style="max-height:160px">';
            }).join("") + '</span>'
          : (a.t ? esc(a.t) : "<em>alternativa gráfica — ver recorte original abaixo</em>");
        return '<div class="alt' + (ok ? " correct" : "") + '"><span class="l">' + a.l + "</span><span>" + body + "</span></div>";
      }).join("");
      var gabline = m.gab
        ? "Gabarito: <strong>" + m.gab + "</strong> · " + (m.gab_fonte === "microdados" ? "oficial (microdados INEP)" : "indicado pelo material")
        : (m.status === "anulada" ? "Questão anulada — sem gabarito" : "Gabarito não disponível");
      var habBadge = m.hab
        ? '<span class="badge hab">H' + m.hab + (m.comp ? " · C" + m.comp : "") + "</span>"
        : '<span class="badge" title="Microdados sem habilidade para esta edição">sem habilidade</span>';
      var statusBadge = m.status === "anulada" ? '<span class="badge" style="background:rgba(192,69,59,.14);color:var(--t5)">anulada</span>' : "";
      var src = m.fonte_img
        ? '<details class="fonte"><summary>Ver questão original (recorte do caderno)</summary>' +
          '<figure><img loading="lazy" alt="Recorte original da questão ' + m.num + '" src="assets/img/' + esc(m.fonte_img) + '"></figure></details>'
        : "";
      var habLine = m.hab_desc ? '<div class="qmeta" style="margin:.5rem 0 0">Habilidade ' + m.hab + ": " + esc(m.hab_desc) + "</div>" : "";
      return '<article class="qmodel">' +
        '<div class="qhead"><div class="qtags">' +
          habBadge +
          '<span class="badge">' + esc(m.tema) + "</span>" +
          '<span class="badge">' + esc(m.comando) + "</span>" +
          tierChip(m.tier) + statusBadge +
        '</div><span class="qmeta" style="margin:0">Enem ' + m.ano + " · " + esc(m.aplicacao || m.fonte) + " · dificuldade " + br(m.b_enem) + "</span></div>" +
        '<div class="enun">' + esc(m.enun) + "</div>" + fig +
        '<div class="alts">' + alts + "</div>" +
        '<div class="qmeta">' + gabline + " · contexto: " + esc(m.contexto) + "</div>" +
        habLine + src +
        "</article>";
    }

    var F = { busca: el("f-busca"), hab: el("f-hab"), tema: el("f-tema"), comando: el("f-comando"), tier: el("f-tier"), ano: el("f-ano") };
    var initialParams = new URLSearchParams(window.location.search);
    if (initialParams.get("tema") && temas.indexOf(initialParams.get("tema")) !== -1) {
      F.tema.value = initialParams.get("tema");
    }
    if (initialParams.get("hab") && habs.map(String).indexOf(initialParams.get("hab")) !== -1) {
      F.hab.value = initialParams.get("hab");
    }
    function applyFilters() {
      var q = (F.busca.value || "").trim().toLowerCase();
      var out = modelos.filter(function (m) {
        if (F.hab.value && String(m.hab) !== F.hab.value) return false;
        if (F.tema.value && m.tema !== F.tema.value) return false;
        if (F.comando.value && m.comando !== F.comando.value) return false;
        if (F.tier.value && String(m.tier) !== F.tier.value) return false;
        if (F.ano.value && String(m.ano) !== F.ano.value) return false;
        if (q) {
          var hay = (m.enun + " " + m.tema + " " + m.contexto + " " + (m.hab_desc || "") + " " + (m.alts || []).map(function (a) { return a.t || ""; }).join(" ")).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
      out.sort(function (a, b) { return (a.b_enem || 0) - (b.b_enem || 0); });
      el("cat-note").textContent = out.length + " de " + modelos.length + " modelos" +
        (out.length ? " · ordenados do mais fácil ao mais difícil (TRI)" : "");
      el("catalogo").innerHTML = out.length
        ? out.map(questionCard).join("")
        : '<div class="empty">Nenhum modelo corresponde a esses filtros.</div>';
    }
    Object.keys(F).forEach(function (k) {
      F[k].addEventListener(F[k].tagName === "SELECT" ? "change" : "input", applyFilters);
    });
    applyFilters();

    // ---- Alternância de visões ----
    var vp = el("view-padroes"), vc = el("view-catalogo");
    if (F.tema.value || F.hab.value) {
      Array.prototype.forEach.call(el("viewtabs").querySelectorAll("button"), function (x) {
        x.classList.toggle("on", x.dataset.view === "catalogo");
      });
      vp.hidden = true;
      vc.hidden = false;
    }
    el("viewtabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]"); if (!b) return;
      Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      var padroesView = b.dataset.view === "padroes";
      vp.hidden = !padroesView; vc.hidden = padroesView;
    });

    // clique num padrão -> abre catálogo já filtrado
    el("padroes").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-goto-hab]"); if (!b) return;
      F.busca.value = ""; F.comando.value = ""; F.tier.value = ""; F.ano.value = "";
      F.hab.value = b.dataset.gotoHab; F.tema.value = b.dataset.gotoTema;
      applyFilters();
      Array.prototype.forEach.call(el("viewtabs").querySelectorAll("button"), function (x) {
        x.classList.toggle("on", x.dataset.view === "catalogo");
      });
      vp.hidden = true; vc.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
})();
