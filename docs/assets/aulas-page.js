/* Aulas — renderiza o conteúdo extraído das videoaulas (window.ENEM_AULAS).
   Aguarda o desbloqueio pessoal (evento enem:unlocked). */
(function () {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function escAttr(s) {
    return esc(s).replace(/'/g, "&#39;");
  }
  function el(id) { return document.getElementById(id); }

  document.addEventListener("enem:unlocked", function () {
    var D = window.ENEM_AULAS;
    if (!D) return;
    var meta = D.meta, aulas = D.aulas || [];

    function kpi(n, l) { return '<div class="kpi"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
    el("kpis").innerHTML =
      kpi(meta.n_aulas, "Aulas") +
      kpi(meta.n_modelos, "Modelos ensinados") +
      kpi(meta.temas.length, meta.temas.length === 1 ? "Tema" : "Temas");
    el("foot-src").textContent = "Fonte: " + meta.fonte;

    function block(label, text) {
      return text ? '<div class="block"><div class="l">' + label + '</div><p>' + esc(text) + "</p></div>" : "";
    }

    function formulas(items) {
      if (!items || !items.length) return "";
      return '<div class="formula-grid">' + items.map(function (item) {
        return '<div class="formula-card"><div class="l">' + esc(item.rotulo) + '</div>' +
          '<div class="math" data-latex="' + escAttr(item.latex) + '"></div></div>';
      }).join("") + "</div>";
    }

    function simulator(config) {
      if (!config || config.tipo !== "biomagnificacao") return "";
      var factor = config.fator_inicial || 10;
      var initial = config.concentracao_inicial || 1;
      return '<section class="lab" data-lab="biomagnificacao" data-initial="' + initial + '">' +
        '<div class="lab-head"><div><div class="eyebrow">Laboratório interativo</div>' +
          '<strong>Magnificação ao longo da cadeia</strong></div>' +
          '<output class="factor">k = ' + factor + '×</output></div>' +
        '<label>Fator de concentração entre níveis' +
          '<input type="range" min="2" max="20" step="1" value="' + factor + '"></label>' +
        '<div class="trophic" aria-live="polite"></div>' +
        '<p class="lab-note">Ajuste o fator e observe como <span class="math" data-latex="C_n=C_0k^n"></span> amplifica o contaminante.</p>' +
        '</section>';
    }

    function modeloEl(m, i) {
      var conc = (m.conceitos || []).map(function (c) { return '<span class="badge">' + esc(c) + "</span>"; }).join("");
      return '<details class="modelo"' + (i === 0 ? " open" : "") + '>' +
        '<summary><span class="idx">' + (i + 1) + "</span>" + esc(m.nome) +
          '<span class="chev">›</span></summary>' +
        '<div class="body">' +
          (conc ? '<div class="conc">' + conc + "</div>" : "") +
          block("Ideia central", m.ideia) +
          block("Como funciona", m.como_funciona) +
          formulas(m.formulas) +
          block("Como cai no ENEM", m.como_cai) +
          (m.atalho ? '<div class="atalho block"><div class="l">Atalho</div><p>' + esc(m.atalho) + "</p></div>" : "") +
          simulator(m.simulador) +
        "</div></details>";
    }

    el("aulas").innerHTML = aulas.map(function (a) {
      var temaQ = a.tema_banco
        ? '<a class="cta" href="modelos.html?tema=' + encodeURIComponent(a.tema_banco) + '">Praticar questões de ' + esc(a.tema_banco) + " no banco de modelos →</a>"
        : "";
      return '<section class="aula">' +
        '<div class="ahead"><div><h2>' + esc(a.titulo) + "</h2>" +
          '<div class="curso">' + esc(a.curso) + " · " + esc(a.area) + "</div></div>" +
          '<span class="badge hab">' + esc(a.tema_banco || "") + "</span></div>" +
        '<p class="resumo">' + esc(a.resumo) + "</p>" +
        '<div class="mlist">' + (a.modelos || []).map(modeloEl).join("") + "</div>" +
        (a.fechamento ? '<div class="fechamento">' + esc(a.fechamento) + "</div>" : "") +
        temaQ +
        "</section>";
    }).join("");

    if (window.katex) {
      document.querySelectorAll(".math[data-latex]").forEach(function (node) {
        try {
          window.katex.render(node.dataset.latex, node, { throwOnError: false, displayMode: true });
        } catch (error) {
          node.textContent = node.dataset.latex;
        }
      });
    }

    function updateLab(lab) {
      var input = lab.querySelector('input[type="range"]');
      var factor = Number(input.value);
      var initial = Number(lab.dataset.initial || 1);
      var labels = ["Fitoplâncton", "Zooplâncton", "Peixe pequeno", "Peixe grande"];
      lab.querySelector(".factor").textContent = "k = " + factor + "×";
      lab.querySelector(".trophic").innerHTML = labels.map(function (label, index) {
        var value = initial * Math.pow(factor, index);
        var scale = 0.35 + 0.65 * ((index + 1) / labels.length);
        return '<div class="trophic-level" style="--scale:' + scale + '"><span class="bubble">' +
          (index + 1) + '</span><span><strong>' + label + '</strong><small>C' + index +
          ' = ' + value.toLocaleString("pt-BR") + '</small></span></div>';
      }).join("");
    }
    document.querySelectorAll('[data-lab="biomagnificacao"]').forEach(function (lab) {
      updateLab(lab);
      lab.querySelector("input").addEventListener("input", function () { updateLab(lab); });
    });
  });
})();
