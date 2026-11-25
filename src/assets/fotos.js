/* Página "Fotos": mural com as fotos do encontro (pessoas ao lado da TV com o próprio banner).
   Tocar numa foto abre grande, com setas e deslize para passar; cada foto ligada a um trabalho leva a ele e ao banner. */
(function () {
  'use strict';
  var D = window.FOTOS, SITE = window.SITE || { base: '../' }, I18N = window.I18N || {};
  if (!D) return;
  var OCIOSO_MS = 90000;
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

  // Na TV, depois de 90 s sem toque, volta ao mural completo.
  var timerOcioso = null;
  function reiniciar() { fechar(); if (q.value) { q.value = ''; montar(); } q.blur(); window.scrollTo(0, 0); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function () { clearTimeout(timerOcioso); timerOcioso = setTimeout(reiniciar, OCIOSO_MS); }, { passive: true, capture: true });
  });

  new MutationObserver(function () { var a = atual, aberta = !caixa.hidden; montar(); if (aberta) mostrar(a); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  montar();
  // Link direto para uma foto (?foto=ID), vindo da página do trabalho.
  var alvo = params.get('foto');
  if (alvo) { var i = lista.findIndex(function (f) { return f.id === alvo; }); if (i >= 0) abrir(i); }
  timerOcioso = setTimeout(reiniciar, OCIOSO_MS);
})();
