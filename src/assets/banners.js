/* Página "Banners": cada banner é um crachá pendurado num trilho, com a fita na cor do eixo.
   Tocar num crachá puxa ele para a frente; tocar de novo vira o crachá e mostra os autores e o botão do modo foto.
   Movimento inspirado num componente "team lanyard rail" (21st.dev), refeito sem React e com a identidade da Rede. */
(function () {
  'use strict';
  var D = window.BANNERS, SITE = window.SITE || { base: '../' }, I18N = window.I18N || {};
  if (!D || !D.trabalhos.length) return;
  var AUTO_MS = 4200, VOLTA_AUTO_MS = 25000, OCIOSO_MS = 90000;
  var REST_Y = [9, -10, 7, -8, 10, -7, 8, -9], REST_Z = [-1.6, 1.2, -2, 1.5, -1, 1.8, -1.3, 2], QUEDA = [6, 20, 0, 13, 22, 4, 16, 9];
  var reduzir = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function idioma() { var l = (document.documentElement.lang || 'pt').slice(0, 2); return l === 'en' || l === 'es' ? l : 'pt'; }
  function t(k) { var l = idioma(); return (I18N[l] && I18N[l][k]) || (I18N.pt && I18N.pt[k]) || k; }
  function tit(x) { return x.t[idioma()] || x.t.pt; }
  function eixoDe(x) { for (var i = 0; i < D.eixos.length; i++) if (D.eixos[i].id === x.eixo) return D.eixos[i]; return D.eixos[0]; }
  function nomeEixo(e) { return e.nome[idioma()] || e.nome.pt; }
  D.trabalhos.forEach(function (x) { x.busca = semAcento([x.n, x.t.pt, x.t.en, x.t.es].concat(x.a).join(' ')); });

  var abas = $('.bn-abas'), trilho = $('.bn-trilho'), pecas = $('.bn-pecas'), legenda = $('.bn-legenda'), q = $('#bn-q');
  var foto = $('.bn-foto');
  var eixoAtual = 0, itens = [], ativo = -1, virado = -1, els = [];
  var timerAuto = null, timerVolta = null, timerOcioso = null;

  // ---------------- Abas e busca ----------------
  var temas = D.eixos.filter(function (e) { return D.trabalhos.some(function (x) { return x.eixo === e.id; }); });
  function montarAbas() {
    var buscando = q.value.trim() !== '';
    abas.innerHTML = temas.map(function (e, i) {
      var n = D.trabalhos.filter(function (x) { return x.eixo === e.id; }).length;
      return '<button type="button" data-i="' + i + '" style="--c:' + e.cor + '" aria-pressed="' + (!buscando && i === eixoAtual) + '">' +
        '<span class="bn-aba-eixo">' + esc(e.curto) + '</span><span class="bn-aba-nome">' + esc(nomeEixo(e)) + '</span><span class="bn-aba-n">' + n + '</span></button>';
    }).join('');
  }
  abas.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    eixoAtual = +b.dataset.i; q.value = '';
    montarAbas(); carregar(); interagiu();
  });
  q.addEventListener('input', function () { montarAbas(); carregar(); interagiu(); });

  function lista() {
    var termo = semAcento(q.value.trim());
    if (!termo) return D.trabalhos.filter(function (x) { return x.eixo === temas[eixoAtual].id; });
    if (/^\d+$/.test(termo)) return D.trabalhos.filter(function (x) { return x.n === termo.padStart(3, '0') || x.n.indexOf(termo) === 0 || x.n.replace(/^0+/, '').indexOf(termo) === 0; });
    var palavras = termo.split(/\s+/);
    return D.trabalhos.filter(function (x) { return palavras.every(function (p) { return x.busca.indexOf(p) >= 0; }); });
  }

  // ---------------- Crachás ----------------
  function cracha(x, i) {
    var e = eixoDe(x), k = i % 8;
    return '<li class="bn-peca" data-i="' + i + '" style="--c:' + e.cor + ';--ry:' + REST_Y[k] + 'deg;--rz:' + REST_Z[k] + 'deg;--queda:' + QUEDA[k] + 'px">' +
      '<span class="bn-fita" aria-hidden="true"><span class="bn-mosquetao"></span></span>' +
      '<span class="bn-balanco">' +
        '<span class="bn-presilha" aria-hidden="true"></span>' +
        '<button type="button" class="bn-giro" aria-label="' + esc(x.n + ' · ' + tit(x)) + '">' +
          '<span class="bn-frente">' +
            '<span class="bn-faixa"><span class="bn-furo"></span><span class="bn-num">' + esc(x.n) + '</span><span class="bn-eixo">' + esc(e.curto) + '</span></span>' +
            '<span class="bn-thumb"><img src="' + SITE.base + x.img + '" alt="" loading="lazy" draggable="false"></span>' +
            '<span class="bn-tit">' + esc(tit(x)) + '</span>' +
          '</span>' +
          '<span class="bn-verso">' +
            '<span class="bn-faixa"><span class="bn-furo"></span><span class="bn-num">' + esc(x.n) + '</span><span class="bn-eixo">' + esc(e.curto) + '</span></span>' +
            '<span class="bn-verso-in"><span class="bn-verso-rot">' + esc(nomeEixo(e)) + '</span>' +
            '<span class="bn-autores">' + x.a.map(esc).join('<br>') + '</span>' +
            '<span class="bn-abrir-foto">' + esc(t('bn.abrir')) + '</span></span>' +
          '</span>' +
        '</button>' +
      '</span></li>';
  }

  function carregar() {
    itens = lista();
    ativo = -1; virado = -1;
    trilho.classList.toggle('vazia', !itens.length);
    pecas.innerHTML = itens.map(cracha).join('');
    els = $$('.bn-peca', pecas);
    cancelAnimationFrame(anim); pos = 0; aplicar();
    $('.bn-nada').hidden = !!itens.length;
    pintar(); mostrarLegenda();
    if (itens.length) autoplay();
  }

  function pintar() {
    els.forEach(function (el, i) {
      el.classList.toggle('ativa', i === ativo);
      el.classList.toggle('virada', i === virado);
      $('.bn-giro', el).setAttribute('aria-pressed', String(i === ativo));
    });
    trilho.classList.toggle('com-ativo', ativo >= 0);
  }

  function balancar(el) {
    if (reduzir || !el) return;
    el.classList.remove('balanca'); void el.offsetWidth; el.classList.add('balanca');
  }

  // O trilho anda por transform (camada da GPU), não por rolagem: segue o dedo sem atraso.
  var pos = 0, anim = 0;
  function limite() { return Math.max(0, pecas.offsetWidth - trilho.clientWidth); }
  function prender(x) { return Math.min(limite(), Math.max(0, x)); }
  function aplicar() { pecas.style.transform = 'translate3d(' + (-pos).toFixed(2) + 'px,0,0)'; }
  function irPara(x, dur) {
    cancelAnimationFrame(anim);
    x = prender(x);
    if (reduzir || !dur) { pos = x; aplicar(); return; }
    var de = pos, t0 = performance.now();
    (function passo(agora) {
      var k = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      pos = de + (x - de) * e; aplicar();
      if (k < 1) anim = requestAnimationFrame(passo);
    })(t0);
  }
  function centralizar(i) {
    var el = els[i]; if (!el) return;
    irPara(el.offsetLeft + el.offsetWidth / 2 - trilho.clientWidth / 2, 600);
  }

  function ativar(i, virar) {
    if (i < 0 || i >= els.length) return;
    if (i !== ativo) {
      var antes = ativo;
      ativo = i; virado = -1;
      balancar(els[i]); if (antes >= 0) balancar(els[antes]);
      centralizar(i);
    } else if (virar) {
      virado = virado === i ? -1 : i;
    }
    pintar(); mostrarLegenda();
  }

  function mostrarLegenda() {
    if (!itens.length) { legenda.innerHTML = ''; return; }
    if (ativo < 0) { legenda.innerHTML = '<p class="bn-leg-dica">' + esc(t('bn.toque')) + '</p>'; return; }
    var x = itens[ativo], e = eixoDe(x);
    legenda.innerHTML = '<p class="bn-leg-n" style="--c:' + e.cor + '">' + esc(x.n) + '<span>' + esc(e.curto) + '</span></p>' +
      '<p class="bn-leg-t">' + esc(tit(x)) + '</p><p class="bn-leg-a">' + esc(virado === ativo ? t('bn.desvirar') : t('bn.virar')) + '</p>' +
      '<button type="button" class="btn bn-abrir">' + esc(t('bn.abrir')) + '</button>';
    $('.bn-abrir', legenda).addEventListener('click', function () { abrirFoto(ativo); });
  }

  pecas.addEventListener('click', function (ev) {
    var li = ev.target.closest('.bn-peca'); if (!li) return;
    interagiu();
    var i = +li.dataset.i;
    if (ev.target.closest('.bn-abrir-foto') && virado === i) { abrirFoto(i); return; }
    ativar(i, true);
  });
  pecas.addEventListener('keydown', function (ev) {
    var li = ev.target.closest('.bn-peca'); if (!li) return;
    var i = +li.dataset.i;
    if (ev.key === 'ArrowRight' && els[i + 1]) { $('.bn-giro', els[i + 1]).focus(); ativar(i + 1); }
    if (ev.key === 'ArrowLeft' && els[i - 1]) { $('.bn-giro', els[i - 1]).focus(); ativar(i - 1); }
  });
  trilho.addEventListener('pointerdown', interagiu, { passive: true });

  // Arrastar o trilho com o dedo ou o mouse: segue o dedo 1:1, estica nas pontas e solta com embalo.
  // Um arrasto não conta como toque no crachá.
  var arr = null, arrastou = false;
  trilho.addEventListener('pointerdown', function (ev) {
    if (ev.button > 0) return;
    cancelAnimationFrame(anim);
    arr = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, inicio: pos, pts: [[performance.now(), ev.clientX]], ativo: false };
    arrastou = false;
  });
  trilho.addEventListener('pointermove', function (ev) {
    if (!arr || ev.pointerId !== arr.id) return;
    var dx = ev.clientX - arr.x;
    if (!arr.ativo) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(ev.clientY - arr.y) > Math.abs(dx)) { arr = null; return; }
      arr.ativo = true; arrastou = true; arr.x = ev.clientX; arr.inicio = pos; dx = 0;
      trilho.classList.add('arrastando');
      try { trilho.setPointerCapture(ev.pointerId); } catch (e) {}
    }
    var agora = performance.now();
    arr.pts.push([agora, ev.clientX]);
    while (arr.pts.length > 2 && agora - arr.pts[0][0] > 100) arr.pts.shift();
    var p = arr.inicio - dx, max = limite();
    if (p < 0) p = p * 0.35; else if (p > max) p = max + (p - max) * 0.35;
    pos = p; aplicar();
  }, { passive: true });
  function soltar(ev) {
    if (!arr || ev.pointerId !== arr.id) return;
    var a = arr; arr = null;
    trilho.classList.remove('arrastando');
    if (!a.ativo) return;
    var p0 = a.pts[0], p1 = a.pts[a.pts.length - 1], dt = p1[0] - p0[0];
    var v = dt > 0 && performance.now() - p1[0] < 80 ? (p1[1] - p0[1]) / dt : 0; // px por ms
    var alvo = prender(pos - v * 380);
    var dist = Math.abs(alvo - pos);
    irPara(alvo, Math.min(1100, Math.max(320, Math.abs(v) > 0.05 ? 3 * dist / Math.abs(v) : 320)));
  }
  trilho.addEventListener('pointerup', soltar);
  trilho.addEventListener('pointercancel', soltar);
  trilho.addEventListener('click', function (ev) { if (arrastou) { ev.stopPropagation(); ev.preventDefault(); arrastou = false; } }, true);
  // Roda do mouse / trackpad na horizontal.
  trilho.addEventListener('wheel', function (ev) {
    var d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : (ev.shiftKey ? ev.deltaY : 0);
    if (!d) return;
    ev.preventDefault(); cancelAnimationFrame(anim); interagiu();
    pos = prender(pos + d); aplicar();
  }, { passive: false });
  // O foco do teclado pode rolar o contêiner por conta própria; devolve isso para o transform.
  trilho.addEventListener('scroll', function () {
    if (!trilho.scrollLeft) return;
    var x = trilho.scrollLeft; trilho.scrollLeft = 0; pos = prender(pos + x); aplicar();
  });
  trilho.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  trilho.addEventListener('click', function (ev) { if (!ev.target.closest('.bn-peca') && ativo >= 0) { ativo = -1; virado = -1; pintar(); mostrarLegenda(); } });

  // Enquanto ninguém mexe, os crachás vêm para a frente um de cada vez.
  function autoplay() {
    clearInterval(timerAuto);
    if (reduzir || !els.length) return;
    timerAuto = setInterval(function () { ativar((ativo + 1) % els.length); }, AUTO_MS);
    setTimeout(function () { if (ativo < 0 && els.length) ativar(0); }, 900);
  }
  function interagiu() {
    clearInterval(timerAuto);
    clearTimeout(timerVolta);
    timerVolta = setTimeout(autoplay, VOLTA_AUTO_MS);
  }
  function reiniciar() {
    fecharFoto();
    if (q.value) { q.value = ''; montarAbas(); carregar(); }
    q.blur();
    window.scrollTo(0, 0);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function () { clearTimeout(timerOcioso); timerOcioso = setTimeout(reiniciar, OCIOSO_MS); }, { passive: true, capture: true });
  });

  // ---------------- Modo foto ----------------
  function abrirFoto(i) {
    var x = itens[i]; if (!x) return;
    var e = eixoDe(x);
    clearInterval(timerAuto); clearTimeout(timerVolta);
    $('.bn-foto-img img', foto).src = SITE.base + x.img;
    $('.bn-foto-n', foto).innerHTML = esc(x.n) + '<span style="--c:' + e.cor + '">' + esc(e.curto) + '</span>';
    $('.bn-foto-t', foto).textContent = tit(x);
    $('.bn-foto-a', foto).textContent = x.a.join(', ');
    foto.hidden = false;
    document.documentElement.classList.add('ex-travado');
    requestAnimationFrame(function () { foto.classList.add('aberta'); $('.bn-foto-voltar', foto).focus({ preventScroll: true }); });
  }
  function fecharFoto() {
    if (foto.hidden) return;
    foto.classList.remove('aberta');
    document.documentElement.classList.remove('ex-travado');
    setTimeout(function () { foto.hidden = true; }, reduzir ? 0 : 300);
    if (els[ativo]) $('.bn-giro', els[ativo]).focus({ preventScroll: true });
    interagiu();
  }
  $('.bn-foto-voltar', foto).addEventListener('click', fecharFoto);
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (!foto.hidden) fecharFoto(); else if (virado >= 0) { virado = -1; pintar(); mostrarLegenda(); }
  });

  new MutationObserver(function () {
    var a = ativo, v = virado; montarAbas();
    pecas.innerHTML = itens.map(cracha).join(''); els = $$('.bn-peca', pecas);
    ativo = a; virado = v; pintar(); mostrarLegenda();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.addEventListener('resize', function () { pos = prender(pos); aplicar(); });
  montarAbas();
  carregar();
  // Link direto (?n=013, vindo da página do trabalho): abre esse banner já em tela cheia.
  (function () {
    var n = (new URLSearchParams(location.search).get('n') || '').replace(/\D/g, '');
    if (!n) return;
    n = n.padStart(3, '0');
    var alvo = D.trabalhos.filter(function (x) { return x.n === n; })[0]; if (!alvo) return;
    eixoAtual = Math.max(0, temas.findIndex(function (e) { return e.id === alvo.eixo; }));
    montarAbas(); carregar();
    var i = itens.indexOf(alvo); if (i < 0) return;
    clearInterval(timerAuto);
    ativar(i); abrirFoto(i);
  })();
  timerOcioso = setTimeout(reiniciar, OCIOSO_MS);
})();
