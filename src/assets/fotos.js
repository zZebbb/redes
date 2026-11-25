/* Página "Fotos": mural com as fotos do encontro (pessoas ao lado da TV com o próprio banner).
   Tocar numa foto abre grande, com setas e deslize para passar; cada foto ligada a um trabalho leva a ele e ao banner. */
(function () {
  'use strict';
  var D = window.FOTOS, SITE = window.SITE || { base: '../' }, I18N = window.I18N || {};
  if (!D) return;
  var OCIOSO_MS = 60000;
  var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function idioma() { var l = (document.documentElement.lang || 'pt').slice(0, 2); return l === 'en' || l === 'es' ? l : 'pt'; }
  function t(k) { var l = idioma(); return (I18N[l] && I18N[l][k]) || (I18N.pt && I18N.pt[k]) || k; }
  function trab(f) { return f.n ? D.trabalhos[f.n] : null; }
  function tit(x) { return x ? (x.t[idioma()] || x.t.pt) : ''; }

  D.fotos.forEach(function (f) {
    var x = trab(f);
    f.busca = x ? semAcento([f.n, x.t.pt, x.t.en, x.t.es].concat(x.a).join(' ')) : '';
  });

  var mural = $('.fo-mural'), q = $('#fo-q'), conta = $('.fo-conta'), nada = $('.fo-nada');
  var caixa = $('.fo-caixa'), img = $('.fo-img img', caixa), info = $('.fo-info', caixa);
  var lista = [], atual = -1;

  var params = new URLSearchParams(location.search);
  if (params.get('n')) q.value = params.get('n').replace(/\D/g, '');

  function filtrar() {
    var termo = semAcento(q.value.trim());
    if (!termo) return D.fotos.slice();
    if (/^\d+$/.test(termo)) return D.fotos.filter(function (f) { return f.n && (f.n === termo.padStart(3, '0') || f.n.replace(/^0+/, '').indexOf(termo.replace(/^0+/, '')) === 0); });
    var pal = termo.split(/\s+/);
    return D.fotos.filter(function (f) { return pal.every(function (p) { return f.busca.indexOf(p) >= 0; }); });
  }

  function selo(f) {
    var x = trab(f); if (!x) return '';
    var e = D.eixos[x.eixo];
    return '<span class="fo-n">' + esc(f.n) + '</span>' + (e ? '<span class="fo-eixo" style="--c:' + e.cor + '">' + esc(e.curto) + '</span>' : '');
  }

  function montar() {
    lista = filtrar();
    mural.innerHTML = lista.map(function (f, i) {
      var x = trab(f);
      return '<li><button type="button" class="fo-item" data-i="' + i + '">' +
        '<img src="' + SITE.base + esc(f.p) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="fo-leg">' + (x ? '<span class="fo-selo">' + selo(f) + '</span><span class="fo-tit">' + esc(tit(x)) + '</span>' : '<span class="fo-tit">' + esc(t('fo.sem_trabalho')) + '</span>') + '</span>' +
        '</button></li>';
    }).join('');
    nada.hidden = !!lista.length;
    conta.textContent = lista.length === 1 ? t('fo.uma') : t('fo.varias').replace('{n}', lista.length);
  }

  mural.addEventListener('click', function (ev) {
    var b = ev.target.closest('.fo-item'); if (b) abrir(+b.dataset.i);
  });
  q.addEventListener('input', montar);

  // ---------------- Foto grande ----------------
  function mostrar(i) {
    if (!lista.length) return;
    atual = (i + lista.length) % lista.length;
    var f = lista[atual], x = trab(f);
    caixa.classList.remove('entra'); void caixa.offsetWidth;
    img.src = SITE.base + f.g;
    if (x) {
      info.innerHTML = '<p class="fo-info-n">' + selo(f) + '</p><p class="fo-info-t">' + esc(tit(x)) + '</p><p class="fo-info-a">' + esc(x.a.join(', ')) + '</p>' +
        '<p class="fo-info-botoes"><a class="btn" href="' + SITE.base + 'trabalho/' + esc(f.n) + '/">' + esc(t('fo.ver_trabalho')) + '</a>' +
        (x.banner ? '<a class="btn btn-sec" href="' + SITE.base + 'banners/?n=' + esc(f.n) + '">' + esc(t('fo.ver_banner')) + '</a>' : '') + '</p>';
    } else {
      info.innerHTML = '<p class="fo-info-t">' + esc(t('fo.sem_trabalho')) + '</p>';
    }
    $('.fo-ant', caixa).hidden = $('.fo-prox', caixa).hidden = lista.length < 2;
    caixa.classList.add('entra');
  }
  function abrir(i) {
    caixa.hidden = false;
    document.documentElement.classList.add('ex-travado');
    mostrar(i);
    requestAnimationFrame(function () { caixa.classList.add('aberta'); $('.fo-fechar', caixa).focus({ preventScroll: true }); });
  }
  function fechar() {
    if (caixa.hidden) return;
    caixa.classList.remove('aberta');
    document.documentElement.classList.remove('ex-travado');
    setTimeout(function () { caixa.hidden = true; }, reduzir ? 0 : 300);
    var b = mural.querySelector('[data-i="' + atual + '"]'); if (b) b.focus({ preventScroll: true });
  }
  $('.fo-fechar', caixa).addEventListener('click', fechar);
  $('.fo-ant', caixa).addEventListener('click', function () { mostrar(atual - 1); });
  $('.fo-prox', caixa).addEventListener('click', function () { mostrar(atual + 1); });
  document.addEventListener('keydown', function (ev) {
    if (caixa.hidden) return;
    if (ev.key === 'Escape') fechar();
    else if (ev.key === 'ArrowLeft') mostrar(atual - 1);
    else if (ev.key === 'ArrowRight') mostrar(atual + 1);
  });

  // Deslizar o dedo para os lados passa as fotos.
  var ini = null, palco = $('.fo-palco', caixa);
  palco.addEventListener('pointerdown', function (ev) { if (!ev.target.closest('.fo-seta')) ini = { x: ev.clientX, y: ev.clientY, id: ev.pointerId }; });
  palco.addEventListener('pointerup', function (ev) {
    if (!ini || ev.pointerId !== ini.id) return;
    var dx = ev.clientX - ini.x, dy = ev.clientY - ini.y; ini = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) mostrar(atual + (dx < 0 ? 1 : -1));
  });
  palco.addEventListener('pointercancel', function () { ini = null; });

  function abrirPorId(id) {
    var i = lista.findIndex(function (f) { return f.id === id; });
    if (i < 0) { q.value = ''; montar(); i = lista.findIndex(function (f) { return f.id === id; }); }
    if (i >= 0) abrir(i);
  }

  // ---------------- Roda (as fotos mais recentes girando numa elipse) ----------------
  // Um único ângulo comanda o anel; posição, tamanho e profundidade de cada foto saem do seno/cosseno.
  // Gira sozinha passo a passo (parada 1 s, giro 0,7 s), dá para arrastar e encaixa na foto mais próxima.
  var RODA_N = 14, PARADA_MS = 1000, GIRO_MS = 700;
  var roda = $('.fo-roda'), anel = $('.fo-roda-anel', roda);
  var rodaFotos = D.fotos.slice(0, RODA_N), cartoes = [], ang = 0, animRoda = 0, timerRoda = null;
  var passo = rodaFotos.length ? 2 * Math.PI / rodaFotos.length : 0;
  // Roda no formato do "Halo Reel": centro da elipse na borda esquerda, só a metade direita aparece;
  // as fotos sobem pela roda e a da frente fica no meio, ao lado do título.
  function medidas() {
    var w = anel.clientWidth, h = anel.clientHeight;
    var cw = Math.min(w * 0.3, h * 0.27), ch = cw * 4 / 3;
    return { w: w, h: h, cw: cw, ch: ch, rx: cw * 1.3, ry: h * 0.42 };
  }
  function pintarRoda() {
    var m = medidas();
    roda.style.setProperty('--roda-borda', (m.rx + m.cw / 2).toFixed(0) + 'px');
    cartoes.forEach(function (c, i) {
      var a = ang + i * passo, prof = Math.cos(a), k = (prof + 1) / 2;
      var x = prof * m.rx - m.cw / 2, y = m.h / 2 + Math.sin(a) * m.ry - m.ch / 2, esc = 0.82 + 0.18 * k;
      c.style.width = m.cw.toFixed(1) + 'px'; c.style.height = m.ch.toFixed(1) + 'px';
      c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + esc.toFixed(3) + ')';
      c.style.zIndex = String(Math.round(k * 100));
      c.style.opacity = prof > 0 ? '1' : Math.max(0, 1 + prof * 3).toFixed(2);
      c.style.visibility = prof < -0.34 ? 'hidden' : '';
    });
  }
  function irAng(alvo, dur, depois) {
    cancelAnimationFrame(animRoda);
    if (reduzir || !dur) { ang = alvo; pintarRoda(); if (depois) depois(); return; }
    var de = ang, t0 = performance.now();
    (function q(agora) {
      var k = Math.min(1, (agora - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      ang = de + (alvo - de) * e; pintarRoda();
      if (k < 1) animRoda = requestAnimationFrame(q); else if (depois) depois();
    })(t0);
  }
  function girarSozinha() {
    clearTimeout(timerRoda);
    if (reduzir || rodaFotos.length < 2) return;
    timerRoda = setTimeout(function () { irAng(Math.round(ang / passo) * passo - passo, GIRO_MS, girarSozinha); }, PARADA_MS);
  }
  function pararRoda() { clearTimeout(timerRoda); cancelAnimationFrame(animRoda); }
  if (rodaFotos.length) {
    anel.innerHTML = rodaFotos.map(function (f) {
      var x = trab(f);
      return '<button type="button" class="fo-roda-foto" data-id="' + esc(f.id) + '" aria-label="' + esc(x ? f.n + ' · ' + tit(x) : t('fo.sem_trabalho')) + '">' +
        '<img src="' + SITE.base + esc(f.p) + '" alt="" draggable="false">' + (x ? '<span class="fo-n">' + esc(f.n) + '</span>' : '') + '</button>';
    }).join('');
    cartoes = Array.prototype.slice.call(anel.children);
    pintarRoda();
    girarSozinha();
    window.addEventListener('resize', pintarRoda);

    // Arrastar gira a roda; ao soltar, encaixa na foto mais próxima. Toque sem arrastar abre a foto.
    var arr = null, arrastou = false;
    anel.addEventListener('pointerdown', function (ev) {
      if (ev.button > 0) return;
      pararRoda();
      arr = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, ang: ang, ult: 0, t: performance.now(), v: 0, ativo: false, eixo: 'x' };
      arrastou = false;
    });
    anel.addEventListener('pointermove', function (ev) {
      if (!arr || ev.pointerId !== arr.id) return;
      var dx = ev.clientX - arr.x, dy = ev.clientY - arr.y;
      if (!arr.ativo) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        arr.eixo = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
        // No toque, arrastar na vertical rola a página (fora do descanso); na horizontal gira a roda.
        if (arr.eixo === 'y' && ev.pointerType === 'touch' && !document.body.classList.contains('fo-descansando')) { arr = null; girarSozinha(); return; }
        arr.ativo = arrastou = true; arr.x = ev.clientX; arr.y = ev.clientY; arr.ult = arr.eixo === 'y' ? ev.clientY : ev.clientX; dx = dy = 0;
        try { anel.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      var m = medidas(), d = arr.eixo === 'y' ? dy / m.ry : dx / m.rx, pos = arr.eixo === 'y' ? ev.clientY : ev.clientX;
      var agora = performance.now(), dt = Math.max(1, agora - arr.t);
      arr.v = 0.7 * ((pos - arr.ult) / dt / (arr.eixo === 'y' ? m.ry : m.rx)) + 0.3 * arr.v; arr.ult = pos; arr.t = agora;
      ang = arr.ang + d; pintarRoda();
    }, { passive: true });
    function soltarRoda(ev) {
      if (!arr || ev.pointerId !== arr.id) return;
      var a = arr; arr = null;
      if (!a.ativo) { girarSozinha(); return; }
      var alvo = Math.round((ang + a.v * 260) / passo) * passo;
      irAng(alvo, 520, girarSozinha);
    }
    anel.addEventListener('pointerup', soltarRoda);
    anel.addEventListener('pointercancel', soltarRoda);
    anel.addEventListener('click', function (ev) {
      if (arrastou) { arrastou = false; return; }
      var b = ev.target.closest('.fo-roda-foto'); if (!b) return;
      if (document.body.classList.contains('fo-descansando')) return;
      pararRoda(); abrirPorId(b.dataset.id);
    });
    anel.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  } else {
    roda.hidden = true;
  }

  // ---------------- Descanso: depois de 60 s sem toque, a roda ocupa a tela ----------------
  var timerOcioso = null;
  function descansar() {
    if (!rodaFotos.length) return;
    fechar(); if (q.value) { q.value = ''; montar(); } q.blur();
    window.scrollTo(0, 0);
    document.body.classList.add('fo-descansando');
    requestAnimationFrame(pintarRoda);
    girarSozinha();
  }
  function acordar() {
    document.body.classList.remove('fo-descansando');
    requestAnimationFrame(pintarRoda);
  }
  // O primeiro toque só tira o descanso; não abre nada que estivesse por baixo.
  document.addEventListener('pointerdown', function (ev) {
    if (!document.body.classList.contains('fo-descansando')) return;
    ev.preventDefault(); ev.stopPropagation(); acordar();
  }, true);
  document.addEventListener('click', function (ev) {
    if (Date.now() - (acordar.em || 0) < 400) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  var acordarOrig = acordar; acordar = function () { acordar.em = Date.now(); acordarOrig(); };
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (tipo) {
    document.addEventListener(tipo, function () { clearTimeout(timerOcioso); timerOcioso = setTimeout(descansar, OCIOSO_MS); }, { passive: true, capture: true });
  });
  if (/[?&]descanso=1/.test(location.search)) setTimeout(descansar, 300);

  new MutationObserver(function () { var a = atual, aberta = !caixa.hidden; montar(); if (aberta) mostrar(a); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  montar();
  // Link direto para uma foto (?foto=ID), vindo da página do trabalho.
  var alvo = params.get('foto');
  if (alvo) { var i = lista.findIndex(function (f) { return f.id === alvo; }); if (i >= 0) abrir(i); }
  timerOcioso = setTimeout(descansar, OCIOSO_MS);
})();
