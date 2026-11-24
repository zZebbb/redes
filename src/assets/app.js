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

  // ---------------- Abas com indicador deslizante ----------------
  // Um fundo suave segue o mouse e uma linha marca a aba ativa (inspirado no "Vercel Tabs", licença MIT).
  function abasDeslizantes(raiz, sel, ativa, rente) {
    if (!raiz) return;
    raiz.classList.add('vt');
    var hover = document.createElement('span'), ind = document.createElement('span');
    hover.className = 'vt-hover'; ind.className = 'vt-ind';
    hover.setAttribute('aria-hidden', 'true'); ind.setAttribute('aria-hidden', 'true');
    raiz.insertBefore(hover, raiz.firstChild); raiz.insertBefore(ind, raiz.firstChild);
    function por(el, alvo) { el.style.left = alvo.offsetLeft + 'px'; el.style.width = alvo.offsetWidth + 'px'; }
    function posicionar() {
      var a = $(ativa, raiz);
      ind.style.opacity = a ? 1 : 0;
      if (a) { por(ind, a); if (!rente) ind.style.top = (a.offsetTop + a.offsetHeight + 4) + 'px'; }
    }
    $$(sel, raiz).forEach(function (it) {
      it.addEventListener('mouseenter', function () {
        por(hover, it); hover.style.top = it.offsetTop + 'px'; hover.style.height = it.offsetHeight + 'px'; hover.style.opacity = 1;
      });
    });
    raiz.addEventListener('mouseleave', function () { hover.style.opacity = 0; });
    ind.style.transition = 'none'; posicionar();
    requestAnimationFrame(function () { ind.style.transition = ''; });
    new MutationObserver(posicionar).observe(raiz, { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-current'] });
    window.addEventListener('resize', posicionar);
    if (document.fonts) document.fonts.ready.then(posicionar);
  }

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
      try {
        var o = JSON.parse(el.dataset.tr), novo = o[idioma] || o.pt || el.textContent;
        el.textContent = novo;
      } catch (e) {}
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
      '<span class="paper-card__n">' + esc(x.id) + '</span>' +
      '<div class="paper-card__body"><p class="paper-card__title">' + esc((x.titulos && x.titulos[idioma]) || x.titulo) + '</p>' +
      '<p class="paper-card__authors">' + esc(autoresCurto(x)) + '</p>' +
      '<p class="paper-card__meta">' + eixoBadge(x.eixo) + (x.modalidade ? '<span class="paper-card__mod">' + esc(x.modalidade) + '</span>' : '') + '</p></div>' +
      '</a></li>';
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

    // Como citar (ABNT NBR 6023), se a página tiver o bloco
    if (!$('#dados-citacao') || !$('#citacao')) return;
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


  // ---------------- Fundo de letras animado no banner ----------------
  // Adaptado do componente "Glyph Background" do Animate UI (licença MIT), sem React/Motion:
  // letras que surgem em nuvens, rastro ao passar o mouse e ondas ao clicar.
  function fundoGlifos(raiz, opcoes) {
    if (!raiz || !window.WebGLRenderingContext) return;
    // Cada célula mostra um destes textos (padrão: as siglas das 27 unidades da federação, a rede é nacional).
    var CH = opcoes.simbolos || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    var LARGO = Math.max.apply(null, CH.map(function (c) { return c.length; }));
    var MAX_WAVES = 12, TRAIL = 12, TRAIL_LIFE = 700, WAVE_LIFE = 4, WAVE_GAP = 0.3, WAVE_SPEED = 560, WAVE_SLOWDOWN = 0.66;
    var DRIFT = [-30, 12], ACTIVITY_DECAY = 900, fontSize = opcoes.fontSize || 11;
    var VERTEX = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}';
    var FRAGMENT = [
      'precision highp float;',
      'uniform sampler2D atlas;uniform vec2 size;uniform vec2 cell;uniform float dpr;uniform float count;uniform float time;',
      'uniform float rest;uniform float haze;uniform float hoverInk;uniform float activity;uniform vec2 drift;uniform vec3 color;uniform vec3 accent;',
      'uniform vec4 waves[' + MAX_WAVES * 2 + '];uniform vec4 trail[' + TRAIL + '];',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float smoothNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
      'float outline(float kind,float angle,float phase){if(kind<0.5)return 1.0;if(kind<1.5){float s=sin(angle);float c=cos(angle);return (2.0-2.0*s+s*sqrt(abs(c))/(s+1.4))*0.42;}return 1.0+0.14*sin(3.0*angle+phase)+0.08*sin(5.0*angle-phase*1.3);}',
      'void main(){',
      ' vec2 pixel=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y);vec2 index=floor(pixel/cell);vec2 point=(index+0.5)*cell/dpr;',
      ' float ring=0.0;',
      ' for(int i=0;i<' + MAX_WAVES + ';i++){vec4 a=waves[i*2];vec4 b=waves[i*2+1];if(a.w<=0.0)continue;vec2 v=point-a.xy;float angle=atan(-v.y,v.x);',
      '  float shape=mix(1.0,outline(b.x,angle,b.z),b.y);shape*=1.0+0.07*sin(3.0*angle+b.z+b.w)+0.05*sin(5.0*angle-b.z*1.7-b.w*1.3)+0.03*sin(9.0*angle+b.w*2.1);',
      '  float d=length(v)-a.z*shape;float k=d>0.0?d/10.0:d/30.0;ring=max(ring,exp(-k*k)*a.w);}',
      ' float hover=0.0;',
      ' for(int i=0;i<' + TRAIL + ';i++){vec4 t=trail[i];if(t.w<=0.0)continue;vec2 v=point-t.xy;hover+=t.w*exp(-dot(v,v)/(2.0*t.z*t.z));}',
      ' hover=min(hover,1.0);',
      ' mat2 turn=mat2(0.82,0.57,-0.57,0.82);vec2 q=turn*(point-drift);',
      ' float blob=smoothNoise(vec2(q.x/140.0,q.y/80.0)+vec2(time*0.04,0.0))*0.62+smoothNoise(vec2(q.x/62.0,q.y/36.0)+vec2(3.7,time*0.06))*0.38;',
      ' float grain=smoothNoise(vec2(q.x/30.0,q.y/14.0)+vec2(time*0.2,7.3));float cloud=blob*(0.82+0.24*grain);',
      ' float mask=pow(smoothstep(0.47-0.2*activity,0.84,cloud),2.6);',
      ' float seed=hash(index);float epoch=floor(time*0.08*(0.4+seed)+seed*97.0);float character=floor(hash(index+epoch*0.137)*count);',
      ' vec2 local=fract(pixel/cell);float ink=pow(texture2D(atlas,vec2((character+local.x)/count,local.y)).a,1.7);',
      ' float grey=ink*clamp(rest+haze*mask*(1.0+0.3*activity)+hoverInk*hover*(0.6+0.4*mask),0.0,1.0);',
      ' float blue=ink*ring*0.72;float alpha=grey+blue-grey*blue;vec3 tint=color*grey*(1.0-blue)+accent*blue;gl_FragColor=vec4(tint,alpha);',
      '}'
    ].join('\n');

    var canvas = document.createElement('canvas');
    canvas.className = 'glifos'; canvas.setAttribute('aria-hidden', 'true');
    raiz.insertBefore(canvas, raiz.firstChild);
    var fixo = raiz === document.body; if (fixo) canvas.classList.add('glifos-fixo');
    var gl = canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) { canvas.remove(); return; }
    function compilar(tipo, fonte) { var s = gl.createShader(tipo); gl.shaderSource(s, fonte); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = compilar(gl.VERTEX_SHADER, VERTEX), fs = compilar(gl.FRAGMENT_SHADER, FRAGMENT), prog = gl.createProgram();
    if (!vs || !fs) { canvas.remove(); return; }
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(prog, 'position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR); });
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (p) { gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE); });
    var U = {}; ['atlas', 'size', 'cell', 'dpr', 'count', 'time', 'rest', 'haze', 'hoverInk', 'activity', 'drift', 'color', 'accent', 'waves', 'trail'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.atlas, 0); gl.uniform1f(U.count, CH.length); gl.uniform1f(U.rest, 0);
    gl.uniform1f(U.haze, opcoes.haze || 0.1); gl.uniform1f(U.hoverInk, 0.3);
    function rgb(c) { var x = document.createElement('canvas').getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 1, 1); var d = x.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255]; }
    var cor = rgb(opcoes.cor), destaque = rgb(opcoes.destaque);

    var largura = 0, altura = 0, dpr = 1, cell = [7, 13], tempo = 0, ondas = [], rastro = [], energia = { v: 0, at: 0 };
    var W = new Float32Array(MAX_WAVES * 8), T = new Float32Array(TRAIL * 4);
    function redimensionar() {
      if (fixo) { largura = window.innerWidth; altura = window.innerHeight; } else { var r = raiz.getBoundingClientRect(); largura = r.width; altura = r.height; }
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      canvas.width = Math.max(1, Math.round(largura * dpr)); canvas.height = Math.max(1, Math.round(altura * dpr));
      var fonte = (opcoes.peso || 400) + ' ' + (fontSize * dpr) + 'px ' + (opcoes.fonte || 'Menlo, ui-monospace, SFMono-Regular, Consolas, monospace');
      var m = document.createElement('canvas').getContext('2d'); m.font = fonte;
      cell = [Math.round(m.measureText('M'.repeat(LARGO)).width + (LARGO > 1 ? fontSize * 0.25 * dpr : 0)), Math.round(fontSize * 1.25 * dpr)];
      var at = document.createElement('canvas'); at.width = Math.ceil(cell[0] * CH.length); at.height = Math.ceil(cell[1]);
      var c = at.getContext('2d'); c.font = fonte; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      for (var i = 0; i < CH.length; i++) c.fillText(CH[i], (i + 0.5) * cell[0], cell[1] / 2);
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, at);
    }
    function desenhar() {
      if (!largura || !altura) return;
      W.fill(0);
      ondas = ondas.filter(function (o) { return tempo / 1000 - o.inicio < WAVE_LIFE + o.atraso; });
      ondas.slice(-MAX_WAVES).forEach(function (o, i) {
        var idade = tempo / 1000 - o.inicio - o.atraso; if (idade <= 0) return;
        var raio = (WAVE_SPEED * idade) / (1 + WAVE_SLOWDOWN * idade);
        var fade = Math.min(1, idade / 0.05) * Math.exp(-Math.max(0, idade - 0.4) / 1.3) * Math.min(1, (WAVE_LIFE - idade) / 0.5);
        W.set([o.x, o.y, raio, Math.max(0, fade) * o.forca, o.tipo, 0.12 + 0.5 * Math.min(1, idade / 2.2), o.fase, idade * 3], i * 8);
      });
      T.fill(0);
      rastro.forEach(function (p, i) {
        var idade = (tempo - p.t) / TRAIL_LIFE; if (idade < 0 || idade >= 1) return;
        T.set([p.x, p.y, 40 + 25 * idade, 0.3 * (1 - idade) * (1 - idade)], i * 4);
      });
      var s = tempo / 1000, act = energia.v * Math.exp(-Math.max(0, tempo - energia.at) / ACTIVITY_DECAY);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.size, canvas.width, canvas.height); gl.uniform2f(U.cell, cell[0], cell[1]); gl.uniform1f(U.dpr, dpr);
      gl.uniform1f(U.time, s); gl.uniform1f(U.activity, act); gl.uniform2f(U.drift, DRIFT[0] * s, DRIFT[1] * s);
      gl.uniform3f(U.color, cor[0], cor[1], cor[2]); gl.uniform3f(U.accent, destaque[0], destaque[1], destaque[2]);
      gl.uniform4fv(U.waves, W); gl.uniform4fv(U.trail, T);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    redimensionar(); desenhar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { redimensionar(); desenhar(); });
    if (fixo) window.addEventListener('resize', function () { redimensionar(); desenhar(); });
    else if ('ResizeObserver' in window) new ResizeObserver(function () { redimensionar(); desenhar(); }).observe(raiz);

    var menos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (menos) return;
    var visivel = true, rodando = false, ultimo = 0;
    function passo(agora) {
      if (!visivel || document.hidden) { rodando = false; return; }
      tempo += Math.min(agora - (ultimo || agora), 64); ultimo = agora;
      desenhar(); requestAnimationFrame(passo);
    }
    function ligar() { if (!rodando && visivel && !document.hidden) { rodando = true; ultimo = 0; requestAnimationFrame(passo); } }
    if (!fixo && 'IntersectionObserver' in window) new IntersectionObserver(function (e) { visivel = e[0].isIntersecting; ligar(); }).observe(raiz);
    document.addEventListener('visibilitychange', ligar);
    ligar();
    function ponto(ev) { if (fixo) return { x: ev.clientX, y: ev.clientY }; var r = raiz.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    var alvo = fixo ? window : raiz;
    alvo.addEventListener('pointermove', function (ev) {
      var p = ponto(ev), ult = rastro[rastro.length - 1];
      var atual = energia.v * Math.exp(-Math.max(0, tempo - energia.at) / ACTIVITY_DECAY);
      energia = { v: Math.min(1, atual + (ult ? Math.hypot(p.x - ult.x, p.y - ult.y) : 0) / 600), at: tempo };
      if (ult && Math.hypot(p.x - ult.x, p.y - ult.y) < 18) return;
      rastro = rastro.filter(function (q) { return tempo - q.t < TRAIL_LIFE; }).slice(1 - TRAIL);
      rastro.push({ x: p.x, y: p.y, t: tempo });
    });
    alvo.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest && ev.target.closest('a, button, input, select, textarea, label, summary, form, .resumo, .papers, .trab-meta')) return;
      var p = ponto(ev), tipo = 1 + Math.floor(Math.random() * 2), fase = Math.random() * Math.PI * 2;
      [[0, 1], [WAVE_GAP, 0.55]].forEach(function (d) { ondas.push({ x: p.x, y: p.y, tipo: tipo, fase: fase, forca: d[1], inicio: tempo / 1000, atraso: d[0] }); });
      ondas = ondas.slice(-MAX_WAVES);
    });
  }

  // ---------------- Trabalhos vistos recentemente ----------------
  var CHAVE_VISTOS = 'rb-vistos';
  function lerVistos() { try { return JSON.parse(localStorage.getItem(CHAVE_VISTOS)) || []; } catch (e) { return []; } }
  function marcarVisto() {
    var m = location.pathname.match(/trabalho\/([^/]+)\//); if (!m) return;
    var slug = decodeURIComponent(m[1]);
    var l = lerVistos().filter(function (s) { return s !== slug; }); l.unshift(slug);
    try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify(l.slice(0, 5))); } catch (e) {}
  }
  function mostrarVistos() {
    var sec = $('#vistos'), lista = $('#vistos-lista'), slugs = lerVistos();
    if (!sec || !lista || !slugs.length) return;
    fetch(SITE.base + 'data/trabalhos.json').then(function (r) { return r.json(); }).then(function (json) {
      var todos = Array.isArray(json) ? json : json.trabalhos || [];
      var por = {}; todos.forEach(function (x) { por[x.slug] = x; });
      var itens = slugs.map(function (s) { return por[s]; }).filter(Boolean);
      if (!itens.length) return;
      function render() { lista.innerHTML = itens.map(cardTrabalho).join(''); }
      render(); sec.hidden = false;
      var antes = window.__aoTrocarIdioma;
      window.__aoTrocarIdioma = function () { if (antes) antes(); render(); };
    }).catch(function () {});
  }

  aplicarIdioma();
  if (SITE.pagina === 'trabalho') marcarVisto();
  if (SITE.pagina === 'inicio') mostrarVistos();
  if (SITE.pagina === 'inicio') fundoGlifos($('.hero'), {
    cor: '#2E54A2', destaque: '#F9B234', haze: 0.17, fontSize: 9, peso: 500, fonte: 'Menlo, ui-monospace, SFMono-Regular, Consolas, monospace',
    simbolos: ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
  });
  if (SITE.pagina === 'trabalhos') paginaTrabalhos();
  if (SITE.pagina === 'trabalho') paginaTrabalho();
  if (SITE.pagina === 'autores') paginaAutores();
  abasDeslizantes($('.abas-nav'), 'a', 'a[aria-current="page"]', true);
  abasDeslizantes($('.idiomas'), 'button', 'button[aria-pressed="true"]');
  abasDeslizantes($('.abas'), 'button', 'button[aria-selected="true"]');
})();
