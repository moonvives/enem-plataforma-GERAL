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
    return { respostas: {}, favoritos: {}, notas: {}, sessoes: [] };
  }
  function migrate(s) {
    s.respostas = s.respostas || {};
    s.favoritos = s.favoritos || {};
    s.notas = s.notas || {};
    s.sessoes = s.sessoes || [];
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
  // Official enunciados have no math delimiters, so they fall through as plain
  // text (preserving line breaks via the pre-wrap container).
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

    // Recorte fiel da questão (banco Regular): assets/img/modelos/qNNN.webp.
    if (q.imagem) {
      var img = new Image();
      img.className = "qfig";
      img.loading = "lazy";
      img.src = q.imagem;
      img.alt = "Figura oficial da questão " + (q.ano || "");
      img.onerror = function () { img.remove(); };
      c.appendChild(img);
    }

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
      // PPL — alternatives are embedded in the enunciado text; offer letter choice.
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

    // Responder novamente: limpa o registro para tentar de novo (usado na revisão de erros).
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
    f.appendChild(noteBox);
    return f;
  }

  function showGab(q, out) {
    out.innerHTML = "";
    out.appendChild(document.createTextNode("Gabarito oficial: "));
    out.appendChild(el("span", "g", q.gabarito || "—"));
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

  // Records an answer. Guards annulled items and items without an official
  // A–E gabarito so they never enter accuracy/error stats. `lockFn` freezes
  // the chosen UI (alternatives or letter buttons).
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
    var respIds = Object.keys(S.respostas);
    var total = Q.length;
    var done = respIds.length;
    var acertos = respIds.filter(function (id) { return S.respostas[id].correta; }).length;
    var favs = Object.keys(S.favoritos).length;

    var kpis = document.getElementById("kpis");
    kpis.innerHTML = "";
    kpis.appendChild(kpi(done + " / " + total, "questões respondidas", true));
    kpis.appendChild(kpi(pct(done, total) + "%", "do arquivo concluído"));
    kpis.appendChild(kpi(done ? pct(acertos, done) + "%" : "—", "taxa de acerto"));
    kpis.appendChild(kpi(String(favs), "favoritadas"));

    // por matéria
    var mats = ["Biologia", "Química", "Física"];
    var bm = document.getElementById("by-materia"); bm.innerHTML = "";
    mats.forEach(function (m) {
      var all = Q.filter(function (q) { return q.materia === m; });
      var d = all.filter(function (q) { return S.respostas[q.id]; }).length;
      bm.appendChild(barRow(m, d, all.length));
    });

    // por dificuldade (acerto)
    var bd = document.getElementById("by-dif"); bd.innerHTML = "";
    DIF_ORDER.forEach(function (lvl) {
      var ans = Q.filter(function (q) { return difBucket(q.b) === lvl && S.respostas[q.id]; });
      if (!ans.length) { if (lvl === "Sem TRI") return; }
      var ac = ans.filter(function (q) { return S.respostas[q.id].correta; }).length;
      bd.appendChild(barRow(lvl, ac, ans.length, ans.length ? pct(ac, ans.length) + "% (" + ac + "/" + ans.length + ")" : "sem respostas"));
    });

    // banco
    var bb = document.getElementById("by-banco"); bb.innerHTML = "";
    ["Regular", "PPL"].forEach(function (bk) {
      var all = Q.filter(function (q) { return q.banco === bk; });
      var d = all.filter(function (q) { return S.respostas[q.id]; }).length;
      bb.appendChild(barRow(bk + " (" + all.length + ")", d, all.length));
    });

    // sessões
    var ss = document.getElementById("sessoes"); ss.innerHTML = "";
    if (!S.sessoes.length) { ss.appendChild(el("div", "count", "Nenhuma sessão ainda. Use “Estudar estes” no Banco.")); }
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
    if (confirm("Zerar TODO o progresso (respostas, favoritos, anotações e sessões)?")) {
      S = { respostas: {}, favoritos: {}, notas: {}, sessoes: [] }; save(); renderPainel();
    }
  });
  function exportCsv() {
    var rows = [["id", "materia", "banco", "ano", "aplicacao", "habilidade", "competencia", "tri_b", "gabarito", "sua_resposta", "correta", "data"]];
    Object.keys(S.respostas).forEach(function (id) {
      var q = byId[id]; if (!q) return; var r = S.respostas[id];
      rows.push([id, q.materia, q.banco, q.ano, q.aplicacao, q.habilidade, q.competencia, fmtB(q.b), q.gabarito, r.escolha, r.correta ? "1" : "0", new Date(r.ts).toISOString()]);
    });
    var csv = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[",;\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "arquivo-cn-respostas.csv"; a.click();
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
    if (!study) { body.appendChild(el("div", "empty", "Vá ao Banco, filtre as questões e clique em “Estudar estes”.")); return; }
    if (study.i >= study.list.length) { finishStudy(body); return; }
    var q = study.list[study.i];

    var hd = el("div", "study-hd");
    hd.appendChild(el("div", "scoreline", "Questão " + (study.i + 1) + " de " + study.list.length));
    var pr = el("div", "prog"); var fl = el("span", "fill"); fl.style.width = pct(study.i, study.list.length) + "%"; pr.appendChild(fl); hd.appendChild(pr);
    hd.appendChild(el("div", "scoreline", "Acertos: " + study.acertos + "/" + study.respondidas));
    body.appendChild(hd);

    var answeredThis = { done: false };
    body.appendChild(card(q, {
      onAnswer: function (correta) {
        if (answeredThis.done) return; answeredThis.done = true;
        study.respondidas++; if (correta) study.acertos++;
        nextBtn.textContent = "Próxima questão ›"; nextBtn.classList.add("solid");
      }
    }));

    var pager = el("div", "pager");
    var skip = el("button", "btn sm ghost", "Pular");
    skip.addEventListener("click", advance);
    var nextBtn = el("button", "btn sm", (study.list[study.i].banco === "PPL" ? "Próxima questão ›" : "Próxima questão ›"));
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
    box.appendChild(el("div", "kpi", "")); // spacing noop
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

  /* ---------- boot ---------- */
  renderPainel();
})();
