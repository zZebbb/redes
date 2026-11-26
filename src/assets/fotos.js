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
  // Qual animação fica no topo: 'esfera' (padrão) ou 'roda' (data-modo="roda" na seção, ou ?topo=roda).
  var MODO = params.get('topo') === 'roda' || roda.dataset.modo === 'roda' ? 'roda' : 'esfera';
  var motor = { pintar: function () { pintarRoda(); }, girar: function () { girarSozinha(); } };
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
  if (rodaFotos.length && MODO === 'roda') {
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
  } else if (MODO === 'esfera' && D.fotos.length) {
    montarEsfera();
  } else {
    roda.hidden = true;
  }

  // ---------------- Esfera (fotos redondas espalhadas numa esfera 3D que gira) ----------------
  // Pontos distribuídos pela espiral de Fibonacci; arrastar gira em dois eixos com inércia;
  // gira sozinha devagar; tocar numa foto abre ela grande.
  function montarEsfera() {
    var ESF_MIN = 60, ESF_MAX = 80, VEL_AUTO = 0.00018; // rad por ms
    var base = D.fotos.slice(0, ESF_MAX), itens = [];
    for (var i = 0; base.length && itens.length < Math.max(ESF_MIN, base.length); i++) itens.push(base[i % base.length]);
    var n = itens.length, ouro = Math.PI * (3 - Math.sqrt(5)), pontos = [];
    for (i = 0; i < n; i++) {
      var y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), th = ouro * i;
      pontos.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    roda.classList.add('fo-esfera');
    anel.innerHTML = itens.map(function (f) {
      var x = trab(f), eixo = x && D.eixos[x.eixo];
      return '<button type="button" class="fo-esf-foto" data-id="' + esc(f.id) + '" style="--c:' + esc(eixo ? eixo.cor : '#2E54A2') + '" aria-label="' + esc(x ? f.n + ' · ' + tit(x) : t('fo.sem_trabalho')) + '">' +
        '<img src="' + SITE.base + esc(f.p) + '" alt="" draggable="false" loading="lazy"></button>';
    }).join('');
    var bolas = Array.prototype.slice.call(anel.children);
    var rotX = -0.25, rotY = 0, vx = 0, vy = 0, ultimo = 0, quadro = 0, m = null;
    function medir() {
      var w = anel.clientWidth, h = anel.clientHeight, larga = w >= h * 1.15;
      roda.classList.toggle('fo-esfera-larga', larga);
      m = larga ? { cx: w * 0.6, cy: h / 2, R: Math.min(w * 0.36, h * 0.42) }
        : { cx: w / 2, cy: h * 0.53, R: Math.min(w * 0.45, h * 0.42) };
      m.tam = m.R * 0.26;
      bolas.forEach(function (b) { b.style.width = b.style.height = m.tam.toFixed(1) + 'px'; });
    }
    function pintar() {
      if (!m) medir();
      var cX = Math.cos(rotX), sX = Math.sin(rotX), cY = Math.cos(rotY), sY = Math.sin(rotY), persp = 3.2;
      for (var i = 0; i < n; i++) {
        var p = pontos[i], x = p[0] * cY + p[2] * sY, z = -p[0] * sY + p[2] * cY, y = p[1];
        var y2 = y * cX - z * sX, z2 = y * sX + z * cX;
        var k = persp / (persp - z2), b = bolas[i];
        if (z2 < -0.3) { if (b.style.visibility !== 'hidden') b.style.visibility = 'hidden'; continue; }
        // Frente da esfera bem maior que as bordas (como na referência): cresce com o quadrado da profundidade.
        var f = (z2 + 1) / 2, esc2 = k * (0.22 + 0.9 * f * f);
        if (b.style.visibility) b.style.visibility = '';
        // Só transform e opacidade mudam a cada quadro: a placa de vídeo faz o trabalho, sem recalcular o layout.
        b.style.transform = 'translate3d(' + (m.cx + x * m.R * k - m.tam / 2).toFixed(2) + 'px,' + (m.cy + y2 * m.R * k - m.tam / 2).toFixed(2) + 'px,0) scale(' + esc2.toFixed(4) + ')';
        b.style.opacity = z2 < 0.1 ? Math.max(0, 0.15 + 0.85 * (z2 + 0.3) / 0.4).toFixed(3) : '1';
        b.style.zIndex = String(Math.round((z2 + 1) * 500));
      }
    }
    function laco(agora) {
      var dt = ultimo ? Math.min(50, agora - ultimo) : 16; ultimo = agora;
      if (!arr) {
        if (Math.abs(vx) > 1e-5 || Math.abs(vy) > 1e-5) { rotY += vy * dt; rotX += vx * dt; vx *= Math.pow(0.95, dt / 16); vy *= Math.pow(0.95, dt / 16); }
        if (!reduzir) rotY += VEL_AUTO * dt;
        // Volta devagar para uma inclinação confortável.
        rotX += (-0.25 - rotX) * Math.min(1, dt * 0.0015);
      }
      pintar();
      quadro = requestAnimationFrame(laco);
    }
    function girar() { if (!quadro) { ultimo = 0; quadro = requestAnimationFrame(laco); } }
    function parar() { cancelAnimationFrame(quadro); quadro = 0; }
    motor = { pintar: function () { medir(); pintar(); }, girar: girar };
    medir(); pintar(); girar();
    window.addEventListener('resize', function () { medir(); pintar(); });
    // Só anima enquanto a esfera está na tela (ou no descanso).
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      if (es[0].isIntersecting || document.body.classList.contains('fo-descansando')) girar(); else parar();
    }).observe(roda);

    var arr = null, arrastou = false;
    anel.addEventListener('pointerdown', function (ev) {
      if (ev.button > 0) return;
      arr = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, ux: ev.clientX, uy: ev.clientY, t: performance.now(), ativo: false };
      arrastou = false;
    });
    anel.addEventListener('pointermove', function (ev) {
      if (!arr || ev.pointerId !== arr.id) return;
      var dx = ev.clientX - arr.x, dy = ev.clientY - arr.y;
      if (!arr.ativo) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx) && ev.pointerType === 'touch' && !document.body.classList.contains('fo-descansando')) { arr = null; return; }
        arr.ativo = arrastou = true; vx = vy = 0;
        try { anel.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      var agora = performance.now(), dt = Math.max(1, agora - arr.t);
      var ddx = (ev.clientX - arr.ux) / m.R, ddy = (ev.clientY - arr.uy) / m.R;
      rotY += ddx; rotX -= ddy;
      vy = 0.6 * (ddx / dt) + 0.4 * vy; vx = 0.6 * (-ddy / dt) + 0.4 * vx;
      arr.ux = ev.clientX; arr.uy = ev.clientY; arr.t = agora;
    }, { passive: true });
    function soltar(ev) {
      if (!arr || ev.pointerId !== arr.id) return;
      if (performance.now() - arr.t > 80) vx = vy = 0;
      var lim = 0.006; vx = Math.max(-lim, Math.min(lim, vx)); vy = Math.max(-lim, Math.min(lim, vy));
      arr = null;
    }
    anel.addEventListener('pointerup', soltar);
    anel.addEventListener('pointercancel', soltar);
    anel.addEventListener('click', function (ev) {
      if (arrastou) { arrastou = false; return; }
      var b = ev.target.closest('.fo-esf-foto'); if (!b) return;
      if (document.body.classList.contains('fo-descansando')) return;
      abrirPorId(b.dataset.id);
    });
    anel.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  }

  // ---------------- Descanso: depois de 60 s sem toque, a roda ocupa a tela ----------------
  var timerOcioso = null;
  function descansar() {
    if (!D.fotos.length || roda.hidden) return;
    fechar(); if (q.value) { q.value = ''; montar(); } q.blur();
    window.scrollTo(0, 0);
    document.body.classList.add('fo-descansando');
    requestAnimationFrame(motor.pintar);
    motor.girar();
  }
  function acordar() {
    document.body.classList.remove('fo-descansando');
    requestAnimationFrame(motor.pintar);
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
