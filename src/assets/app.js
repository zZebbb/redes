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
  // Autores no card: até 3 nomes em ABNT; mais que isso, "SOBRENOME, Nome et al."
  function autoresCurto(x) {
    var c = x.citacao && x.citacao.length ? x.citacao : x.autores;
    return c.length > 3 ? c[0] + ' et al.' : c.join('; ');
  }
  function eixoBadge(eixo) {
    var info = eixo && SITE.eixos && SITE.eixos[eixo];
    return info ? '<span class="eixo-badge" style="--c:' + info[1] + '" title="' + esc(eixo) + '">' + esc(info[0]) + '</span>' : '';
  }
  function linhaTabela(x) {
    var href = SITE.base + 'trabalho/' + encodeURIComponent(x.slug) + '/';
    return '<tr><td class="t-id">' + esc(x.id) + '</td>' +
      '<td class="t-tit"><a href="' + href + '">' + esc((x.titulos && x.titulos[idioma]) || x.titulo) + '</a></td>' +
      '<td class="t-aut">' + esc(autoresCurto(x)) + '</td>' +
      '<td class="t-eixo">' + eixoBadge(x.eixo) + '</td>' +
      '<td class="t-mod">' + esc(x.modalidade || '') + '</td></tr>';
  }
  function cardTrabalho(x) {
    return '<li><a class="paper-card" href="' + SITE.base + 'trabalho/' + encodeURIComponent(x.slug) + '/">' +
      '<div class="paper-card__body"><p class="paper-card__title">' + esc((x.titulos && x.titulos[idioma]) || x.titulo) + '</p>' +
      '<p class="paper-card__authors">' + esc(autoresCurto(x)) + '</p>' +
      '<p class="paper-card__meta">' + eixoBadge(x.eixo) + (x.modalidade ? '<span class="paper-card__mod">' + esc(x.modalidade) + '</span>' : '') + '</p></div>' +
      '<span class="paper-card__thumb" aria-hidden="true">' + esc(SITE.mono || '') + '</span>' +
      (SITE.selo ? '<span class="paper-card__badge">' + esc(SITE.selo) + '</span>' : '') + '</a></li>';
  }

  function paginaTrabalhos() {
    var lista = $('#lista'), q = $('#q'), qTopo = $('#q-topo');
    var contagem = $('#contagem'), pag = $('#paginacao');
    var porPagina = SITE.porPagina || 12;
    var dados = [], fuse = null;
    var params = new URLSearchParams(location.search);
    var estado = { q: params.get('q') || '', eixo: params.get('eixo') || '', mod: params.get('modalidade') || '', p: parseInt(params.get('p'), 10) || 1 };
    q.value = estado.q; if (qTopo) qTopo.value = estado.q;

    // Cards ou tabela: a escolha fica guardada neste navegador.
    var tabela = $('#tabela'), vista = 'cards';
    try { if (localStorage.getItem('vista') === 'tabela') vista = 'tabela'; } catch (e) {}
    $$('.vista button').forEach(function (b) {
      b.addEventListener('click', function () {
        vista = b.dataset.vista;
        try { localStorage.setItem('vista', vista); } catch (e) {}
        render();
      });
    });

    // No celular os filtros ficam recolhidos atrás de um botão.
    var btnFiltros = $('#abrir-filtros'), nFiltros = $('#n-filtros'), caixaFiltros = $('#sidebar-corpo');
    btnFiltros.addEventListener('click', function () {
      var aberto = btnFiltros.getAttribute('aria-expanded') === 'true';
      btnFiltros.setAttribute('aria-expanded', String(!aberto));
      caixaFiltros.classList.toggle('aberto', !aberto);
    });
    if (estado.eixo || estado.mod) { btnFiltros.setAttribute('aria-expanded', 'true'); caixaFiltros.classList.add('aberto'); }

    function urlEstado() {
      var u = new URLSearchParams();
      if (estado.q) u.set('q', estado.q);
      if (estado.eixo) u.set('eixo', estado.eixo);
      if (estado.mod) u.set('modalidade', estado.mod);
      if (estado.p > 1) u.set('p', estado.p);
      var s = u.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
      var n = (estado.eixo ? 1 : 0) + (estado.mod ? 1 : 0);
      nFiltros.textContent = n; nFiltros.hidden = !n;
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

    var CAMPO = { eixo: 'eixo', mod: 'modalidade' };
    function render() {
      var res;
      var termo = semAcento(estado.q.trim());
      if (termo) {
        res = buscaExata(termo);
        // Sem resultado exato: busca aproximada (erros de digitação) em título, autores e palavras-chave.
        if (!res.length && fuse) res = fuse.search(termo).map(function (r) { return r.item; });
      } else res = dados.slice();
      var porBusca = res;
      if (estado.eixo) res = res.filter(function (x) { return x.eixo === estado.eixo; });
      if (estado.mod) res = res.filter(function (x) { return x.modalidade === estado.mod; });

      // Contadores da barra lateral: quantos trabalhos cada opção mostraria com a busca e o outro filtro atuais.
      $$('.filter-group[data-campo]').forEach(function (g) {
        var campo = g.dataset.campo, outro = campo === 'eixo' ? 'mod' : 'eixo';
        var base = porBusca.filter(function (x) { return !estado[outro] || x[CAMPO[outro]] === estado[outro]; });
        $$('button[data-valor]', g).forEach(function (b) {
          var n = base.filter(function (x) { return x[CAMPO[campo]] === b.dataset.valor; }).length;
          var on = estado[campo] === b.dataset.valor;
          $('.fl-n', b).textContent = n.toLocaleString('pt-BR');
          b.setAttribute('aria-pressed', String(on));
          b.disabled = !n && !on;
        });
      });

      var total = res.length, paginas = Math.max(1, Math.ceil(total / porPagina));
      if (estado.p > paginas) estado.p = paginas;
      var ini = (estado.p - 1) * porPagina;
      var pagina = res.slice(ini, ini + porPagina);
      $$('.vista button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.vista === vista)); });
      var emTabela = vista === 'tabela' && total > 0;
      tabela.hidden = !emTabela; lista.hidden = emTabela;
      if (emTabela) tabela.innerHTML = '<table class="papers-table"><thead><tr><th scope="col">Nº</th><th scope="col">' + esc(t('lista.col_titulo')) + '</th><th scope="col">' + esc(t('lista.col_autores')) + '</th><th scope="col">' + esc(t('lista.eixo')) + '</th><th scope="col">' + esc(t('lista.modalidade')) + '</th></tr></thead><tbody>' + pagina.map(linhaTabela).join('') + '</tbody></table>';
      lista.innerHTML = total ? pagina.map(cardTrabalho).join('') : '<li class="vazio-lista">' + esc(t('lista.nenhum')) + '</li>';
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
    $$('.filter-group[data-campo] button[data-valor]').forEach(function (b) {
      b.addEventListener('click', function () {
        var campo = b.closest('.filter-group').dataset.campo;
        estado[campo] = estado[campo] === b.dataset.valor ? '' : b.dataset.valor;
        estado.p = 1; render();
      });
    });
    var timer;
    function buscar(v) { estado.q = v; estado.p = 1; render(); }
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (qTopo) qTopo.value = q.value; buscar(q.value); }, 120);
    });
    // A busca do banner também filtra aqui mesmo, sem recarregar a página.
    if (qTopo) qTopo.form.addEventListener('submit', function (ev) {
      ev.preventDefault(); q.value = qTopo.value; buscar(qTopo.value);
      $('.pag-tit').scrollIntoView({ behavior: 'smooth' });
    });
    $('#limpar').addEventListener('click', function () {
      estado = { q: '', eixo: '', mod: '', p: 1 };
      q.value = ''; if (qTopo) qTopo.value = '';
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
      lista.innerHTML = '<li class="vazio-lista">Erro ao carregar os trabalhos.</li>';
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
    var q = $('#q-aut'), qInst = $('#q-inst'), itens = $$('.author-card'), nenhum = $('#aut-nenhum');
    var letrasBtn = $$('.alphabet button'), instBtn = $$('.filter-group[data-campo=inst] button[data-valor]');
    var estado = { q: '', letra: '', inst: '' };
    itens.forEach(function (li) { li._inst = JSON.parse(li.dataset.inst || '[]'); });
    // No celular a lista de instituições começa fechada para os autores aparecerem logo.
    var grupoInst = $('details.filter-group[data-campo=inst]');
    if (grupoInst && window.matchMedia('(max-width: 900px)').matches) grupoInst.open = false;

    function render() {
      var termo = semAcento(q.value.trim());
      var algum = false, letrasCom = {};
      itens.forEach(function (li) {
        var ok = (!termo || li.dataset.busca.indexOf(termo) >= 0) && (!estado.inst || li._inst.indexOf(estado.inst) >= 0);
        if (ok) letrasCom[li.dataset.letra] = 1;
        var on = ok && (!estado.letra || li.dataset.letra === estado.letra);
        li.hidden = !on; if (on) algum = true;
      });
      letrasBtn.forEach(function (b) {
        var l = b.dataset.letra;
        b.classList.toggle('active', l === estado.letra);
        b.setAttribute('aria-pressed', String(l === estado.letra));
        if (l) b.disabled = !letrasCom[l] && l !== estado.letra;
      });
      instBtn.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.valor === estado.inst)); });
      nenhum.hidden = algum;
    }
    q.addEventListener('input', render);
    letrasBtn.forEach(function (b) { b.addEventListener('click', function () { estado.letra = b.dataset.letra; render(); }); });
    instBtn.forEach(function (b) {
      b.addEventListener('click', function () { estado.inst = estado.inst === b.dataset.valor ? '' : b.dataset.valor; render(); });
    });
    if (qInst) qInst.addEventListener('input', function () {
      var termo = semAcento(qInst.value.trim());
      instBtn.forEach(function (b) { b.parentNode.hidden = termo && semAcento(b.dataset.valor).indexOf(termo) < 0; });
    });

    function abrirHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      var el = id && document.getElementById(id);
      if (el && el.classList.contains('author-card')) {
        estado = { q: '', letra: '', inst: '' }; q.value = ''; render();
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
