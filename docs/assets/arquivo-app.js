/* Arquivo CN — app logic for the unified 1.027-question archive.
   Data: window.ARQUIVO_CN = {meta, questoes[]}.  State: localStorage. */
(function () {
  "use strict";
  var DATA = window.ARQUIVO_CN || { meta: {}, questoes: [] };
  var Q = DATA.questoes || [];
  var byId = {};
  Q.forEach(function (q) { byId[q.id] = q; });

  /* ---------- persistent state ---------- */
  var KEY = "arquivo.cn.v1";
  var S = load();
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) {}
    return { respostas: {}, favoritos: {}, notas: {}, sessoes: [], tempos: {}, desenhos: {} };
  }
  function migrate(s) {
    s.respostas = s.respostas || {};
    s.favoritos = s.favoritos || {};
    s.notas = s.notas || {};
    s.sessoes = s.sessoes || [];
    s.tempos = s.tempos || {};     // { id: segundos acumulados }
    s.desenhos = s.desenhos || {}; // { id: [ {cor, pts:[[x,y,p],...]} ] }  (coords normalizadas 0..1)
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmtB(b) { if (b == null || b === "") return "—"; var n = parseFloat(b); return isNaN(n) ? "—" : n.toFixed(0).replace(".", ","); }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function uniq(arr) { return Array.from(new Set(arr)); }
  function difBucket(b) {
    var n = parseFloat(b);
    if (isNaN(n)) return "Sem TRI";
    if (n < 450) return "Muito fácil";
    if (n < 550) return "Fácil";
    if (n < 650) return "Médio";
    if (n < 750) return "Difícil";
    return "Muito difícil";
  }
  var DIF_ORDER = ["Muito fácil", "Fácil", "Médio", "Difícil", "Muito difícil", "Sem TRI"];

  // Render text into `node`, rendering $...$ / $$...$$ segments with KaTeX.
  function mathify(node, text) {
    node.textContent = "";
    if (!text) return;
    if (!window.katex || text.indexOf("$") < 0) { node.textContent = text; return; }
    var re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement("span");
      try { katex.render(m[1] || m[2], span, { throwOnError: false, displayMode: !!m[1] }); }
      catch (e) { span.textContent = m[0]; }
      node.appendChild(span);
      last = re.lastIndex;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  /* ---------- navigation ---------- */
  var views = {};
  document.querySelectorAll(".view").forEach(function (v) { views[v.id.replace("v-", "")] = v; });
  var tabBtns = document.querySelectorAll("#tabs button");
  function go(name) {
    tabBtns.forEach(function (b) { b.classList.toggle("on", b.dataset.v === name); });
    Object.keys(views).forEach(function (k) { views[k].classList.toggle("on", k === name); });
    if (name === "painel") renderPainel();
    if (name === "banco") renderBanco();
    if (name === "estudar") renderStudy();
    if (name === "erros") renderErros();
    if (name === "favoritos") renderFav();
    window.scrollTo(0, 0);
  }
  tabBtns.forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.v); }); });

  /* ---------- question card renderer ---------- */
  function card(q, opts) {
    opts = opts || {};
    var c = el("div", "qcard");
    c.dataset.id = q.id;

    var meta = el("div", "qmeta");
    if (q.numero_disciplina) meta.appendChild(el("span", "qnum", "Nº " + q.numero_disciplina));
    meta.appendChild(tag(q.materia, "klein"));
    meta.appendChild(tag(q.banco === "PPL" ? "PPL" : "Regular", q.banco === "PPL" ? "ppl" : ""));
    if (q.ano) meta.appendChild(tag("ENEM " + q.ano));
    if (q.aplicacao && q.aplicacao !== q.banco) meta.appendChild(tag(q.aplicacao));
    if (q.habilidade) meta.appendChild(tag("H" + q.habilidade));
    if (q.competencia) meta.appendChild(tag("C" + q.competencia));
    meta.appendChild(tag("TRI " + fmtB(q.b) + " · " + difBucket(q.b)));
    if (q.aula) meta.appendChild(tag(q.aula));
    if (q.anulada) meta.appendChild(tag("ANULADA"));
    if (q.resolvida_aula) meta.appendChild(tag("resolvida na aula", "klein"));
    c.appendChild(meta);

    var body = el("div", "qbody");
    if (q.enunciado && q.enunciado.trim()) {
      mathify(body, q.enunciado);
    } else {
      body.className = "qbody vazio";
      body.textContent = "Enunciado não disponível neste banco — item oficial sem texto extraído. Metadados e gabarito abaixo.";
    }
    c.appendChild(body);

    (q.imagens || []).forEach(function (src, i) {
      var img = new Image();
      img.className = "qfig";
      img.loading = "lazy";
      img.src = src;
      img.alt = "Figura oficial " + (i + 1) + " da questão" + (q.ano ? " · ENEM " + q.ano : "");
      img.onerror = function () { img.remove(); };
      c.appendChild(img);
    });

    var answered = S.respostas[q.id];
    var podeResponder = !!q.gabarito && !q.anulada;
    var foot;

    if (q.banco === "Regular" && q.alternativas && q.alternativas.length) {
      var ul = el("ul", "alts");
      q.alternativas.forEach(function (a) {
        var li = el("li");
        li.dataset.letra = a.letra;
        li.appendChild(el("span", "lt", a.letra));
        var tx = el("span", "tx"); mathify(tx, a.texto); li.appendChild(tx);
        ul.appendChild(li);
        if (podeResponder) {
          li.addEventListener("click", function () {
            if (li.classList.contains("locked")) return;
            record(q, a.letra, opts, function (esc) { lockAlts(q, ul, esc); }, foot);
          });
        } else {
          li.classList.add("locked");
        }
      });
      c.appendChild(ul);
      foot = qfoot(q, opts, function () { rerenderCard(c, q, opts); });
      c.appendChild(foot);
      if (answered) lockAlts(q, ul, answered.escolha);
    } else {
      var msg = podeResponder
        ? "Banco PPL: as alternativas aparecem ao final do enunciado acima. Escolha a letra correspondente para responder."
        : (q.anulada ? "Questão anulada — sem resposta a registrar." : "Item sem gabarito oficial disponível.");
      c.appendChild(el("div", "ppl-alts", msg));
      var lr = el("div", "letters");
      ["A", "B", "C", "D", "E"].forEach(function (L) {
        var bt = el("button", "letter", L);
        bt.dataset.letra = L;
        lr.appendChild(bt);
        if (podeResponder) {
          bt.addEventListener("click", function () {
            if (lr.classList.contains("locked")) return;
            record(q, L, opts, function (esc) { lockLetters(q, lr, esc); }, foot);
          });
        }
      });
      if (!podeResponder) lr.classList.add("locked");
      c.appendChild(lr);
      foot = qfoot(q, opts, function () { rerenderCard(c, q, opts); });
      c.appendChild(foot);
      if (answered) lockLetters(q, lr, answered.escolha);
    }
    return c;
  }

  function rerenderCard(oldCard, q, opts) {
    var fresh = card(q, opts);
    if (oldCard.parentNode) oldCard.parentNode.replaceChild(fresh, oldCard);
  }

  function tag(txt, cls) { var t = el("span", "tag" + (cls ? " " + cls : ""), txt); return t; }

  function qfoot(q, opts, onRetry) {
    var f = el("div", "qfoot");
    var star = el("button", "star" + (S.favoritos[q.id] ? " on" : ""), (S.favoritos[q.id] ? "★ favorito" : "☆ favoritar"));
    star.addEventListener("click", function () {
      if (S.favoritos[q.id]) delete S.favoritos[q.id]; else S.favoritos[q.id] = 1;
      save();
      star.classList.toggle("on"); star.textContent = S.favoritos[q.id] ? "★ favorito" : "☆ favoritar";
    });
    f.appendChild(star);

    var rev = el("button", "btn sm ghost", "Ver gabarito");
    var revOut = el("span", "reveal");
    var answered = S.respostas[q.id];
    if (answered || !q.gabarito || q.anulada) { showGab(q, revOut); rev.style.display = "none"; }
    rev.addEventListener("click", function () { showGab(q, revOut); rev.style.display = "none"; });
    f.appendChild(rev);
    f.appendChild(revOut);

    if (answered && onRetry) {
      var retry = el("button", "btn sm ghost", "Responder novamente");
      retry.addEventListener("click", function () {
        delete S.respostas[q.id]; save(); onRetry();
      });
      f.appendChild(retry);
    }

    var noteBtn = el("button", "btn sm ghost", S.notas[q.id] ? "Editar anotação" : "Anotar");
    var noteBox = el("textarea", "note");
    noteBox.placeholder = "Sua anotação sobre esta questão…";
    noteBox.value = S.notas[q.id] || "";
    noteBox.style.display = S.notas[q.id] ? "block" : "none";
    noteBtn.addEventListener("click", function () {
      noteBox.style.display = noteBox.style.display === "none" ? "block" : "none";
      if (noteBox.style.display === "block") noteBox.focus();
    });
    noteBox.addEventListener("input", function () {
      if (noteBox.value.trim()) S.notas[q.id] = noteBox.value; else delete S.notas[q.id];
      save();
      noteBtn.textContent = S.notas[q.id] ? "Editar anotação" : "Anotar";
    });
    f.appendChild(noteBtn);

    var temDesenho = S.desenhos[q.id] && S.desenhos[q.id].length;
    var drawBtn = el("button", "btn-draw" + (temDesenho ? " has" : ""), "✎ Explicação ativa");
    drawBtn.addEventListener("click", function () { openDraw(q, drawBtn); });
    f.insertBefore(drawBtn, noteBtn.nextSibling);

    f.appendChild(noteBox);
    return f;
  }

  function showGab(q, out) {
    out.innerHTML = "";
    if (q.anulada) {
      out.appendChild(el("span", "g", "Questão anulada pelo INEP — sem gabarito válido."));
      return;
    }
    if (!q.gabarito) {
      out.appendChild(el("span", "g", "Gabarito oficial não disponível."));
      return;
    }
    out.appendChild(document.createTextNode("Gabarito oficial: "));
    out.appendChild(el("span", "g", q.gabarito));
    if (q.nivel) out.appendChild(document.createTextNode("  ·  " + q.nivel));
  }

  function lockAlts(q, ul, escolha) {
    ul.querySelectorAll("li").forEach(function (li) {
      li.classList.add("locked");
      var L = li.dataset.letra;
      if (L === q.gabarito) li.classList.add("correct");
      else if (L === escolha) li.classList.add("wrong");
    });
  }

  function lockLetters(q, lr, escolha) {
    lr.classList.add("locked");
    lr.querySelectorAll(".letter").forEach(function (bt) {
      var L = bt.dataset.letra;
      if (L === q.gabarito) bt.classList.add("correct");
      else if (L === escolha) bt.classList.add("wrong");
    });
  }

  function record(q, letra, opts, lockFn, foot) {
    if (!q.gabarito || q.anulada) return;
    var correta = letra === q.gabarito;
    S.respostas[q.id] = { escolha: letra, correta: correta, ts: Date.now() };
    save();
    lockFn(letra);
    if (foot) {
      var rev = foot.querySelector(".reveal");
      if (rev) showGab(q, rev);
      var rb = foot.querySelector(".btn.ghost");
      if (rb && rb.textContent === "Ver gabarito") rb.style.display = "none";
    }
    if (opts.onAnswer) opts.onAnswer(correta);
  }

  /* ---------- PAINEL ---------- */
  function renderPainel() {
    var cs = document.getElementById("cover-stats");
    if (cs && !cs.childElementCount) {
      var mats = ["Biologia", "Química", "Física"];
      mats.forEach(function (m) {
        var n = Q.filter(function (q) { return q.materia === m; }).length;
        var box = el("div", "cover-stat"); box.appendChild(el("div", "n", String(n))); box.appendChild(el("div", "l", m)); cs.appendChild(box);
      });
      [["Regular", Q.filter(function (q) { return q.banco === "Regular"; }).length],
       ["PPL", Q.filter(function (q) { return q.banco === "PPL"; }).length]].forEach(function (pr) {
        var box = el("div", "cover-stat"); box.appendChild(el("div", "n", String(pr[1]))); box.appendChild(el("div", "l", "Banco " + pr[0])); cs.appendChild(box);
      });
    }
    var respIds = Object.keys(S.respostas);
    var respondiveis = Q.filter(function (q) { return q.gabarito && !q.anulada; }).length;
    var done = respIds.length;
    var acertos = respIds.filter(function (id) { return S.respostas[id].correta; }).length;
    var favs = Object.keys(S.favoritos).length;

    var kpis = document.getElementById("kpis");
    kpis.innerHTML = "";
    kpis.appendChild(kpi(done + " / " + respondiveis, "questões respondidas", true));
    kpis.appendChild(kpi(pct(done, respondiveis) + "%", "do arquivo concluído"));
    kpis.appendChild(kpi(done ? pct(acertos, done) + "%" : "—", "taxa de acerto"));
    kpis.appendChild(kpi(String(favs), "favoritadas"));

    var mats = ["Biologia", "Química", "Física"];
    var bm = document.getElementById("by-materia"); bm.innerHTML = "";
    mats.forEach(function (m) {
      // denominador = itens respondíveis (exclui anuladas/sem gabarito) p/ chegar a 100%
      var all = Q.filter(function (q) { return q.materia === m && q.gabarito && !q.anulada; });
      var d = all.filter(function (q) { return S.respostas[q.id]; }).length;
      bm.appendChild(barRow(m, d, all.length));
    });

    var bd = document.getElementById("by-dif"); bd.innerHTML = "";
    DIF_ORDER.forEach(function (lvl) {
      var ans = Q.filter(function (q) { return difBucket(q.b) === lvl && S.respostas[q.id]; });
      if (!ans.length) { if (lvl === "Sem TRI") return; }
      var ac = ans.filter(function (q) { return S.respostas[q.id].correta; }).length;
      bd.appendChild(barRow(lvl, ac, ans.length, ans.length ? pct(ac, ans.length) + "% (" + ac + "/" + ans.length + ")" : "sem respostas"));
    });

    var bb = document.getElementById("by-banco"); bb.innerHTML = "";
    ["Regular", "PPL"].forEach(function (bk) {
      var all = Q.filter(function (q) { return q.banco === bk && q.gabarito && !q.anulada; });
      var d = all.filter(function (q) { return S.respostas[q.id]; }).length;
      bb.appendChild(barRow(bk + " (" + all.length + " respondíveis)", d, all.length));
    });

    var ss = document.getElementById("sessoes"); ss.innerHTML = "";
    if (!S.sessoes.length) { ss.appendChild(el("div", "count", "Nenhuma sessão ainda. Use \"Estudar estes\" no Banco.")); }
    else {
      S.sessoes.slice(-6).reverse().forEach(function (s) {
        var line = el("div", "bar");
        var when = new Date(s.fim || s.inicio);
        line.appendChild(el("span", "lab", when.toLocaleDateString("pt-BR") + " " + when.toLocaleTimeString("pt-BR").slice(0, 5)));
        var tr = el("span", "track"); var fl = el("span", "fill"); fl.style.width = pct(s.acertos, s.total) + "%"; tr.appendChild(fl); line.appendChild(tr);
        line.appendChild(el("span", "val", s.acertos + "/" + s.total));
        ss.appendChild(line);
      });
    }
  }
  function kpi(n, l, klein) { var k = el("div", "kpi" + (klein ? " klein" : "")); k.appendChild(el("div", "n", n)); k.appendChild(el("div", "l", l)); return k; }
  function barRow(lab, a, b, valTxt) {
    var row = el("div", "bar");
    row.appendChild(el("span", "lab", lab));
    var tr = el("span", "track"); var fl = el("span", "fill"); fl.style.width = pct(a, b) + "%"; tr.appendChild(fl); row.appendChild(tr);
    row.appendChild(el("span", "val", valTxt || (a + "/" + b)));
    return row;
  }

  document.getElementById("exp-csv").addEventListener("click", exportCsv);
  document.getElementById("reset-all").addEventListener("click", function () {
    if (confirm("Zerar TODO o progresso (respostas, favoritos, anotações, tempos, lousas e sessões)?")) {
      S = { respostas: {}, favoritos: {}, notas: {}, sessoes: [], tempos: {}, desenhos: {} }; save(); renderPainel();
    }
  });
  var CSV_COLS = ["disciplina", "numero_arquivo", "numero_disciplina", "id_inep", "ano", "aplicacao",
    "banco", "area", "modelo", "competencia", "habilidade", "tri", "nivel",
    "resposta_marcada", "gabarito", "resultado", "tempo_segundos", "favorita", "nota"];
  function exportCsv() {
    var qs = Q.slice().sort(function (a, b) { return (a.numero_arquivo || 0) - (b.numero_arquivo || 0); });
    var rows = [CSV_COLS];
    qs.forEach(function (q) {
      var r = S.respostas[q.id];
      var idinep = (q.id.split("-").pop() || "");
      rows.push([
        q.materia, q.numero_arquivo || "", q.numero_disciplina || "", idinep, q.ano || "", q.aplicacao || "",
        q.banco || "", q.aula || "", q.modelo || "",
        q.competencia ? "C" + q.competencia : "", q.habilidade ? "H" + q.habilidade : "",
        fmtBcomma(q.b), nivelNumero(q),
        r ? r.escolha : "", q.gabarito || "",
        r ? (r.correta ? "Acertou" : "Errou") : "",
        S.tempos[q.id] != null ? S.tempos[q.id] : "",
        S.favoritos[q.id] ? "sim" : "não",
        S.notas[q.id] || ""
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { c = String(c == null ? "" : c); return '"' + c.replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "progresso_ciencias_da_natureza.csv"; a.click();
  }
  function fmtBcomma(b) { if (b == null || b === "") return ""; var n = parseFloat(b); return isNaN(n) ? "" : n.toFixed(1).replace(".", ","); }
  var NIVEL_MAP = { "Muito fácil": 1, "Fácil": 2, "Médio": 3, "Difícil": 4, "Muito difícil": 5 };
  function nivelNumero(q) {
    if (q.nivel && NIVEL_MAP[q.nivel]) return NIVEL_MAP[q.nivel];
    var n = parseFloat(q.b); if (isNaN(n)) return "";
    if (n < 550) return 1; if (n < 650) return 2; if (n < 750) return 3; if (n < 850) return 4; return 5;
  }

  /* ---------- BANCO ---------- */
  var F = { materia: "", banco: "", aula: "", ano: "", hab: "", dif: "", sit: "", ord: "ano", q: "" };
  var PAGE = 20, page = 0;
  function fillSelect(id, opts, first) {
    var s = document.getElementById(id); s.innerHTML = "";
    s.appendChild(new Option(first, ""));
    opts.forEach(function (o) { s.appendChild(new Option(o.l != null ? o.l : o, o.v != null ? o.v : o)); });
  }
  var filtersInit = false;
  function initFilters() {
    if (filtersInit) return; filtersInit = true;
    fillSelect("f-materia", ["Biologia", "Química", "Física"], "Todas");
    fillSelect("f-banco", ["Regular", "PPL"], "Todos");
    fillSelect("f-aula", uniq(Q.map(function (q) { return q.aula; })).filter(Boolean).sort(), "Todos");
    fillSelect("f-ano", uniq(Q.map(function (q) { return q.ano; })).filter(Boolean).sort(), "Todos");
    fillSelect("f-hab", uniq(Q.map(function (q) { return q.habilidade; })).filter(Boolean).sort(function (a, b) { return a - b; }).map(function (h) { return { l: "H" + h, v: h }; }), "Todas");
    fillSelect("f-dif", DIF_ORDER, "Todas");
    fillSelect("f-sit", [{ l: "Não respondidas", v: "novas" }, { l: "Respondidas", v: "feitas" }, { l: "Acertei", v: "ok" }, { l: "Errei", v: "erro" }, { l: "Favoritas", v: "fav" }, { l: "Anotadas", v: "nota" }], "Todas");
    fillSelect("f-ord", [{ l: "Ano ↑", v: "ano" }, { l: "Ano ↓", v: "-ano" }, { l: "Dificuldade ↑", v: "b" }, { l: "Dificuldade ↓", v: "-b" }, { l: "Matéria", v: "materia" }], "Ano ↑");
    var map = { "f-materia": "materia", "f-banco": "banco", "f-aula": "aula", "f-ano": "ano", "f-hab": "hab", "f-dif": "dif", "f-sit": "sit", "f-ord": "ord" };
    Object.keys(map).forEach(function (id) {
      document.getElementById(id).addEventListener("change", function (e) { F[map[id]] = e.target.value; page = 0; renderBancoList(); });
    });
    document.getElementById("f-q").addEventListener("input", function (e) { F.q = e.target.value.trim().toLowerCase(); page = 0; renderBancoList(); });
    document.getElementById("f-clear").addEventListener("click", function () {
      F = { materia: "", banco: "", aula: "", ano: "", hab: "", dif: "", sit: "", ord: "ano", q: "" };
      ["f-materia", "f-banco", "f-aula", "f-ano", "f-hab", "f-dif", "f-sit"].forEach(function (i) { document.getElementById(i).value = ""; });
      document.getElementById("f-ord").value = "ano"; document.getElementById("f-q").value = ""; page = 0; renderBancoList();
    });
    document.getElementById("study-filtered").addEventListener("click", function () { startStudy(applyFilters()); });
  }
  function applyFilters() {
    var list = Q.filter(function (q) {
      if (F.materia && q.materia !== F.materia) return false;
      if (F.banco && q.banco !== F.banco) return false;
      if (F.aula && q.aula !== F.aula) return false;
      if (F.ano && String(q.ano) !== F.ano) return false;
      if (F.hab && String(q.habilidade) !== F.hab) return false;
      if (F.dif && difBucket(q.b) !== F.dif) return false;
      if (F.q && (q.enunciado || "").toLowerCase().indexOf(F.q) < 0) return false;
      var r = S.respostas[q.id];
      if (F.sit === "novas" && r) return false;
      if (F.sit === "feitas" && !r) return false;
      if (F.sit === "ok" && !(r && r.correta)) return false;
      if (F.sit === "erro" && !(r && !r.correta)) return false;
      if (F.sit === "fav" && !S.favoritos[q.id]) return false;
      if (F.sit === "nota" && !S.notas[q.id]) return false;
      return true;
    });
    var o = F.ord;
    list.sort(function (a, b) {
      if (o === "ano") return (a.ano - b.ano) || (a.materia < b.materia ? -1 : 1);
      if (o === "-ano") return (b.ano - a.ano);
      if (o === "b") return (parseFloat(a.b || 0) - parseFloat(b.b || 0));
      if (o === "-b") return (parseFloat(b.b || 0) - parseFloat(a.b || 0));
      if (o === "materia") return (a.materia < b.materia ? -1 : a.materia > b.materia ? 1 : (a.ano - b.ano));
      return 0;
    });
    return list;
  }
  function renderBanco() { initFilters(); renderBancoList(); }
  function renderBancoList() {
    var list = applyFilters();
    document.getElementById("banco-count").textContent = list.length + " de " + Q.length + " questões";
    var box = document.getElementById("banco-list"); box.innerHTML = "";
    if (!list.length) { box.appendChild(el("div", "empty", "Nenhuma questão com esses filtros.")); document.getElementById("banco-pager").innerHTML = ""; return; }
    var start = page * PAGE, slice = list.slice(start, start + PAGE);
    slice.forEach(function (q) { box.appendChild(card(q, {})); });
    var pager = document.getElementById("banco-pager"); pager.innerHTML = "";
    var pages = Math.ceil(list.length / PAGE);
    if (pages > 1) {
      var prev = el("button", "btn sm ghost", "‹ anterior"); prev.disabled = page === 0;
      prev.addEventListener("click", function () { if (page > 0) { page--; renderBancoList(); window.scrollTo(0, 0); } });
      var info = el("span", "count", "página " + (page + 1) + " / " + pages);
      var next = el("button", "btn sm ghost", "próxima ›"); next.disabled = page >= pages - 1;
      next.addEventListener("click", function () { if (page < pages - 1) { page++; renderBancoList(); window.scrollTo(0, 0); } });
      pager.appendChild(prev); pager.appendChild(info); pager.appendChild(next);
    }
  }

  /* ---------- ESTUDAR ---------- */
  var study = null;
  function startStudy(list) {
    if (!list || !list.length) { alert("Selecione ao menos uma questão pelos filtros do Banco."); return; }
    study = { list: list.slice(), i: 0, acertos: 0, respondidas: 0, inicio: Date.now() };
    go("estudar"); renderStudy();
  }
  function renderStudy() {
    var body = document.getElementById("study-body"); body.innerHTML = "";
    if (!study) { body.appendChild(el("div", "empty", "Vá ao Banco, filtre as questões e clique em \"Estudar estes\".")); return; }
    if (study.i >= study.list.length) { finishStudy(body); return; }
    var q = study.list[study.i];

    var hd = el("div", "study-hd");
    hd.appendChild(el("div", "scoreline", "Questão " + (study.i + 1) + " de " + study.list.length));
    var pr = el("div", "prog"); var fl = el("span", "fill"); fl.style.width = pct(study.i, study.list.length) + "%"; pr.appendChild(fl); hd.appendChild(pr);
    hd.appendChild(el("div", "scoreline", "Acertos: " + study.acertos + "/" + study.respondidas));
    body.appendChild(hd);

    var answeredThis = { done: false };
    var tStart = Date.now();
    body.appendChild(card(q, {
      onAnswer: function (correta) {
        if (answeredThis.done) return; answeredThis.done = true;
        var secs = Math.round((Date.now() - tStart) / 1000);
        S.tempos[q.id] = (S.tempos[q.id] || 0) + secs;
        save();
        study.respondidas++; if (correta) study.acertos++;
        nextBtn.textContent = "Próxima questão ›"; nextBtn.classList.add("solid");
      }
    }));

    var pager = el("div", "pager");
    var skip = el("button", "btn sm ghost", "Pular");
    skip.addEventListener("click", advance);
    var nextBtn = el("button", "btn sm", "Próxima questão ›");
    if (study.list[study.i].banco === "PPL") nextBtn.classList.add("solid");
    nextBtn.addEventListener("click", advance);
    pager.appendChild(skip); pager.appendChild(nextBtn);
    body.appendChild(pager);
    window.scrollTo(0, 0);

    function advance() { study.i++; renderStudy(); }
  }
  function finishStudy(body) {
    if (study && study.respondidas > 0) {
      S.sessoes.push({ inicio: study.inicio, fim: Date.now(), total: study.respondidas, acertos: study.acertos });
      save();
    }
    var done = study ? study.respondidas : 0, ac = study ? study.acertos : 0;
    var box = el("div", "panel");
    box.appendChild(el("h3", null, "Sessão concluída"));
    box.appendChild(el("div", "kpi", ""));
    var line = el("p", null, "Você respondeu " + done + " questões e acertou " + ac + " (" + pct(ac, done) + "%). O resultado foi salvo no seu painel.");
    box.appendChild(line);
    var actions = el("div", "pager");
    var toBank = el("button", "btn sm solid", "Voltar ao Banco"); toBank.addEventListener("click", function () { study = null; go("banco"); });
    var toPan = el("button", "btn sm ghost", "Ver painel"); toPan.addEventListener("click", function () { study = null; go("painel"); });
    actions.appendChild(toPan); actions.appendChild(toBank);
    box.appendChild(actions);
    body.innerHTML = ""; body.appendChild(box);
  }

  /* ---------- ERROS ---------- */
  function renderErros() {
    var box = document.getElementById("erros-list"); box.innerHTML = "";
    var ids = Object.keys(S.respostas).filter(function (id) { return !S.respostas[id].correta && byId[id]; });
    if (!ids.length) { box.appendChild(el("div", "empty", "Nenhum erro registrado. Responda questões no Banco ou no modo Estudo.")); return; }
    ids.map(function (id) { return byId[id]; }).forEach(function (q) { box.appendChild(card(q, {})); });
  }

  /* ---------- FAVORITOS ---------- */
  function renderFav() {
    var box = document.getElementById("fav-list"); box.innerHTML = "";
    var ids = Object.keys(S.favoritos).filter(function (id) { return byId[id]; });
    if (!ids.length) { box.appendChild(el("div", "empty", "Nenhuma questão favoritada. Use a estrela em qualquer questão.")); return; }
    ids.map(function (id) { return byId[id]; }).forEach(function (q) { box.appendChild(card(q, {})); });
  }

  /* ==========================================================================
     EXPLICAÇÃO ATIVA — Apple Pencil / mouse / toque
     Melhorias v2:
       1. touch-action seletivo: dedo faz scroll; só caneta (pen) ou mouse desenha
       2. desynchronized:true no contexto 2d → latência mínima (sem esperar vsync)
       3. Pressão real do Apple Pencil via e.pressure (PointerEvents)
       4. Largura base maior (3px) + curva de pressão mais expressiva
       5. Palm rejection reforçada: window on touchstart cancela toque de dedo
          enquanto caneta está ativa ou nos 800 ms seguintes
       6. Borracha ativa na ponta traseira do Pencil (pointerType==='pen' && buttons===32)
       7. Interpolação quadrática dos pontos para traço mais suave
       8. willReadFrequently:false e will-change:transform via JS no canvas
     ========================================================================== */
  var draw = (function () {
    var modal    = document.getElementById("draw-modal");
    var canvas   = document.getElementById("draw-canvas");
    // Contexto 2D padrão: no Safari do iPad o modo dessynchronized costuma
    // renderizar os traços de forma inconsistente (some/pisca), então usamos
    // o contexto normal — confiável acima de tudo.
    var ctx      = canvas.getContext("2d");
    var titleEl  = document.getElementById("draw-title");
    var countEl  = document.getElementById("draw-count");
    var savedEl  = document.getElementById("draw-saved");
    // Insere a caneta vermelha sem exigir alteração no HTML legado/PWA.
    var azulBtn = modal.querySelector(".draw-tool[data-tool='azul']");
    if (azulBtn && !modal.querySelector(".draw-tool[data-tool='vermelho']")) {
      var vermelhoBtn = document.createElement("button");
      vermelhoBtn.className = "draw-tool";
      vermelhoBtn.dataset.tool = "vermelho";
      vermelhoBtn.textContent = "Traço vermelho";
      azulBtn.insertAdjacentElement("afterend", vermelhoBtn);

      var vermelhoCss = document.createElement("style");
      vermelhoCss.textContent = ".draw-tool[data-tool='vermelho']{color:#c0182b}.draw-tool[data-tool='vermelho'].on{background:#c0182b;color:#fff}";
      document.head.appendChild(vermelhoCss);
    }

    var toolBtns = modal.querySelectorAll(".draw-tool[data-tool='preto'],.draw-tool[data-tool='azul'],.draw-tool[data-tool='vermelho'],.draw-tool[data-tool='borracha']");

    // will-change evita re-composite do resto da página a cada frame de desenho
    canvas.style.willChange = "transform";

    var cor = "preto", strokes = [], cur = null, drawing = false;
    var qref = null, btnRef = null, openedAt = 0;
    var activePointerId = null;
    var lastPenAt = 0;          // timestamp do último evento pointerType==='pen'
    var penIsActive = false;    // true enquanto o lápis está em contato

    var BASE_W    = 1.6;        // espessura base (px lógicos) — mouse/toque; fina para caligrafia
    var PEN_MIN   = 0.5;        // fator mínimo de pressão para o Pencil (~0,8 px)
    var PEN_MAX   = 1.6;        // fator máximo de pressão para o Pencil (~2,6 px)
    var PALM_HOLD = 800;        // ms de bloqueio de toque após evento de caneta

    var COLORS = { preto: "#0a0a0a", azul: "#002FA7", vermelho: "#c0182b" };

    var bgImg  = null;  // figura oficial como fundo
    var bgRect = null;

    // ── touch-action: none SEMPRE ──
    // A lousa é um modal de tela cheia (position:fixed;inset:0) — não há nada
    // para rolar atrás dela. Trocar touch-action no meio do gesto faz o Safari
    // cancelar o traço da caneta (ele decide rolar-ou-desenhar no INÍCIO do
    // gesto). Com 'none' fixo, a Apple Pencil desenha de forma confiável.
    canvas.style.touchAction = "none";

    /* ── fit / redraw ── */
    function fit() {
      var r   = canvas.parentNode.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.max(1, Math.round(r.width  * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function redraw() {
      var r = canvas.parentNode.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      if (bgImg && bgImg.complete && bgImg.naturalWidth) {
        var iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
        var scale = Math.min(r.width / iw, r.height / ih) * 0.94;
        var w = iw * scale, h = ih * scale;
        var x = (r.width - w) / 2, y = (r.height - h) / 2;
        bgRect = { x: x, y: y, w: w, h: h };
        ctx.drawImage(bgImg, x, y, w, h);
      } else {
        bgRect = null;
      }
      strokes.forEach(function (s) { paint(s, r); });
      countEl.textContent = strokes.length + (strokes.length === 1 ? " traço" : " traços");
    }

    /* ── paint ──
       Cada segmento é traçado separadamente (beginPath/stroke próprios) porque
       ctx.lineWidth só é aplicado no momento do stroke() — variar a largura DENTRO
       de um único path não funciona. Assim a pressão da Apple Pencil realmente
       muda a espessura ponto a ponto. Curva quadrática pelos pontos médios suaviza. */
    function paint(s, r) {
      var pts = s.pts;
      if (!pts.length) return;
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.strokeStyle = COLORS[s.cor] || "#0a0a0a";
      ctx.fillStyle = ctx.strokeStyle;

      if (pts.length === 1) {
        var o = pts[0], pw = penWidth(o[2]);
        ctx.beginPath();
        ctx.arc(o[0] * r.width, o[1] * r.height, pw / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var pr = (a[2] != null && b[2] != null) ? (a[2] + b[2]) / 2 : (b[2] != null ? b[2] : a[2]);
        ctx.lineWidth = penWidth(pr);
        // ponto de partida = média com o ponto anterior (suaviza junções)
        var prev = pts[i - 2] || a;
        var m1x = (prev[0] + a[0]) / 2, m1y = (prev[1] + a[1]) / 2;
        var m2x = (a[0] + b[0]) / 2, m2y = (a[1] + b[1]) / 2;
        ctx.beginPath();
        ctx.moveTo(m1x * r.width, m1y * r.height);
        ctx.quadraticCurveTo(a[0] * r.width, a[1] * r.height, m2x * r.width, m2y * r.height);
        ctx.stroke();
      }
    }

    function penWidth(pressure) {
      if (pressure != null && pressure > 0) {
        // curva de pressão: raiz quadrada suaviza extremos
        return BASE_W * (PEN_MIN + (PEN_MAX - PEN_MIN) * Math.sqrt(pressure));
      }
      return BASE_W;
    }

    /* ── pos(): normaliza coordenada e lê pressão ── */
    function pos(e) {
      var r   = canvas.getBoundingClientRect();
      // pressure > 0 só é confiável para pointerType 'pen'
      var pr  = (e.pointerType === "pen" && e.pressure > 0) ? e.pressure : null;
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, pr];
    }

    /* ── borracha ── */
    function hitErase(p) {
      var before = strokes.length;
      strokes = strokes.filter(function (s) {
        return !s.pts.some(function (pt) {
          return Math.hypot(pt[0] - p[0], pt[1] - p[1]) < 0.025;
        });
      });
      if (strokes.length !== before) redraw();
    }

    /* ── detecção de ponta traseira do Pencil (eraser button, buttons===32) ── */
    function isEraserTip(e) {
      return e.pointerType === "pen" && (e.buttons & 32) !== 0;
    }

    /* ── handlers de pointer ── */
    function start(e) {
      // Ignorar toque de dedo durante/após uso da caneta (palm rejection)
      if (e.pointerType === "touch" && (penIsActive || Date.now() - lastPenAt < PALM_HOLD)) return;
      // Só um ponteiro ativo por vez
      if (activePointerId != null && e.pointerId !== activePointerId) return;

      e.preventDefault();
      activePointerId = e.pointerId;

      if (e.pointerType === "pen") { penIsActive = true; lastPenAt = Date.now(); }

      try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) {}

      var p = pos(e);
      var toolAgora = isEraserTip(e) ? "borracha" : cor;

      if (toolAgora === "borracha") {
        drawing = true; hitErase(p); return;
      }
      drawing = true;
      cur = { cor: cor, pts: [p] };
      strokes.push(cur);
    }

    function move(e) {
      if (!drawing || e.pointerId !== activePointerId) return;
      e.preventDefault();
      if (e.pointerType === "pen") lastPenAt = Date.now();

      var toolAgora = isEraserTip(e) ? "borracha" : cor;

      // getCoalescedEvents entrega todos os pontos intermediários desde o último
      // frame — essencial para traços suaves com o Pencil em alta velocidade
      var coalesced = e.getCoalescedEvents && e.getCoalescedEvents();
      var pts = (coalesced && coalesced.length) ? coalesced : [e];

      pts.forEach(function (ev) {
        var p = pos(ev);
        if (toolAgora === "borracha") { hitErase(p); }
        else if (cur) { cur.pts.push(p); }
      });
      redraw();
    }

    function end(e) {
      if (e && e.pointerId !== activePointerId) return;
      if (e && e.pointerType === "pen") { penIsActive = false; lastPenAt = Date.now(); }
      activePointerId = null;
      if (!drawing) return;
      drawing = false; cur = null;
      persist();
    }

    /* ── palm rejection extra: cancela touchstart de dedo durante caneta ── */
    canvas.addEventListener("touchstart", function (e) {
      if (penIsActive || Date.now() - lastPenAt < PALM_HOLD) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    /* ── persist / save ── */
    function persist() {
      if (!qref) return;
      if (strokes.length) S.desenhos[qref.id] = strokes; else delete S.desenhos[qref.id];
      save();
      savedEl.textContent = "Salvo";
      if (btnRef) btnRef.classList.toggle("has", !!strokes.length);
      setTimeout(function () { savedEl.textContent = ""; }, 1200);
    }

    /* ── ferramentas ── */
    function setTool(t) {
      if (t === "desfazer") { strokes.pop(); redraw(); persist(); return; }
      if (t === "limpar")   { strokes = []; redraw(); persist(); return; }
      cor = t;
      toolBtns.forEach(function (b) { b.classList.toggle("on", b.dataset.tool === t); });
    }
    modal.querySelectorAll(".draw-tool").forEach(function (b) {
      b.addEventListener("click", function () { setTool(b.dataset.tool); });
    });

    /* ── event listeners ── */
    document.getElementById("draw-close").addEventListener("click", close);
    canvas.addEventListener("pointerdown",   start);
    canvas.addEventListener("pointermove",   move);
    window.addEventListener("pointerup",     end);
    window.addEventListener("pointercancel", end);

    /* ── open / close ── */
    function open(q, btn) {
      qref = q; btnRef = btn; openedAt = Date.now();
      titleEl.textContent =
        (q.numero_disciplina ? "Nº " + q.numero_disciplina + " · " : "") +
        q.materia + " · ENEM " + (q.ano || "");
      strokes = S.desenhos[q.id] ? S.desenhos[q.id].slice() : [];
      cor = "preto"; setTool("preto");

      bgImg = null; bgRect = null;
      var src = (q.imagens && q.imagens.length) ? q.imagens[0] : null;
      modal.classList.toggle("has-fig", !!src);
      modal.classList.add("on");
      modal.setAttribute("aria-hidden", "false");
      fit();

      if (src) {
        var im = new Image();
        im.onload  = function () { if (qref === q) { bgImg = im; redraw(); } };
        im.onerror = function () { modal.classList.remove("has-fig"); };
        im.src = src;
      }
    }

    function close() {
      if (qref) {
        S.tempos[qref.id] = (S.tempos[qref.id] || 0) + Math.round((Date.now() - openedAt) / 1000);
        save();
      }
      modal.classList.remove("on");
      modal.setAttribute("aria-hidden", "true");
      penIsActive = false; drawing = false; cur = null; activePointerId = null;
      qref = null; btnRef = null;
    }

    window.addEventListener("resize", function () {
      if (modal.classList.contains("on")) fit();
    });

    return { open: open };
  })();

  function openDraw(q, btn) { draw.open(q, btn); }

  /* ---------- boot ---------- */
  renderPainel();
})();
