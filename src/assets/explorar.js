/* Página "Explorar", pensada para a TV de toque do evento:
   mapa do Brasil por estado, temas em bolhas e vitrine automática depois de 1 minuto sem toque. */
(function () {
  'use strict';
  var D = window.EXPLORAR, SITE = window.SITE || { base: '../' }, I18N = window.I18N || {};
  if (!D) return;
  var OCIOSO_MS = 60000, SLIDE_MS = 9000;
  var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function idioma() { var l = (document.documentElement.lang || 'pt').slice(0, 2); return l === 'en' || l === 'es' ? l : 'pt'; }
  function t(k) { var l = idioma(); return (I18N[l] && I18N[l][k]) || (I18N.pt && I18N.pt[k]) || k; }
  function qtd(n) { return n + ' ' + t(n === 1 ? 'ex.trabalho' : 'ex.trabalhos'); }
  function tit(x) { return x.t[idioma()] || x.t.pt; }
  function link(x) { return SITE.base + 'trabalho/' + x.n + '/'; }
  function img(x) { return x.img ? SITE.base + x.img : ''; }
  function eixoDe(x) { for (var i = 0; i < D.eixos.length; i++) if (D.eixos[i].id === x.eixo) return D.eixos[i]; return null; }

  function cartao(x) {
    var e = eixoDe(x);
    return '<li><a class="ex-card" href="' + link(x) + '">' +
      (x.img ? '<img src="' + img(x) + '" alt="" loading="lazy">' : '<span class="ex-card-sem"></span>') +
      '<span class="ex-card-txt"><span class="ex-card-n">' + esc(x.n) + (e ? ' · <span style="color:' + e.cor + '">' + esc(e.curto) + '</span>' : '') + '</span>' +
      '<span class="ex-card-t">' + esc(tit(x)) + '</span><span class="ex-card-a">' + esc(x.a) + '</span></span></a></li>';
  }

  // ---------------- Mapa ----------------
  var svg = $('.ex-mapa'), zoom = $('.ex-zoom'), quadro = $('.ex-mapa-quadro');
  var ladoLista = $('.ex-lado-lista'), ladoUF = $('.ex-lado-uf'), voltar = $('.ex-voltar');
  var ufAtual = null;
  var vb = svg.viewBox.baseVal, VB = [vb.x, vb.y, vb.width, vb.height];

  function enquadrar(caixa) {
    if (!caixa) { zoom.style.transform = ''; return; }
    var pad = 60, x = caixa.x - pad, y = caixa.y - pad, w = caixa.width + pad * 2, h = caixa.height + pad * 2;
    var s = Math.min(VB[2] / w, VB[3] / h, 2.2);
    var cx = x + w / 2, cy = y + h / 2;
    var tx = VB[0] + VB[2] / 2 - cx * s, ty = VB[1] + VB[3] / 2 - cy * s;
    zoom.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }

  function escolher(uf) {
    var info = uf && D.ufs[uf];
    ufAtual = info ? uf : null;
    quadro.classList.toggle('foco', !!ufAtual);
    $$('.ex-uf, .ex-marca').forEach(function (el) { el.classList.toggle('ativo', el.dataset.uf === ufAtual); });
    $$('.ex-uf-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.uf === ufAtual)); });
    voltar.hidden = !ufAtual;
    if (!ufAtual) { ladoUF.hidden = true; ladoLista.hidden = false; enquadrar(null); return; }
    var lista = D.trabalhos.filter(function (x) { return x.uf === uf; });
    var reg = D.regioes[info.r] || ['', '#5E595B'];
    ladoUF.style.setProperty('--c', reg[1]);
    $('.ex-uf-nome', ladoUF).textContent = info.nome + ' · ' + qtd(lista.length);
    $('.ex-cards', ladoUF).innerHTML = lista.length ? lista.map(cartao).join('') : '<li class="ex-vazio">' + esc(t('ex.sem_uf')) + '</li>';
    ladoUF.hidden = false; ladoLista.hidden = true;
    ladoUF.scrollTop = 0;
    var p = $('.ex-uf[data-uf="' + uf + '"]', svg), m = $('.ex-marca[data-uf="' + uf + '"]', svg);
    var c = p.getBBox();
    if (m) { var b = m.getBBox(); var x1 = Math.min(c.x, b.x), y1 = Math.min(c.y, b.y); c = { x: x1, y: y1, width: Math.max(c.x + c.width, b.x + b.width) - x1, height: Math.max(c.y + c.height, b.y + b.height) - y1 }; }
    enquadrar(c);
  }

  svg.addEventListener('click', function (ev) {
    var alvo = ev.target.closest('[data-uf]');
    if (!alvo) { escolher(null); return; }
    var uf = alvo.dataset.uf;
    if (!D.ufs[uf] || !D.ufs[uf].n) { piscar(alvo); return; }
    escolher(uf === ufAtual ? null : uf);
  });
  svg.addEventListener('keydown', function (ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset && ev.target.dataset.uf) { ev.preventDefault(); escolher(ev.target.dataset.uf); }
  });
  function piscar(el) { el.classList.remove('pisca'); void el.getBBox(); el.classList.add('pisca'); }
  $$('.ex-uf-btn').forEach(function (b) { b.addEventListener('click', function () { escolher(b.dataset.uf); }); });
  voltar.addEventListener('click', function () { escolher(null); });

  // ---------------- Temas em bolhas ----------------
  var caixaBolhas = $('.ex-bolhas'), folha = $('.ex-folha');
  var contagem = {};
  D.trabalhos.forEach(function (x) { contagem[x.eixo] = (contagem[x.eixo] || 0) + 1; });
  var temas = D.eixos.filter(function (e) { return contagem[e.id]; });

  function montarBolhas() {
    var W = caixaBolhas.clientWidth, H = caixaBolhas.clientHeight;
    if (!W || !H) return;
    var max = Math.max.apply(null, temas.map(function (e) { return contagem[e.id]; }));
    var rMax = Math.min(W, H) * 0.3;
    var bs = temas.map(function (e, i) {
      var a = i / temas.length * Math.PI * 2;
      return { e: e, r: Math.max(rMax * Math.sqrt(contagem[e.id] / max), Math.min(W, H) * 0.13, 95), x: W / 2 + Math.cos(a) * W * 0.2, y: H / 2 + Math.sin(a) * H * 0.2 };
    });
    // Afasta as bolhas umas das outras e das bordas (poucas iterações bastam para 5 bolhas).
    for (var it = 0; it < 300; it++) {
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        b.x += (W / 2 - b.x) * 0.01; b.y += (H / 2 - b.y) * 0.01;
        for (var j = i + 1; j < bs.length; j++) {
          var o = bs[j], dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1, min = b.r + o.r + 22;
          if (d < min) { var k = (min - d) / d / 2; b.x -= dx * k; b.y -= dy * k; o.x += dx * k; o.y += dy * k; }
        }
        b.x = Math.max(b.r + 4, Math.min(W - b.r - 4, b.x)); b.y = Math.max(b.r + 4, Math.min(H - b.r - 4, b.y));
      }
    }
    caixaBolhas.innerHTML = bs.map(function (b, i) {
      var n = contagem[b.e.id];
      return '<button type="button" class="ex-bolha" data-eixo="' + i + '" style="--c:' + b.e.cor + ';--d:' + (2 * b.r).toFixed(0) + 'px;left:' + (b.x - b.r).toFixed(0) + 'px;top:' + (b.y - b.r).toFixed(0) + 'px;--atraso:-' + (i * 1.7).toFixed(1) + 's">' +
        '<span class="ex-bolha-n">' + n + '</span><span class="ex-bolha-eixo">' + esc(b.e.curto) + '</span>' +
        '<span class="ex-bolha-nome">' + esc(b.e.nome[idioma()] || b.e.nome.pt) + '</span></button>';
    }).join('');
    $$('.ex-bolha', caixaBolhas).forEach(function (el) {
      el.addEventListener('click', function () { abrirTema(bs[+el.dataset.eixo].e, el); });
    });
  }

  var origemFolha = null;
  function abrirTema(e, el) {
    var lista = D.trabalhos.filter(function (x) { return x.eixo === e.id; });
    $('#ex-folha-tit').innerHTML = '<span class="ex-folha-eixo" style="color:' + e.cor + '">' + esc(e.curto) + ' · ' + esc(qtd(lista.length)) + '</span>' + esc(e.nome[idioma()] || e.nome.pt);
    $('.ex-posters', folha).innerHTML = lista.map(cartao).join('');
    folha.style.setProperty('--c', e.cor);
    var r = el.getBoundingClientRect();
    folha.style.setProperty('--ox', (r.left + r.width / 2) + 'px');
    folha.style.setProperty('--oy', (r.top + r.height / 2) + 'px');
    origemFolha = el;
    folha.hidden = false;
    document.documentElement.classList.add('ex-travado');
    folha.scrollTop = 0;
    requestAnimationFrame(function () { folha.classList.add('aberta'); $('.ex-fechar', folha).focus({ preventScroll: true }); });
  }
  function fecharTema() {
    if (folha.hidden) return;
    folha.classList.remove('aberta');
    document.documentElement.classList.remove('ex-travado');
    setTimeout(function () { folha.hidden = true; }, reduzir ? 0 : 350);
    if (origemFolha) origemFolha.focus({ preventScroll: true });
  }
  $('.ex-fechar', folha).addEventListener('click', fecharTema);
  folha.addEventListener('click', function (ev) { if (ev.target === folha) fecharTema(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fecharTema(); });

  var redim;
  window.addEventListener('resize', function () { clearTimeout(redim); redim = setTimeout(montarBolhas, 200); });
  montarBolhas();

  // Troca de idioma: o app.js muda o atributo lang do <html>; refaz os textos gerados aqui.
  new MutationObserver(function () {
    montarBolhas();
    if (ufAtual) escolher(ufAtual);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // ---------------- Vitrine ----------------
  var vit = $('.ex-vitrine'), vitImg = $('.ex-vit-img img', vit), barra = $('.ex-vit-barra', vit);
  var fila = [], pos = 0, timerSlide = null, timerOcioso = null, vitAtiva = false;

  function embaralhar(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  function mostrarSlide() {
    var x = fila[pos % fila.length], e = eixoDe(x), uf = D.ufs[x.uf];
    vit.classList.remove('entra');
    var prox = new Image();
    prox.onload = prox.onerror = function () {
      vitImg.src = prox.src;
      $('.ex-vit-n', vit).textContent = x.n;
      $('.ex-vit-t', vit).textContent = tit(x);
      $('.ex-vit-a', vit).textContent = x.a;
      $('.ex-vit-meta', vit).innerHTML = (e ? '<span style="--c:' + e.cor + '">' + esc(e.curto) + '</span>' : '') + (uf ? '<span>' + esc(uf.nome) + '</span>' : '');
      void vit.offsetWidth;
      vit.classList.add('entra');
    };
    prox.src = img(x);
    pos++;
  }

  function iniciarVitrine() {
    if (vitAtiva) return;
    fecharTema(); escolher(null);
    fila = embaralhar(D.trabalhos.filter(function (x) { return x.img; }));
    if (!fila.length) return;
    pos = 0; vitAtiva = true;
    vit.hidden = false;
    vit.style.setProperty('--dur', SLIDE_MS + 'ms');
    mostrarSlide();
    timerSlide = setInterval(mostrarSlide, SLIDE_MS);
  }
  function pararVitrine() {
    vitAtiva = false;
    clearInterval(timerSlide);
    vit.hidden = true; vit.classList.remove('entra');
    window.scrollTo(0, 0);
  }
  function armarOcioso() {
    clearTimeout(timerOcioso);
    timerOcioso = setTimeout(iniciarVitrine, OCIOSO_MS);
  }

  // O primeiro toque só fecha a vitrine; não abre nada que estivesse por baixo.
  vit.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); pararVitrine(); armarOcioso(); });
  vit.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function () { if (!vitAtiva) armarOcioso(); }, { passive: true, capture: true });
  });
  window.addEventListener('scroll', function () { if (!vitAtiva) armarOcioso(); }, { passive: true });
  $('#ex-vitrine-btn').addEventListener('click', function (ev) { ev.stopPropagation(); setTimeout(iniciarVitrine, 50); });
  if (/[?&]vitrine=1/.test(location.search)) setTimeout(iniciarVitrine, 300);
  armarOcioso();
})();
