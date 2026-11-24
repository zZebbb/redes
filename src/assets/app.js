/* Comportamento do site: idioma, busca/filtros, abas do resumo, "Como citar" e busca de autores. */
(function () {
  'use strict';
  var SITE = window.SITE || { base: './' };
  var I18N = window.I18N || {};
  var IDIOMAS = ['pt', 'en', 'es'];
  var HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es' };

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  // ---------------- Idioma ----------------
  function lerIdioma() {
    var p = new URLSearchParams(location.search).get('lang');
    if (IDIOMAS.indexOf(p) >= 0) return p;
    try { var s = localStorage.getItem('idioma'); if (IDIOMAS.indexOf(s) >= 0) return s; } catch (e) {}
    return SITE.idiomaPadrao || 'pt';
  }
  var idioma = lerIdioma();
  function t(k, vars) {
    var s = (I18N[idioma] && I18N[idioma][k]) || (I18N.pt && I18N.pt[k]) || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.replace('{' + v + '}', vars[v]); });
    return s;
  }
  function aplicarIdioma() {
    document.documentElement.lang = HTML_LANG[idioma];
    $$('[data-i18n]').forEach(function (el) {
      var attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, t(el.dataset.i18n)); else el.textContent = t(el.dataset.i18n);
    });
    $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-tr]').forEach(function (el) {
      try { var o = JSON.parse(el.dataset.tr); el.textContent = o[idioma] || o.pt || el.textContent; } catch (e) {}
    });
    $$('.idiomas button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === idioma)); });
    if (window.__aoTrocarIdioma) window.__aoTrocarIdioma();
  }
  $$('.idiomas button').forEach(function (b) {
    b.addEventListener('click', function () {
      idioma = b.dataset.lang;
      try { localStorage.setItem('idioma', idioma); } catch (e) {}
      aplicarIdioma();
    });
  });

  // ---------------- Lista de trabalhos ----------------
  function paginaTrabalhos() {
    var lista = $('#lista'), q = $('#q'), fEixo = $('#f-eixo'), fMod = $('#f-mod');
    var contagem = $('#contagem'), pag = $('#paginacao');
    var porPagina = SITE.porPagina || 12;
    var dados = [], fuse = null;
    var params = new URLSearchParams(location.search);
    var estado = { q: params.get('q') || '', eixo: params.get('eixo') || '', mod: params.get('modalidade') || '', p: parseInt(params.get('p'), 10) || 1 };
    q.value = estado.q; fEixo.value = estado.eixo; fMod.value = estado.mod;

    // No celular os filtros ficam recolhidos atrás de um botão.
    var btnFiltros = $('#abrir-filtros'), nFiltros = $('#n-filtros'), caixaFiltros = $('#selects');
    btnFiltros.addEventListener('click', function () {
      var aberto = btnFiltros.getAttribute('aria-expanded') === 'true';
      btnFiltros.setAttribute('aria-expanded', String(!aberto));
      caixaFiltros.classList.toggle('aberto', !aberto);
    });
    function atualizarNFiltros() {
      var n = (estado.eixo ? 1 : 0) + (estado.mod ? 1 : 0);
      nFiltros.textContent = n; nFiltros.hidden = !n;
    }
    if (estado.eixo || estado.mod) { btnFiltros.setAttribute('aria-expanded', 'true'); caixaFiltros.classList.add('aberto'); }

    function urlEstado() {
      var u = new URLSearchParams();
      if (estado.q) u.set('q', estado.q);
      if (estado.eixo) u.set('eixo', estado.eixo);
      if (estado.mod) u.set('modalidade', estado.mod);
      if (estado.p > 1) u.set('p', estado.p);
      var s = u.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
      atualizarNFiltros();
    }

    function card(x) {
      return '<article class="card"><div class="card-tags">' +
        (x.eixo ? '<span class="tag tag-eixo">' + esc(x.eixo) + '</span>' : '') +
        (x.modalidade ? '<span class="tag">' + esc(x.modalidade) + '</span>' : '') +
        '</div><h3 class="card-tit"><a href="' + SITE.base + 'trabalho/' + encodeURIComponent(x.slug) + '/">' + esc((x.titulos && x.titulos[idioma]) || x.titulo) + '</a></h3>' +
        '<p class="card-aut">' + esc(x.autores.join('; ')) + '</p>' +
        (x.resumoTrecho ? '<p class="card-res">' + esc(x.resumoTrecho) + '</p>' : '') +
        '</article>';
    }

    // Todas as palavras digitadas precisam aparecer; título e autores pesam mais que o resumo.
    var PESOS = { titulo: 3, autores: 2.5, pc: 2, id: 2, resumo: 1 };
    function buscaExata(termo) {
      var palavras = termo.split(/\s+/).filter(function (p) { return p.length > 1; });
      if (!palavras.length) return dados.slice();
      return dados.map(function (x) {
        var nota = 0;
        for (var i = 0; i < palavras.length; i++) {
          var achou = 0;
          for (var campo in PESOS) if (x._b[campo].indexOf(palavras[i]) >= 0) achou += PESOS[campo];
          if (!achou) return null;
          nota += achou;
        }
        return { x: x, nota: nota };
      }).filter(Boolean).sort(function (a, b) { return b.nota - a.nota; }).map(function (r) { return r.x; });
    }

    function render() {
      var res;
      var termo = semAcento(estado.q.trim());
      if (termo) {
        res = buscaExata(termo);
        // Sem resultado exato: busca aproximada (erros de digitação) em título, autores e palavras-chave.
        if (!res.length && fuse) res = fuse.search(termo).map(function (r) { return r.item; });
      } else res = dados.slice();
      if (estado.eixo) res = res.filter(function (x) { return x.eixo === estado.eixo; });
      if (estado.mod) res = res.filter(function (x) { return x.modalidade === estado.mod; });

      var total = res.length, paginas = Math.max(1, Math.ceil(total / porPagina));
      if (estado.p > paginas) estado.p = paginas;
      var ini = (estado.p - 1) * porPagina;
      res.slice(ini, ini + porPagina).forEach(function (x) {
        var r = x.resumo[idioma] || x.resumo.pt || '';
        x.resumoTrecho = r.length > 220 ? r.slice(0, 220).replace(/\s+\S*$/, '') + '…' : r;
      });
      lista.innerHTML = total ? res.slice(ini, ini + porPagina).map(card).join('') : '<p class="vazio-lista">' + esc(t('lista.nenhum')) + '</p>';
      contagem.textContent = total === 1 ? t('lista.resultado') : t('lista.resultados', { n: total });

      if (paginas > 1) {
        var h = '<button type="button" data-p="' + (estado.p - 1) + '"' + (estado.p === 1 ? ' disabled' : '') + '>' + esc(t('lista.anterior')) + '</button>';
        h += '<span>' + esc(t('lista.pagina', { p: estado.p, t: paginas })) + '</span>';
        h += '<button type="button" data-p="' + (estado.p + 1) + '"' + (estado.p === paginas ? ' disabled' : '') + '>' + esc(t('lista.proxima')) + '</button>';
        pag.innerHTML = h;
      } else pag.innerHTML = '';
      urlEstado();
    }

    pag.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-p]');
      if (!b) return;
      estado.p = parseInt(b.dataset.p, 10);
      render();
      $('.pag-tit').scrollIntoView({ behavior: 'smooth' });
    });
    var timer;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { estado.q = q.value; estado.p = 1; render(); }, 120);
    });
    fEixo.addEventListener('change', function () { estado.eixo = fEixo.value; estado.p = 1; render(); });
    fMod.addEventListener('change', function () { estado.mod = fMod.value; estado.p = 1; render(); });
    $('#limpar').addEventListener('click', function () {
      estado = { q: '', eixo: '', mod: '', p: 1 };
      q.value = ''; fEixo.value = ''; fMod.value = '';
      render(); q.focus();
    });
    fetch(SITE.base + 'data/trabalhos.json').then(function (r) { return r.json(); }).then(function (json) {
      dados = json.map(function (x) {
        x._b = {
          titulo: semAcento(x.titulos ? [x.titulos.pt, x.titulos.en, x.titulos.es].join(' ') : x.titulo),
          autores: semAcento(x.autores.join(' ')),
          pc: semAcento(x.pc ? [].concat(x.pc.pt, x.pc.en, x.pc.es).join(' ') : x.palavras_chave.join(' ')),
          resumo: semAcento([x.resumo.pt, x.resumo.en, x.resumo.es].join(' ')),
          id: semAcento(x.id)
        };
        return x;
      });
      fuse = new window.Fuse(dados, {
        keys: [
          { name: '_b.titulo', weight: 3 },
          { name: '_b.autores', weight: 2.5 },
          { name: '_b.pc', weight: 2 },
          { name: '_b.id', weight: 2 }
        ],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2
      });
      window.__aoTrocarIdioma = render;
      render();
    }).catch(function () {
      lista.innerHTML = '<p class="vazio-lista">Erro ao carregar os trabalhos.</p>';
    });
  }

  // ---------------- Página do trabalho ----------------
  function paginaTrabalho() {
    var abas = $$('[role=tab]');
    function ativar(l, foco) {
      abas.forEach(function (b) {
        var on = b.dataset.aba === l;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        $('#res-' + b.dataset.aba).hidden = !on;
        if (on && foco) b.focus();
      });
    }
    abas.forEach(function (b, i) {
      b.addEventListener('click', function () { ativar(b.dataset.aba); });
      b.addEventListener('keydown', function (ev) {
        var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        ativar(abas[(i + d + abas.length) % abas.length].dataset.aba, true);
      });
    });
    window.__aoTrocarIdioma = function () { ativar(idioma); };
    ativar(idioma);

    // Compartilhar: menu nativo no celular; no computador, copia o link.
    var btnComp = $('#compartilhar');
    if (btnComp) {
      btnComp.hidden = false;
      btnComp.addEventListener('click', function () {
        var link = location.href.split('#')[0].split('?')[0];
        if (navigator.share) {
          navigator.share({ title: document.querySelector('.trab-tit').textContent, url: link }).catch(function () {});
          return;
        }
        var rot = $('span', btnComp);
        var ok = function () { rot.textContent = t('trab.link_copiado'); setTimeout(function () { rot.textContent = t('trab.compartilhar'); }, 2000); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(link).then(ok, function () {});
      });
    }

    // Como citar (ABNT NBR 6023)
    var dados = JSON.parse($('#dados-citacao').textContent);
    var MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    var hoje = new Date();
    var acesso = hoje.getDate() + ' ' + MESES[hoje.getMonth()] + ' ' + hoje.getFullYear();
    var url = dados.url || location.href.split('#')[0].split('?')[0];
    function montar(html) {
      var b = function (s) { return html ? '<strong>' + esc(s) + '</strong>' : s; };
      var x = function (s) { return html ? esc(s) : s; };
      var evento = (dados.evento || '').toUpperCase();
      var partes = [];
      partes.push(x(dados.autores.join('; ')) + '. ');
      partes.push(x(dados.titulo.replace(/\.$/, '')) + '. ');
      partes.push('In: ' + x(evento) + (dados.numero ? ', ' + x(dados.numero) + '.' : '') + ', ' + x(dados.ano) + (dados.cidade ? ', ' + x(dados.cidade) : '') + '. ');
      partes.push(b('Anais') + ' [...]. ');
      partes.push((dados.cidade ? x(dados.cidade) + ': ' : '') + (dados.editora ? x(dados.editora) + ', ' : '') + x(dados.ano) + '. ');
      if (dados.issn) partes.push('ISSN ' + x(dados.issn) + '. ');
      if (dados.doi) partes.push('DOI: ' + x('https://doi.org/' + dados.doi) + '. ');
      partes.push('Disponível em: ' + x(url) + '. Acesso em: ' + acesso + '.');
      return partes.join('');
    }
    $('#citacao').innerHTML = montar(true);
    var btn = $('#copiar');
    btn.addEventListener('click', function () {
      var texto = montar(false);
      var ok = function () {
        btn.textContent = t('trab.copiado');
        btn.classList.add('ok');
        setTimeout(function () { btn.textContent = t('trab.copiar'); btn.classList.remove('ok'); }, 2000);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, copiarAntigo);
      else copiarAntigo();
      function copiarAntigo() {
        var ta = document.createElement('textarea');
        ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }

  // ---------------- Autores ----------------
  function paginaAutores() {
    var q = $('#q-aut'), itens = $$('.autor'), letras = $$('.letra'), nenhum = $('#aut-nenhum');
    q.addEventListener('input', function () {
      var termo = semAcento(q.value.trim());
      var algum = false;
      itens.forEach(function (li) { var on = !termo || li.dataset.busca.indexOf(termo) >= 0; li.hidden = !on; if (on) algum = true; });
      letras.forEach(function (s) { s.hidden = !$$('.autor', s).some(function (li) { return !li.hidden; }); });
      nenhum.hidden = algum;
    });
    function abrirHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      var el = id && document.getElementById(id);
      if (el && el.classList.contains('autor')) {
        $('details', el).open = true;
        el.classList.add('destaque');
        el.scrollIntoView({ block: 'center' });
      }
    }
    window.addEventListener('hashchange', abrirHash);
    abrirHash();
  }

  aplicarIdioma();
  if (SITE.pagina === 'trabalhos') paginaTrabalhos();
  if (SITE.pagina === 'trabalho') paginaTrabalho();
  if (SITE.pagina === 'autores') paginaAutores();
})();
