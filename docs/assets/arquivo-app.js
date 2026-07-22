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

  // Soluções comentadas editoriais (autorais, para estudo). Chave = id da questão.
  // Somente conteúdo verificado; o gabarito é sempre o oficial do INEP.
  var SOLUCOES = {
    "bio-regular-q268": {
      conceito: "Reprodução das plantas e variabilidade genética. A diversidade genética de uma população depende da recombinação de genes entre indivíduos diferentes — o que ocorre, sobretudo, pela fecundação cruzada.",
      conclusao: "Entre as estruturas citadas, os grãos de pólen são os que permitem a polinização cruzada (transporte de gametas masculinos de uma planta para outra). Essa troca de material genético entre indivíduos recombina os genes e aumenta a diversidade genética da população.",
      abcde: {
        A: "As sementes aladas favorecem a dispersão no espaço (colonização de novos ambientes), não a variabilidade genética.",
        B: "Os arquegônios protegem o embrião — é uma vantagem de proteção, não de recombinação gênica.",
        C: "Correta. Os grãos de pólen viabilizam a polinização cruzada, recombinando genes de indivíduos diferentes e ampliando a diversidade genética.",
        D: "Os frutos protegem e ajudam a dispersar as sementes (eficiência reprodutiva), mas não geram, por si, maior variabilidade genética.",
        E: "Os vasos condutores permitiram a conquista do ambiente terrestre (transporte de seiva), sem relação direta com diversidade genética."
      },
      pegadinha: "Confundir eficiência ou dispersão reprodutiva (frutos, sementes aladas) com aumento de variabilidade genética. Diversidade genética exige TROCA de genes entre indivíduos.",
      atalho: "Palavra-chave: 'diversidade genética'. Procure a estrutura que promove cruzamento entre indivíduos diferentes — polinização cruzada = grãos de pólen."
    },
    "bio-regular-q605": {
      conceito: "Lamarckismo: lei do uso e desuso + herança dos caracteres adquiridos. Para Lamarck, órgãos pouco usados atrofiam ao longo da vida e essa modificação seria transmitida aos descendentes.",
      conclusao: "Sob a ótica de Lamarck, a ausência de olhos em animais subterrâneos seria explicada pela falta de uso desses órgãos (lei do uso e desuso), com a característica sendo transmitida à descendência.",
      abcde: {
        A: "Seleção natural é o mecanismo de Darwin, não de Lamarck; está fora do ponto de vista pedido.",
        B: "Correta. Descreve exatamente a lei do uso e desuso de Lamarck aplicada à perda dos olhos.",
        C: "Contraria o próprio lamarckismo, que prevê a transmissão do caráter adquirido às gerações seguintes, e não só à primeira.",
        D: "Mistura anacrônica: fala em 'incorporação ao patrimônio genético', conceito da genética posterior a Lamarck; não corresponde à explicação lamarckista pura.",
        E: "Descreve mutação + seleção natural (visão moderna/darwinista), não o pensamento de Lamarck."
      },
      pegadinha: "A alternativa D também 'parece' lamarckista, mas insere 'patrimônio genético' — conceito que Lamarck não tinha. A questão pede a explicação de Lamarck, então a resposta é a formulação pura do uso e desuso (B).",
      atalho: "Lamarck = uso e desuso + herança do adquirido, SEM genética. Elimine tudo que fala em seleção natural (A, E) ou em genes/patrimônio genético (D)."
    }
  };

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
    if (name === "simulado") renderSimulado();
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

    // Cabeçalho estilo caderno oficial: QUESTÃO + régua horizontal.
    var head = el("div", "q-caderno");
    head.appendChild(el("span", "qh", "QUESTÃO" + (q.numero_disciplina ? " " + q.numero_disciplina : "")));
    head.appendChild(el("span", "rule"));
    c.appendChild(head);

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
      img.alt = "Imagem oficial " + (i + 1) + " da questão" + (q.ano ? " · ENEM " + q.ano : "");
      img.onerror = function () { img.remove(); var d = img.closest && img.closest("details"); if (d) d.remove(); };
      if (q.imagem_pagina) {
        // Recorte da página inteira do caderno (contém enunciado+alternativas):
        // fica recolhido para não duplicar o texto já exibido, mas disponível.
        var det = el("details", "qfig-det");
        var sum = el("summary", null, "Ver imagem oficial da questão (página do caderno)");
        det.appendChild(sum); det.appendChild(img);
        c.appendChild(det);
      } else {
        c.appendChild(img); // recorte fiel so da figura (inline)
      }
    });

    // Selo de fonte oficial (somente dados verdadeiros: INEP + ano + aplicação/banco).
    var fonte = el("div", "fonte-oficial");
    var partes = ["Fonte oficial: <b>INEP</b>"];
    if (q.ano) partes.push("ENEM " + q.ano);
    partes.push(q.aplicacao || q.banco || "—");
    fonte.innerHTML = partes.join(" · ");
    c.appendChild(fonte);

    // opts.respMap: usa um mapa de respostas próprio (ex.: revisão de simulado)
    // em vez do progresso global — evita revelar respostas antigas/estranhas.
    var answered = opts.respMap
      ? (opts.respMap[q.id] ? { escolha: opts.respMap[q.id], correta: opts.respMap[q.id] === q.gabarito } : null)
      : S.respostas[q.id];
    // guarda a solução para inserir DEPOIS das alternativas/rodapé
    var solucaoPend = opts.hideSolution ? null : q;
    var podeResponder = !!q.gabarito && !q.anulada && !opts.readonly;
    var onRetry = (opts.noRetry || opts.readonly) ? null : function () { rerenderCard(c, q, opts); };
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
      foot = qfoot(q, opts, onRetry);
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
      foot = qfoot(q, opts, onRetry);
      c.appendChild(foot);
      if (answered) lockLetters(q, lr, answered.escolha);
    }
    if (solucaoPend) c.appendChild(solucaoPanel(solucaoPend));
    return c;
  }

  /* ---------- SOLUÇÃO COMENTADA (editorial, opt-in) ---------- */
  // Ao abrir, revela o gabarito — por isso fica recolhida e não é inserida no
  // modo simulado (opts.hideSolution). Conteúdo autoral marcado como editorial;
  // nunca apresentado como explicação oficial do INEP.
  function solucaoPanel(q) {
    var det = el("details", "solucao");
    var sum = el("summary", null, "Solução comentada");
    det.appendChild(sum);
    var sc = el("div", "sc");
    var s = SOLUCOES[q.id];

    // Resposta oficial (dado verdadeiro do gabarito INEP).
    var resp = el("p", "resp");
    if (q.anulada) { resp.textContent = "Questão anulada pelo INEP — sem gabarito válido."; }
    else if (q.gabarito) { resp.innerHTML = "Resposta oficial: <span class='g'>" + q.gabarito + "</span>"; }
    else { resp.textContent = "Gabarito oficial não disponível."; }
    sc.appendChild(resp);

    if (s) {
      if (s.conceito) { sc.appendChild(h4("Conceito central")); sc.appendChild(para(s.conceito)); }
      if (s.conclusao) { sc.appendChild(h4("Por que essa é a resposta")); sc.appendChild(para(s.conclusao)); }
      if (s.abcde) {
        sc.appendChild(h4("Análise alternativa por alternativa"));
        var ul = el("ul", "abcde");
        ["A", "B", "C", "D", "E"].forEach(function (L) {
          if (!s.abcde[L]) return;
          var li = el("li");
          li.innerHTML = "<b>" + L + ")</b> ";
          var span = el("span"); mathify(span, s.abcde[L]); li.appendChild(span);
          ul.appendChild(li);
        });
        sc.appendChild(ul);
      }
      if (s.pegadinha) { sc.appendChild(h4("Pegadinha")); sc.appendChild(para(s.pegadinha)); }
      if (s.atalho) { sc.appendChild(h4("Atalho no ENEM")); sc.appendChild(para(s.atalho)); }
    } else {
      // Sem solução autoral ainda — honesto, sem inventar explicações.
      var tema = q.aula || q.modelo;
      if (tema) { sc.appendChild(h4("Tema")); sc.appendChild(para(tema + (q.habilidade ? " · habilidade H" + q.habilidade : ""))); }
      sc.appendChild(para0("Solução comentada detalhada em preparação para esta questão. O gabarito acima é o oficial do INEP.", "prep"));
    }

    var selo = el("div", "selo-ed",
      "Solução editorial da plataforma (elaborada para fins de estudo). NÃO é a explicação oficial do INEP — o INEP publica apenas o gabarito, exibido acima.");
    sc.appendChild(selo);
    det.appendChild(sc);
    return det;
  }
  function h4(t) { return el("h4", null, t); }
  function para(t) { var p = el("p"); mathify(p, t); p.style.margin = "0 0 4px"; return p; }
  function para0(t, cls) { var p = el("p", cls); p.textContent = t; p.style.margin = "0"; return p; }

  function rerenderCard(oldCard, q, opts) {
    var fresh = card(q, opts);
    if (oldCard.parentNode) oldCard.parentNode.replaceChild(fresh, oldCard);
  }

  function tag(txt, cls) { var t = el("span", "tag" + (cls ? " " + cls : ""), txt); return t; }

  function qfoot(q, opts, onRetry) {
    var f = el("div", "qfoot");
    var star = el("button", "star" + (S.favoritos[q.id] ? " on" : ""), (S.favoritos[q.id] ? "Favorita" : "Favoritar"));
    star.addEventListener("click", function () {
      if (S.favoritos[q.id]) delete S.favoritos[q.id]; else S.favoritos[q.id] = 1;
      save();
      star.classList.toggle("on"); star.textContent = S.favoritos[q.id] ? "Favorita" : "Favoritar";
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
    var drawBtn = el("button", "btn-draw" + (temDesenho ? " has" : ""), "Explicação ativa");
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
      var prev = el("button", "btn sm ghost", "Anterior"); prev.disabled = page === 0;
      prev.addEventListener("click", function () { if (page > 0) { page--; renderBancoList(); window.scrollTo(0, 0); } });
      var info = el("span", "count", "página " + (page + 1) + " / " + pages);
      var next = el("button", "btn sm ghost", "Próxima"); next.disabled = page >= pages - 1;
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
      noRetry: true, // fluxo do estudo é para a frente; sem "responder novamente" aqui
      onAnswer: function (correta) {
        if (answeredThis.done) return; answeredThis.done = true;
        var secs = Math.round((Date.now() - tStart) / 1000);
        S.tempos[q.id] = (S.tempos[q.id] || 0) + secs;
        save();
        study.respondidas++; if (correta) study.acertos++;
        nextBtn.textContent = "Próxima questão"; nextBtn.classList.add("solid");
      }
    }));

    var pager = el("div", "pager");
    var skip = el("button", "btn sm ghost", "Pular");
    skip.addEventListener("click", advance);
    var nextBtn = el("button", "btn sm", "Próxima questão");
    if (study.list[study.i].banco === "PPL") nextBtn.classList.add("solid");
    nextBtn.addEventListener("click", advance);
    pager.appendChild(skip); pager.appendChild(nextBtn);
    body.appendChild(pager);
    window.scrollTo(0, 0);

    function advance() { study.i++; renderStudy(); }
  }
  function finishStudy(body) {
    // registra a sessão UMA vez, mesmo que o usuário reabra a aba Estudar.
    if (study && !study.recorded && study.respondidas > 0) {
      study.recorded = true;
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
     EXPLICAÇÃO ATIVA — tinta exclusiva para Apple Pencil 2
     O dedo e o mouse nunca criam traços. Cada contato da Pencil gera exatamente
     um stroke; os pontos coalescidos do Safari são pintados incrementalmente para
     evitar lacunas e o custo de redesenhar o canvas Retina a cada movimento.
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

    var cor = "preto", strokes = [], cur = null, drawing = false;
    var qref = null, btnRef = null, openedAt = 0;
    var activePointerId = null;

    // Espessura em pixels CSS. A variação é deliberadamente curta: aparência de
    // caneta 0,5, sem engrossar e embolar letras sob pressão alta.
    var PEN_MIN_W = 0.9;
    var PEN_MAX_W = 1.75;
    var PEN_DEFAULT_PRESSURE = 0.35;
    var MIN_POINT_DISTANCE = 0.32;
    var ERASER_RADIUS = 20;

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
      strokes.forEach(function (s) { paint(s, r, true); });
      updateCount();
    }

    function updateCount() {
      countEl.textContent = strokes.length + (strokes.length === 1 ? " traço" : " traços");
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function penWidth(pressure) {
      var p = Number(pressure);
      if (!isFinite(p) || p <= 0) p = PEN_DEFAULT_PRESSURE;
      p = clamp(p, 0.02, 1);
      return PEN_MIN_W + (PEN_MAX_W - PEN_MIN_W) * Math.pow(p, 0.72);
    }

    function midpoint(a, b) {
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    }

    function setInk(s, pressure) {
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.strokeStyle = COLORS[s.cor] || COLORS.preto;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = penWidth(pressure);
    }

    function paintDot(s, p, r) {
      setInk(s, p[2]);
      ctx.beginPath();
      ctx.arc(p[0] * r.width, p[1] * r.height, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Desenha somente o trecho confirmado pelo ponto de índice i. Essa tinta
    // incremental preserva todos os pontos coalescidos sem limpar milhões de
    // pixels do canvas Retina em cada pointermove.
    function paintSegment(s, i, r) {
      var pts = s.pts;
      if (i < 1 || i >= pts.length) return;

      var start, control, finish, pressure;
      if (i === 1) {
        start = pts[0];
        control = pts[0];
        finish = midpoint(pts[0], pts[1]);
        pressure = (pts[0][2] + pts[1][2]) / 2;
      } else {
        start = midpoint(pts[i - 2], pts[i - 1]);
        control = pts[i - 1];
        finish = midpoint(pts[i - 1], pts[i]);
        pressure = (pts[i - 1][2] + pts[i][2]) / 2;
      }

      setInk(s, pressure);
      ctx.beginPath();
      ctx.moveTo(start[0] * r.width, start[1] * r.height);
      ctx.quadraticCurveTo(
        control[0] * r.width, control[1] * r.height,
        finish[0] * r.width, finish[1] * r.height
      );
      ctx.stroke();
    }

    function paintTail(s, r) {
      var pts = s.pts;
      if (pts.length < 2) return;
      var a = pts[pts.length - 2], b = pts[pts.length - 1];
      var start = midpoint(a, b);
      setInk(s, b[2]);
      ctx.beginPath();
      ctx.moveTo(start[0] * r.width, start[1] * r.height);
      ctx.quadraticCurveTo(
        b[0] * r.width, b[1] * r.height,
        b[0] * r.width, b[1] * r.height
      );
      ctx.stroke();
    }

    function paint(s, r, complete) {
      if (!s.pts || !s.pts.length) return;
      paintDot(s, s.pts[0], r);
      for (var i = 1; i < s.pts.length; i++) paintSegment(s, i, r);
      if (complete) paintTail(s, r);
    }

    /* ── pos(): normaliza coordenada e estabiliza pressão da Pencil ── */
    function pos(e, r) {
      var pressure = Number(e.pressure);
      if (!isFinite(pressure) || pressure <= 0) pressure = PEN_DEFAULT_PRESSURE;
      pressure = clamp(pressure, 0.02, 1);
      if (cur && cur.pts.length) {
        pressure = cur.pts[cur.pts.length - 1][2] * 0.68 + pressure * 0.32;
      }
      return [
        clamp((e.clientX - r.left) / r.width, 0, 1),
        clamp((e.clientY - r.top) / r.height, 0, 1),
        pressure
      ];
    }

    function appendPoint(p, r) {
      if (!cur) return false;
      var last = cur.pts[cur.pts.length - 1];
      var distance = Math.hypot(
        (p[0] - last[0]) * r.width,
        (p[1] - last[1]) * r.height
      );
      if (distance < MIN_POINT_DISTANCE) return false;
      cur.pts.push(p);
      paintSegment(cur, cur.pts.length - 1, r);
      return true;
    }

    /* ── borracha ── */
    function hitErase(p, r) {
      var before = strokes.length;
      strokes = strokes.filter(function (s) {
        return !s.pts.some(function (pt) {
          return Math.hypot(
            (pt[0] - p[0]) * r.width,
            (pt[1] - p[1]) * r.height
          ) < ERASER_RADIUS;
        });
      });
      return strokes.length !== before;
    }

    /* Flag de borracha do padrão Pointer Events (para stylus compatível). */
    function isEraserTip(e) {
      return e.pointerType === "pen" && (e.buttons & 32) !== 0;
    }

    /* ── handlers de pointer ── */
    function start(e) {
      // Bloqueia dedo/palma (touch): a escrita é da Apple Pencil (no iPad) — o
      // mouse é aceito só para uso em desktop, onde não há caneta nem toque.
      if (e.pointerType === "touch") return;
      // Só um ponteiro ativo por vez
      if (activePointerId != null && e.pointerId !== activePointerId) return;

      e.preventDefault();
      activePointerId = e.pointerId;
      try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) {}

      var r = canvas.getBoundingClientRect();
      var p = pos(e, r);
      var toolAgora = isEraserTip(e) ? "borracha" : cor;

      if (toolAgora === "borracha") {
        drawing = true;
        if (hitErase(p, r)) redraw();
        return;
      }
      drawing = true;
      cur = { cor: cor, pts: [p], input: "apple-pencil-2" };
      strokes.push(cur);
      paintDot(cur, p, r);
      updateCount();
    }

    function move(e) {
      if (e.pointerType === "touch" || !drawing || e.pointerId !== activePointerId) return;
      e.preventDefault();
      var toolAgora = isEraserTip(e) ? "borracha" : cor;
      var r = canvas.getBoundingClientRect();

      // getCoalescedEvents entrega todos os pontos intermediários desde o último
      // frame — essencial para traços suaves com o Pencil em alta velocidade
      var coalesced = e.getCoalescedEvents && e.getCoalescedEvents();
      var events = (coalesced && coalesced.length) ? Array.prototype.slice.call(coalesced) : [];
      var lastEvent = events[events.length - 1];
      if (!lastEvent || lastEvent.clientX !== e.clientX || lastEvent.clientY !== e.clientY) events.push(e);

      var erased = false;
      events.forEach(function (ev) {
        var p = pos(ev, r);
        if (toolAgora === "borracha") erased = hitErase(p, r) || erased;
        else appendPoint(p, r);
      });
      if (erased) redraw();
    }

    function end(e) {
      if (e && e.pointerId !== activePointerId) return;
      if (e && e.pointerType !== "pen") return;

      if (drawing && cur) {
        var r = canvas.getBoundingClientRect();
        if (e && e.type === "pointerup") appendPoint(pos(e, r), r);
        paintTail(cur, r);
      }
      if (e) {
        try { canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      activePointerId = null;
      if (!drawing) return;
      drawing = false; cur = null;
      persist();
    }

    /* Safari: a palma não desenha nem inicia seleção/zoom dentro do caderno. */
    function blockDirectTouch(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    canvas.addEventListener("touchstart", blockDirectTouch, { passive: false });
    canvas.addEventListener("touchmove", blockDirectTouch, { passive: false });
    canvas.addEventListener("contextmenu", blockDirectTouch);

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
    canvas.addEventListener("pointerdown",   start, { passive: false });
    canvas.addEventListener("pointermove",   move,  { passive: false });
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
      drawing = false; cur = null; activePointerId = null;
      qref = null; btnRef = null;
    }

    window.addEventListener("resize", function () {
      if (modal.classList.contains("on")) fit();
    });

    return { open: open };
  })();

  function openDraw(q, btn) { draw.open(q, btn); }

  /* ---------- SIMULADO (prova cronometrada, sem correção durante) ---------- */
  var sim = null, simTimer = null;
  function renderSimulado() {
    var body = document.getElementById("simulado-body");
    if (sim && sim.running) { renderSimQuestion(); return; }
    if (sim && sim.done) { renderSimReport(); return; }
    body.innerHTML = "";
    var setup = el("div", "sim-setup");
    setup.appendChild(field("Matéria", selectEl("sim-mat", ["Todas", "Biologia", "Química", "Física"])));
    setup.appendChild(field("Banco", selectEl("sim-banco", ["Todos", "Regular", "PPL"])));
    setup.appendChild(field("Nº de questões", selectEl("sim-n", ["5", "10", "20", "45"], "10")));
    setup.appendChild(field("Tempo (min)", selectEl("sim-tempo", ["Sem tempo", "10", "20", "45", "90"], "20")));
    body.appendChild(setup);
    var start = el("button", "btn solid", "Iniciar simulado");
    start.style.marginTop = "18px";
    start.addEventListener("click", startSimulado);
    body.appendChild(start);
    var nota = el("p", "vlead");
    nota.style.marginTop = "16px";
    nota.textContent = "Todas as questões são oficiais do INEP, já aplicadas no ENEM. Durante a prova não há correção; o gabarito e a solução comentada aparecem só no relatório final.";
    body.appendChild(nota);
  }
  function field(label, control) {
    var f = el("div", "f");
    f.appendChild(el("label", null, label));
    f.appendChild(control);
    return f;
  }
  function selectEl(id, opts, def) {
    var s = document.createElement("select"); s.id = id;
    opts.forEach(function (o) { var op = new Option(o, o); if (o === def) op.selected = true; s.appendChild(op); });
    return s;
  }
  function startSimulado() {
    var mat = document.getElementById("sim-mat").value;
    var banco = document.getElementById("sim-banco").value;
    var n = parseInt(document.getElementById("sim-n").value, 10);
    var tempo = document.getElementById("sim-tempo").value;
    var pool = Q.filter(function (q) {
      if (q.anulada || !q.gabarito) return false;             // só respondíveis
      if (mat !== "Todas" && q.materia !== mat) return false;
      if (banco !== "Todos" && q.banco !== banco) return false;
      return true;
    });
    if (pool.length < n) n = pool.length;
    if (!n) { alert("Nenhuma questão disponível para esses filtros."); return; }
    // embaralha e corta
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var lista = pool.slice(0, n);
    sim = { running: true, done: false, lista: lista, i: 0, respostas: {}, inicio: Date.now(), dur: (tempo === "Sem tempo" ? 0 : parseInt(tempo, 10) * 60) };
    if (sim.dur) sim.endsAt = Date.now() + sim.dur * 1000;
    renderSimQuestion();
  }
  function fmtClock(secs) {
    if (secs < 0) secs = 0;
    var m = Math.floor(secs / 60), s = secs % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function renderSimQuestion() {
    var body = document.getElementById("simulado-body"); body.innerHTML = "";
    var q = sim.lista[sim.i];

    var hd = el("div", "sim-run-hd");
    var pos = el("div", "scoreline", "Questão " + (sim.i + 1) + " de " + sim.lista.length);
    hd.appendChild(pos);
    var timer = el("div", "sim-timer"); timer.id = "sim-timer";
    hd.appendChild(timer);
    var fin = el("button", "btn sm solid", "Finalizar e corrigir");
    fin.addEventListener("click", finishSimulado);
    hd.appendChild(fin);
    body.appendChild(hd);
    tickTimer();

    // grade de navegação
    var grid = el("div", "sim-grid");
    sim.lista.forEach(function (qq, idx) {
      var cell = el("button", "sim-cell" + (sim.respostas[qq.id] ? " done" : "") + (idx === sim.i ? " cur" : ""), String(idx + 1));
      cell.addEventListener("click", function () { sim.i = idx; renderSimQuestion(); });
      grid.appendChild(cell);
    });
    body.appendChild(grid);

    // questão SEM correção (não revela gabarito)
    var c = el("div", "qcard");
    var meta = el("div", "qmeta");
    if (q.numero_disciplina) meta.appendChild(el("span", "qnum", "Nº " + q.numero_disciplina));
    meta.appendChild(tag(q.materia, "klein"));
    meta.appendChild(tag(q.banco === "PPL" ? "PPL" : "Regular", q.banco === "PPL" ? "ppl" : ""));
    if (q.ano) meta.appendChild(tag("ENEM " + q.ano));
    c.appendChild(meta);
    var hq = el("div", "q-caderno"); hq.appendChild(el("span", "qh", "QUESTÃO " + (sim.i + 1))); hq.appendChild(el("span", "rule")); c.appendChild(hq);
    var body2 = el("div", "qbody"); mathify(body2, q.enunciado || "(enunciado indisponível)"); c.appendChild(body2);
    (q.imagens || []).forEach(function (src) {
      var img = new Image(); img.className = "qfig"; img.loading = "lazy"; img.src = src;
      img.alt = "Imagem oficial da questão"; img.onerror = function () { img.remove(); };
      c.appendChild(img);
    });

    var sel = sim.respostas[q.id];
    if (q.banco === "Regular" && q.alternativas && q.alternativas.length) {
      var ul = el("ul", "alts");
      q.alternativas.forEach(function (a) {
        var li = el("li"); li.dataset.letra = a.letra;
        if (sel === a.letra) li.classList.add("sel");
        li.appendChild(el("span", "lt", a.letra));
        var tx = el("span", "tx"); mathify(tx, a.texto); li.appendChild(tx);
        li.addEventListener("click", function () { sim.respostas[q.id] = a.letra; renderSimQuestion(); });
        ul.appendChild(li);
      });
      c.appendChild(ul);
    } else {
      c.appendChild(el("div", "ppl-alts", "Banco PPL: as alternativas aparecem ao final do enunciado. Escolha a letra."));
      var lr = el("div", "letters");
      ["A", "B", "C", "D", "E"].forEach(function (L) {
        var bt = el("button", "letter" + (sel === L ? " sel" : ""), L);
        bt.addEventListener("click", function () { sim.respostas[q.id] = L; renderSimQuestion(); });
        lr.appendChild(bt);
      });
      c.appendChild(lr);
    }
    body.appendChild(c);

    var pager = el("div", "pager");
    var prev = el("button", "btn sm ghost", "Anterior"); prev.disabled = sim.i === 0;
    prev.addEventListener("click", function () { if (sim.i > 0) { sim.i--; renderSimQuestion(); } });
    var next = el("button", "btn sm", sim.i < sim.lista.length - 1 ? "Próxima" : "Ir para a correção");
    next.addEventListener("click", function () { if (sim.i < sim.lista.length - 1) { sim.i++; renderSimQuestion(); } else finishSimulado(); });
    pager.appendChild(prev); pager.appendChild(next);
    body.appendChild(pager);
  }
  function tickTimer() {
    if (simTimer) { clearInterval(simTimer); simTimer = null; }
    var el0 = document.getElementById("sim-timer");
    if (!sim || !sim.running) return;
    function upd() {
      var t = document.getElementById("sim-timer"); if (!t) { clearInterval(simTimer); return; }
      if (sim.dur) {
        var rem = Math.round((sim.endsAt - Date.now()) / 1000);
        t.textContent = "Tempo: " + fmtClock(rem);
        t.classList.toggle("low", rem <= 60);
        if (rem <= 0) { finishSimulado(); }
      } else {
        t.textContent = "Tempo: " + fmtClock(Math.round((Date.now() - sim.inicio) / 1000));
      }
    }
    upd(); simTimer = setInterval(upd, 1000);
  }
  function finishSimulado() {
    if (simTimer) { clearInterval(simTimer); simTimer = null; }
    sim.running = false; sim.done = true; sim.fim = Date.now();
    // grava as respostas no progresso geral (banco/erros/painel)
    sim.lista.forEach(function (q) {
      var esc = sim.respostas[q.id];
      if (esc) { S.respostas[q.id] = { escolha: esc, correta: esc === q.gabarito, ts: Date.now() }; }
    });
    var dur = Math.round((sim.fim - sim.inicio) / 1000);
    S.sessoes.push({ inicio: sim.inicio, fim: sim.fim, total: Object.keys(sim.respostas).length, acertos: sim.lista.filter(function (q) { return sim.respostas[q.id] === q.gabarito; }).length, simulado: true });
    save();
    renderSimReport(dur);
  }
  function renderSimReport(dur) {
    var body = document.getElementById("simulado-body"); body.innerHTML = "";
    var total = sim.lista.length;
    var respondidas = Object.keys(sim.respostas).length;
    var acertos = sim.lista.filter(function (q) { return sim.respostas[q.id] === q.gabarito; }).length;

    var kpis = el("div", "kpis");
    kpis.appendChild(kpi(acertos + " / " + total, "acertos", true));
    kpis.appendChild(kpi(pct(acertos, total) + "%", "aproveitamento"));
    kpis.appendChild(kpi(respondidas + " / " + total, "respondidas"));
    kpis.appendChild(kpi(fmtClock(dur || Math.round((sim.fim - sim.inicio) / 1000)), "tempo total"));
    body.appendChild(kpis);

    // por matéria
    var pm = el("div", "panel"); pm.appendChild(el("h3", null, "Desempenho por matéria"));
    ["Biologia", "Química", "Física"].forEach(function (m) {
      var qs = sim.lista.filter(function (q) { return q.materia === m; });
      if (!qs.length) return;
      var ac = qs.filter(function (q) { return sim.respostas[q.id] === q.gabarito; }).length;
      pm.appendChild(barRow(m, ac, qs.length, ac + "/" + qs.length + " · " + pct(ac, qs.length) + "%"));
    });
    body.appendChild(pm);

    var acts = el("div", "pager"); acts.style.margin = "18px 0";
    var review = el("button", "btn solid", "Revisar questões com solução");
    review.addEventListener("click", function () { renderSimRevisao(); });
    var novo = el("button", "btn ghost", "Novo simulado");
    novo.addEventListener("click", function () { sim = null; renderSimulado(); });
    acts.appendChild(review); acts.appendChild(novo);
    body.appendChild(acts);
  }
  function renderSimRevisao() {
    var body = document.getElementById("simulado-body"); body.innerHTML = "";
    var back = el("button", "btn sm ghost", "Voltar ao relatório");
    back.addEventListener("click", function () { renderSimReport(); });
    back.style.marginBottom = "14px";
    body.appendChild(back);
    // revisão reflete ESTE simulado (sim.respostas), não o progresso global,
    // e é somente leitura (readonly) para não reabrir/regravar respostas.
    sim.lista.forEach(function (q) { body.appendChild(card(q, { respMap: sim.respostas, readonly: true })); });
  }

  /* ---------- boot ---------- */
  renderPainel();
})();
