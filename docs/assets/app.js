/* Plataforma ENEM — Ciências da Natureza (edições não regulares).
   Dados embutidos em data.js (window.ENEM_DATA) para funcionar offline via
   file://; os mesmos dados estão disponíveis como JSON em /api/. */
(function () {
  "use strict";

  var DATA = window.ENEM_DATA || null;
  var QUESTOES = DATA ? DATA.questoes : [];
  var META = DATA ? DATA.meta : null;
  var STATS = DATA ? DATA.stats : null;

  // ---- helpers -----------------------------------------------------------
  function el(sel, root) { return (root || document).querySelector(sel); }
  function els(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function opt(value, label) { var o = document.createElement("option"); o.value = value; o.textContent = label; return o; }
  function areaClass(a) {
    return "area-" + a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function tierHtml(q) {
    if (!q.tier) return '<span class="tier" style="color:var(--muted)">—</span>';
    return '<span class="tier t' + q.tier.nivel + '"><span class="dot"></span>' +
      q.tier.icone + " " + q.tier.rotulo + "</span>";
  }
  function fmtB(q) { return q.b === null ? q.b_texto : q.b_texto; }

  // ===== PÁGINA: BUSCA / FILTROS =========================================
  function initBusca() {
    var f = {
      q: el("#f-texto"), area: el("#f-area"), comp: el("#f-comp"),
      hab: el("#f-hab"), edicao: el("#f-edicao"), ano: el("#f-ano"),
      nivel: el("#f-nivel")
    };
    // popular selects
    META.areas.forEach(function (a) { f.area.appendChild(opt(a, a)); });
    META.competencias.forEach(function (c) { f.comp.appendChild(opt(c.id, "C" + c.id + " — " + c.descricao.slice(0, 46) + "…")); });
    META.habilidades.forEach(function (h) { f.hab.appendChild(opt(h.id, "H" + h.id)); });
    META.edicoes.forEach(function (e) { f.edicao.appendChild(opt(e, e)); });
    META.anos.forEach(function (y) { f.ano.appendChild(opt(y, y)); });
    META.regua.forEach(function (r) { f.nivel.appendChild(opt(r.nivel, r.icone + " " + r.rotulo)); });

    var tbody = el("#resultados");
    var countEl = el("#count");
    var sortState = { key: "numero", dir: 1 };

    function passa(q) {
      var t = f.q.value.trim().toLowerCase();
      if (t) {
        var hay = (q.codigo + " " + q.enunciado + " " + q.aplicacao + " H" + q.habilidade).toLowerCase();
        if (hay.indexOf(t) === -1) return false;
      }
      if (f.area.value && q.area !== f.area.value) return false;
      if (f.comp.value && q.competencia !== +f.comp.value) return false;
      if (f.hab.value && q.habilidade !== +f.hab.value) return false;
      if (f.edicao.value && q.edicao !== f.edicao.value) return false;
      if (f.ano.value && q.ano !== +f.ano.value) return false;
      if (f.nivel.value && (!q.tier || q.tier.nivel !== +f.nivel.value)) return false;
      return true;
    }

    function sortFn(a, b) {
      var k = sortState.key, d = sortState.dir;
      var va = a[k], vb = b[k];
      if (k === "b") { va = a.b === null ? -1 : a.b; vb = b.b === null ? -1 : b.b; }
      if (va < vb) return -1 * d;
      if (va > vb) return 1 * d;
      return a.numero - b.numero;
    }

    function render() {
      var list = QUESTOES.filter(passa).sort(sortFn);
      countEl.innerHTML = "<b>" + list.length + "</b> de " + QUESTOES.length + " questões";
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty">Nenhuma questão corresponde aos filtros.</div></td></tr>';
        return;
      }
      var rows = list.map(function (q) {
        return '<tr data-q="' + q.numero + '">' +
          '<td class="code">' + q.codigo + "</td>" +
          '<td><span class="badge hab">H' + q.habilidade + '</span> ' +
          '<span class="badge ' + areaClass(q.area) + '">' + q.area + "</span></td>" +
          "<td>" + q.aplicacao + "</td>" +
          '<td style="font-variant-numeric:tabular-nums;font-weight:600">' + fmtB(q) + "</td>" +
          "<td>" + tierHtml(q) + "</td>" +
          '<td class="enun">' + (q.enunciado ? q.enunciado.slice(0, 120) + "…" : "—") + "</td>" +
          "</tr>";
      }).join("");
      tbody.innerHTML = rows;
    }

    // ordenação por cabeçalho
    els("th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.getAttribute("data-sort");
        if (sortState.key === k) sortState.dir *= -1; else { sortState.key = k; sortState.dir = 1; }
        els("th[data-sort]").forEach(function (o) { o.textContent = o.textContent.replace(/[ ▲▼]+$/, ""); });
        th.textContent = th.textContent + (sortState.dir === 1 ? " ▲" : " ▼");
        render();
      });
    });

    Object.keys(f).forEach(function (k) {
      f[k].addEventListener(k === "q" ? "input" : "change", render);
    });
    el("#limpar").addEventListener("click", function () {
      Object.keys(f).forEach(function (k) { f[k].value = ""; });
      render();
    });
    tbody.addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-q]");
      if (tr) location.href = "questao.html?q=" + tr.getAttribute("data-q");
    });

    render();
  }

  // ===== PÁGINA: DETALHE ==================================================
  function initDetalhe() {
    var params = new URLSearchParams(location.search);
    var num = +params.get("q") || 1;
    var q = QUESTOES.find(function (x) { return x.numero === num; });
    var root = el("#detalhe");
    if (!q) { root.innerHTML = '<div class="empty">Questão não encontrada.</div>'; return; }
    document.title = q.codigo + " · ENEM CN — Edições Não Regulares";

    var mesmaHab = QUESTOES.filter(function (x) { return x.habilidade === q.habilidade; });
    var idx = mesmaHab.findIndex(function (x) { return x.numero === q.numero; });
    var prev = QUESTOES.find(function (x) { return x.numero === q.numero - 1; });
    var next = QUESTOES.find(function (x) { return x.numero === q.numero + 1; });

    var gab = q.gabarito
      ? '<div class="gabarito-box"><span class="gab-letter">' + q.gabarito + "</span>" +
        '<div><div style="font-weight:600">Alternativa correta</div>' +
        '<div style="color:var(--muted);font-size:.85rem">Gabarito oficial (microdados INEP)</div></div></div>'
      : '<div class="pill-note">Item sem gabarito válido (anulado ou de convergência).</div>';

    root.innerHTML =
      '<div class="detail-nav">' +
        (prev ? '<a class="btn" href="questao.html?q=' + prev.numero + '">← ' + prev.codigo + "</a>" : "<span></span>") +
        '<a class="btn" href="index.html">Voltar à busca</a>' +
        (next ? '<a class="btn" href="questao.html?q=' + next.numero + '">' + next.codigo + " →</a>" : "<span></span>") +
      "</div>" +
      '<div class="detail-grid">' +
        '<div class="card">' +
          "<h2>" + q.codigo + " · Habilidade " + q.habilidade + " " + tierHtml(q) + "</h2>" +
          '<p style="color:var(--muted);margin-top:0">' + q.habilidade_descricao + "</p>" +
          '<div class="enunciado">' + (q.enunciado || "Enunciado não disponível nesta extração.") + "</div>" +
        "</div>" +
        "<div>" +
          '<div class="card" style="margin-bottom:1.25rem">' +
            "<h2>Gabarito</h2>" + gab +
          "</div>" +
          '<div class="card">' +
            "<h2>Ficha do item</h2>" +
            '<ul class="meta-list">' +
              li("Código", q.codigo) +
              li("Aplicação", q.aplicacao) +
              li("Ano", q.ano) +
              li("Área", '<span class="badge ' + areaClass(q.area) + '">' + q.area + "</span>") +
              li("Competência", "C" + q.competencia) +
              li("Habilidade", "H" + q.habilidade) +
              li("Dificuldade (b)", fmtB(q)) +
              li("Nível", q.tier ? q.tier.icone + " " + q.tier.rotulo : "—") +
              li("Na habilidade", (idx + 1) + " de " + mesmaHab.length) +
            "</ul>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="card" style="margin-top:1.25rem"><h2>Competência ' + q.competencia + "</h2>" +
        '<p style="color:var(--muted);margin:0">' + q.competencia_descricao + "</p></div>";
  }
  function li(k, v) { return '<li><span class="k">' + k + '</span><span class="v">' + v + "</span></li>"; }

  // ===== PÁGINA: PAINEL ANALÍTICO ========================================
  function initPainel() {
    // KPIs
    el("#kpis").innerHTML = [
      kpi(STATS.total, "Questões"),
      kpi(STATS.dificuldade_media.toString().replace(".", ","), "Dificuldade média (b)"),
      kpi(STATS.desvio_padrao.toString().replace(".", ","), "Desvio-padrão"),
      kpi(STATS.b_min.toString().replace(".", ",") + "–" + STATS.b_max.toString().replace(".", ","), "Faixa de b"),
      kpi(STATS.validas_tri, "Com parâmetro b"),
      kpi(STATS.anuladas, "Anuladas / convergência")
    ].join("");

    var tierColors = { "Muito fácil": "var(--t1)", "Fácil": "var(--t2)", "Mediana": "var(--t3)", "Difícil": "var(--t4)", "Muito difícil": "var(--t5)" };
    barPanel("#p-tier", STATS.por_tier.map(function (r) {
      return { lab: r.rotulo, val: r.total, color: tierColors[r.rotulo] };
    }));
    barPanel("#p-comp", STATS.por_competencia.map(function (r) {
      return { lab: "C" + r.competencia, val: r.total };
    }));
    barPanel("#p-area", STATS.por_area.map(function (r) { return { lab: r.area, val: r.total }; }));
    barPanel("#p-edicao", STATS.por_edicao.map(function (r) { return { lab: r.aplicacao, val: r.total }; }));
    barPanel("#p-ano", STATS.por_ano.map(function (r) { return { lab: r.ano, val: r.total }; }));
    barPanel("#p-hab", STATS.por_habilidade.map(function (r) {
      return { lab: "H" + r.habilidade, val: r.total };
    }));
    // dificuldade média por habilidade
    var maxDif = Math.max.apply(null, STATS.por_habilidade.map(function (r) { return r.dificuldade_media || 0; }));
    barPanel("#p-hab-dif", STATS.por_habilidade.map(function (r) {
      return { lab: "H" + r.habilidade, val: r.dificuldade_media || 0, display: (r.dificuldade_media || 0).toString().replace(".", ","), max: maxDif };
    }));
  }
  function kpi(n, l) { return '<div class="kpi"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
  function barPanel(sel, rows) {
    var target = el(sel);
    if (!target) return;
    var max = Math.max.apply(null, rows.map(function (r) { return r.max || r.val; }));
    target.innerHTML = rows.map(function (r) {
      var pct = max ? Math.round((r.val / (r.max || max)) * 100) : 0;
      var color = r.color || "var(--brand)";
      return '<div class="bar-row"><span class="lab">' + r.lab + "</span>" +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct + "%;background:" + color + '"></span></span>' +
        '<span class="val">' + (r.display != null ? r.display : r.val) + "</span></div>";
    }).join("");
  }

  // ===== PÁGINA: PAINEL OFICIAL (MICRODADOS) =============================
  function initPainelOficial() {
    var M = window.ENEM_MICRO;
    if (!M) { el("#mic-root").innerHTML = '<div class="empty">Microdados não carregados.</div>'; return; }
    var ITENS = M.itens;
    var anos = M.meta.anos;
    var tierColors = { "Muito fácil": "var(--t1)", "Fácil": "var(--t2)", "Mediana": "var(--t3)", "Difícil": "var(--t4)", "Muito difícil": "var(--t5)" };

    // filtro de anos (chips) — padrão: 2020–2025
    var padrao = anos.filter(function (a) { return a >= 2020; });
    var chips = el("#mic-anos");
    var sel = {};
    anos.forEach(function (a) {
      sel[a] = padrao.indexOf(a) !== -1;
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (sel[a] ? " on" : "");
      b.textContent = a;
      b.addEventListener("click", function () { sel[a] = !sel[a]; b.classList.toggle("on"); render(); });
      chips.appendChild(b);
    });

    function media(arr) { return arr.length ? arr.reduce(function (s, x) { return s + x; }, 0) / arr.length : 0; }
    function br(n, d) { return d == null ? n : n.toFixed(d).replace(".", ","); }

    function render() {
      var anosSel = anos.filter(function (a) { return sel[a]; });
      var itens = ITENS.filter(function (x) { return sel[x.ano]; });
      var comB = itens.filter(function (x) { return x.b_enem != null; });
      var bs = comB.map(function (x) { return x.b_enem; });
      var as_ = itens.filter(function (x) { return x.a != null; }).map(function (x) { return x.a; });
      var cs = itens.filter(function (x) { return x.c != null; }).map(function (x) { return x.c; });
      var m = media(bs);
      var dp = Math.sqrt(media(bs.map(function (b) { return (b - m) * (b - m); })));

      el("#mic-scope").textContent = anosSel.length
        ? "Baseado nos " + itens.length + " itens de CN dos microdados do ENEM (" +
          (anosSel.length === 1 ? anosSel[0] : Math.min.apply(null, anosSel) + "–" + Math.max.apply(null, anosSel)) +
          "), com parâmetros oficiais da TRI."
        : "Selecione ao menos um ano.";

      el("#mic-kpis").innerHTML = [
        kpi(itens.length, "Itens oficiais"),
        kpi(bs.length ? Math.round(m) : "—", "Dificuldade média (ENEM)"),
        kpi(as_.length ? br(media(as_), 2) : "—", "Discriminação a média"),
        kpi(cs.length ? br(media(cs), 2) : "—", "Acerto ao acaso c médio")
      ].join("");

      // por ano
      var porAno = {};
      itens.forEach(function (x) { porAno[x.ano] = (porAno[x.ano] || 0) + 1; });
      barPanel("#mic-ano", anosSel.map(function (a) { return { lab: a, val: porAno[a] || 0 }; }));

      // faixa de dificuldade
      var ordem = ["Muito fácil", "Fácil", "Mediana", "Difícil", "Muito difícil"];
      var porTier = {};
      comB.forEach(function (x) { porTier[x.tier.rotulo] = (porTier[x.tier.rotulo] || 0) + 1; });
      barPanel("#mic-tier", ordem.map(function (t) { return { lab: t, val: porTier[t] || 0, color: tierColors[t] }; }));

      // gabarito
      var porGab = {};
      itens.forEach(function (x) { if ("ABCDE".indexOf(x.gabarito) !== -1) porGab[x.gabarito] = (porGab[x.gabarito] || 0) + 1; });
      barPanel("#mic-gab", "ABCDE".split("").map(function (g) { return { lab: g, val: porGab[g] || 0 }; }));

      // por habilidade (contagem) + dificuldade média por habilidade
      var cont = {}, bhab = {};
      itens.forEach(function (x) { if (x.habilidade) cont[x.habilidade] = (cont[x.habilidade] || 0) + 1; });
      comB.forEach(function (x) { if (x.habilidade) { (bhab[x.habilidade] = bhab[x.habilidade] || []).push(x.b_enem); } });
      var habs = [];
      for (var h = 1; h <= 30; h++) habs.push(h);
      barPanel("#mic-hab", habs.map(function (h) { return { lab: "Habilidade " + h, val: cont[h] || 0 }; }));
      var maxDif = Math.max.apply(null, habs.map(function (h) { return bhab[h] ? media(bhab[h]) : 0; }));
      barPanel("#mic-hab-dif", habs.map(function (h) {
        var v = bhab[h] ? Math.round(media(bhab[h])) : 0;
        return { lab: "Habilidade " + h, val: v, display: v || "—", max: maxDif };
      }));
    }
    render();
  }

  // ---- router ------------------------------------------------------------
  var page = document.body.getAttribute("data-page");
  if (page === "busca") initBusca();
  else if (page === "detalhe") initDetalhe();
  else if (page === "painel") initPainel();
  else if (page === "painel-oficial") initPainelOficial();
})();
