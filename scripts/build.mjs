// Gera o site estático em dist/ a partir de config.json, i18n/ e data/*.json.
import { readFile, writeFile, mkdir, rm, cp, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { escapeHTML as e, txt, slugify, nomeABNT } from './lib.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(raiz, 'dist');
const ler = async f => JSON.parse(await readFile(path.join(raiz, f), 'utf8'));
const existe = async f => access(f).then(() => true, () => false);

const config = await ler('config.json');

// Campos provisórios: qualquer texto entre [colchetes] ou campos essenciais vazios.
const pendentes = [];
(function procurar(obj, caminho) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    const c = caminho ? `${caminho}.${k}` : k;
    if (v && typeof v === 'object') procurar(v, c);
    else if (typeof v === 'string' && /^\[.*\]$/.test(v.trim())) pendentes.push(c);
  }
})(config, '');
for (const c of ['logo', 'banner', 'planilha_csv_url']) if (!config[c] && !(c === 'planilha_csv_url' && process.env.PLANILHA_CSV_URL)) pendentes.push(c);
const i18n = { pt: await ler('i18n/pt.json'), en: await ler('i18n/en.json'), es: await ler('i18n/es.json') };
if (!(await existe(path.join(raiz, 'data/trabalhos.json')))) {
  console.error('data/trabalhos.json não existe. Rode "npm run sync" antes.');
  process.exit(1);
}
const trabalhos = await ler('data/trabalhos.json');
const autores = await ler('data/autores.json');
for (const x of trabalhos) {
  x.titulos ??= { pt: x.titulo, en: '', es: '' };
  x.pc ??= { pt: x.palavras_chave, en: [], es: [] };
  x.instituicoes ??= x.autores.map(() => []);
  x.citacao ??= x.autores.map(nomeABNT);
}
// PDFs guardados no próprio site (pasta pdfs/) têm preferência sobre o link do Drive.
for (const x of trabalhos) if (await existe(path.join(raiz, 'pdfs', `${x.slug}.pdf`))) x.pdfLocal = `pdfs/${x.slug}.pdf`;
const porSlug = new Map(trabalhos.map(t => [t.slug, t]));
const titTR = x => TR({ pt: x.titulos.pt, en: x.titulos.en || x.titulos.pt, es: x.titulos.es || x.titulos.pt });
const autorSlug = nome => slugify(nome);

const t = k => i18n.pt[k] ?? k;                       // texto padrão (PT) no HTML
const T = k => `data-i18n="${k}"`;                     // marcação para trocar idioma no navegador
const TR = v => (typeof v === 'object' && v) ? `data-tr="${e(JSON.stringify(v))}"` : '';
const siteURL = (config.site_url || '').replace(/\/$/, '');
const nomeEvento = txt(config.nome_evento);
const instagram = (config.instagram || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').trim();
const eixos = [...new Set(trabalhos.map(x => x.eixo).filter(Boolean))];
const coll = new Intl.Collator('pt', { numeric: true, sensitivity: 'base' });
eixos.sort(coll.compare);
const contarEixo = eixo => trabalhos.filter(x => x.eixo === eixo).length;

const cores = Object.assign({ primaria: '#E69138', banner_fundo: '#F2A900', banner_pontos: '#E5520F', fundo: '#F5F6F8', texto: '#3E3E3E' }, config.cores);
const selo = [config.sigla, config.edicao].filter(v => v && !/^\[/.test(v)).join(' ');

// Cada eixo ganha um ponto colorido (o laranja continua sendo a única cor de interface).
const CORES_EIXO = ['#3B6FB6', '#2E8B57', '#8E5BB5', '#C0504D', '#B8860B', '#1F8A8A', '#7A6A58'];
const eixoCor = eixo => CORES_EIXO[Math.max(0, eixos.indexOf(eixo)) % CORES_EIXO.length];
const eixoCurto = eixo => (eixo.match(/^eixo\s*\d+/i) || [eixo.length > 28 ? eixo.slice(0, 26) + '…' : eixo])[0];
const eixoBadge = eixo => eixo ? `<span class="eixo-badge" style="--c:${eixoCor(eixo)}" title="${e(eixo)}">${e(eixoCurto(eixo))}</span>` : '';

// Sugestões de busca no banner: config.sugestoes_busca ou as palavras-chave mais comuns
// (ignorando as que aparecem em mais da metade dos trabalhos, que não ajudam a filtrar).
const sugestoes = (() => {
  if (Array.isArray(config.sugestoes_busca) && config.sugestoes_busca.length) return config.sugestoes_busca;
  const n = new Map();
  for (const x of trabalhos) for (const p of new Set(x.pc.pt.map(v => v.trim()))) { const k = p.toLowerCase(); n.set(k, { p, c: (n.get(k)?.c || 0) + 1 }); }
  return [...n.values()].filter(v => v.c >= 2 && v.c <= trabalhos.length / 2).sort((a, b) => b.c - a.c).slice(0, 5)
    .map(v => v.p.charAt(0).toUpperCase() + v.p.slice(1));
})();

const monograma = (() => {
  const s = (config.sigla || nomeEvento).replace(/[\[\]]/g, '').trim();
  const p = s.split(/\s+/).filter(w => /^[A-ZÀ-Ú0-9]/.test(w));
  return (p.length > 1 ? p.map(w => w[0]).join('') : s).slice(0, 4).toUpperCase();
})();

const temHero = p => ['inicio', 'trabalhos', 'autores', '404'].includes(p);

function hero(base, pagina) {
  const logo = config.logo
    ? `<img src="${base}${e(config.logo)}" alt="" class="hero-logo">`
    : `<span class="hero-logo hero-logo-mono" aria-hidden="true">${e(monograma)}</span>`;
  const bannerStyle = config.banner
    ? ` style="--banner:url('${base}${e(config.banner)}');--banner-cel:url('${base}${e(config.banner_celular || config.banner)}')"` : '';
  const Nome = pagina === 'inicio' ? 'h1' : 'p';
  return `<section class="hero${config.banner ? ' hero-img' : ''}"${bannerStyle}>
  <div class="hero-marca">
    ${logo}
    <div>
      <${Nome} class="hero-nome${pagina === 'inicio' ? ' text-roll" data-text-roll' : '"'} ${TR(config.nome_evento)}>${e(nomeEvento)}</${Nome}>
      <p class="hero-sub"><span ${TR(config.subtitulo)}>${e(txt(config.subtitulo))}</span>${config.issn ? ` · ISSN ${e(config.issn)}` : ''}</p>
    </div>
  </div>
  <form class="hero-busca" action="${base}trabalhos/" method="get" role="search">
    <label class="sr" for="q-topo" ${T('home.buscar_titulo')}>${t('home.buscar_titulo')}</label>
    <input id="q-topo" name="q" type="search" placeholder="${e(t('home.buscar_placeholder'))}" data-i18n-ph="home.buscar_placeholder" autocomplete="off">
    <button type="submit" aria-label="${e(t('home.buscar_botao'))}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 109.5 16a6.5 6.5 0 004.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/></svg></button>
  </form>
  ${sugestoes.length ? `<div class="hero-chips"><span class="sr" ${T('home.sugestoes')}>${t('home.sugestoes')}</span>${sugestoes.map(v => `<a class="chip" href="${base}trabalhos/?q=${encodeURIComponent(v)}">${e(v)}</a>`).join('')}</div>` : ''}
</section>`;
}

function layout({ base, titulo, descricao = '', pagina, corpo, metaExtra = '', canonical = '' }) {
  const tituloCompleto = titulo ? `${titulo} · ${nomeEvento}` : nomeEvento;
  const nav = [['inicio', '', 'nav.inicio'], ['trabalhos', 'trabalhos/', 'nav.trabalhos'], ['autores', 'autores/', 'nav.autores']]
    .map(([id, href, k]) => `<a href="${base}${href}" ${T(k)}${pagina === id ? ' aria-current="page"' : ''}>${t(k)}</a>`).join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${e(cores.primaria)}">
<title>${e(tituloCompleto)}</title>
<meta name="description" content="${e(descricao || txt(config.subtitulo))}">
<meta property="og:title" content="${e(titulo || nomeEvento)}">
<meta property="og:description" content="${e(descricao || txt(config.subtitulo))}">
<meta property="og:type" content="${pagina === 'trabalho' ? 'article' : 'website'}">
<meta property="og:site_name" content="${e(nomeEvento)}">
${config.banner ? `<meta property="og:image" content="${e(siteURL + '/' + config.banner)}">` : ''}
${canonical ? `<link rel="canonical" href="${e(canonical)}">` : ''}
${metaExtra}
<link rel="icon" href="${config.favicon ? base + e(config.favicon) : 'data:,'}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/style.css">
<style>:root{--primary:${e(cores.primaria)};--hero-bg:${e(cores.banner_fundo)};--hero-dots:${e(cores.banner_pontos)};--bg:${e(cores.fundo)};--text:${e(cores.texto)}}</style>
<script>window.SITE={base:${JSON.stringify(base)},pagina:${JSON.stringify(pagina)},porPagina:${Number(config.itens_por_pagina) || 12},idiomaPadrao:${JSON.stringify(config.idioma_padrao || 'pt')},selo:${JSON.stringify(selo)},mono:${JSON.stringify(monograma)},eixos:${JSON.stringify(Object.fromEntries(eixos.map(x => [x, [eixoCurto(x), eixoCor(x)]])))}};</script>
</head>
<body>
<a class="pular" href="#conteudo" ${T('nav.pular')}>${t('nav.pular')}</a>
<header class="topbar">
  <a class="topbar-org" href="${base}">${e((config.sigla || nomeEvento).replace(/[\[\]]/g, ''))}</a>
  <div class="idiomas" role="group" aria-label="${t('nav.idioma')}" ${T('nav.idioma')} data-i18n-attr="aria-label">
    <button type="button" data-lang="pt" lang="pt">PT</button>
    <button type="button" data-lang="en" lang="en">EN</button>
    <button type="button" data-lang="es" lang="es">ES</button>
  </div>
</header>
${temHero(pagina) ? hero(base, pagina) : ''}
<nav class="abas-nav" aria-label="Principal">${nav}</nav>
<main id="conteudo">
${corpo}
</main>
<footer class="rodape">
  <div class="rodape-in">
    <div>
      <strong ${TR(config.nome_evento)}>${e(nomeEvento)}</strong>
      ${config.issn ? `<span> · ISSN ${e(config.issn)}</span>` : ''}
      ${config.editora ? `<div>${e(config.editora)}</div>` : ''}
    </div>
    <div class="rodape-dir">
      ${config.logo_rodape ? `<img class="rodape-logo" src="${base}${e(config.logo_rodape)}" alt="${e(config.logo_rodape_alt || '')}" width="180">` : ''}
      <div ${T('rodape.feito')}>${t('rodape.feito')}</div>
      ${instagram ? `<a class="rodape-ig" href="https://www.instagram.com/${e(instagram)}/" target="_blank" rel="noopener" aria-label="Instagram @${e(instagram)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.9 1.4 1.4 0 000-2.9z"/></svg><span>@${e(instagram)}</span></a>` : ''}
    </div>
  </div>
</footer>
<script>window.I18N=${JSON.stringify(i18n)};</script>
${pagina === 'trabalhos' ? `<script src="${base}assets/fuse.min.js" defer></script>` : ''}
<script src="${base}assets/app.js" defer></script>
</body>
</html>
`;
}

// Autores no formato do card: até 3 nomes em ABNT; mais que isso, "SOBRENOME, Nome et al."
const autoresCurto = x => x.citacao.length > 3 ? `${x.citacao[0]} et al.` : x.citacao.join('; ');

// Card de trabalho em lista (o JS da página Trabalhos gera a mesma marcação).
function card(x, base) {
  return `<li><a class="paper-card" href="${base}trabalho/${x.slug}/">
  <div class="paper-card__body">
    <p class="paper-card__title" ${titTR(x)}>${e(x.titulo)}</p>
    <p class="paper-card__authors">${e(autoresCurto(x))}</p>
    <p class="paper-card__meta">${eixoBadge(x.eixo)}${x.modalidade ? `<span class="paper-card__mod">${e(x.modalidade)}</span>` : ''}</p>
  </div>
  <span class="paper-card__thumb" aria-hidden="true">${e(monograma)}</span>
  <span class="paper-card__badge">${e(selo)}</span>
</a></li>`;
}

async function salvar(rel, html) {
  const f = path.join(dist, rel);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, html);
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(raiz, 'src/assets'), path.join(dist, 'assets'), { recursive: true });
await cp(path.join(raiz, 'node_modules/fuse.js/dist/fuse.min.js'), path.join(dist, 'assets/fuse.min.js'));
for (const pasta of ['public']) {
  if (await existe(path.join(raiz, pasta))) await cp(path.join(raiz, pasta), dist, { recursive: true });
}
if (await existe(path.join(raiz, 'pdfs'))) await cp(path.join(raiz, 'pdfs'), path.join(dist, 'pdfs'), { recursive: true });
await mkdir(path.join(dist, 'data'), { recursive: true });
await cp(path.join(raiz, 'data/trabalhos.json'), path.join(dist, 'data/trabalhos.json'));
await writeFile(path.join(dist, '.nojekyll'), '');

// ---------- Início ----------
{
  const base = './';
  // Até 6 trabalhos, alternando entre os eixos para mostrar variedade.
  const filas = eixos.map(x => trabalhos.filter(y => y.eixo === x));
  if (trabalhos.some(y => !y.eixo)) filas.push(trabalhos.filter(y => !y.eixo));
  const destaque = [];
  for (let i = 0; destaque.length < Math.min(6, trabalhos.length); i++) for (const f of filas) if (f[i] && destaque.length < 6) destaque.push(f[i]);
  const corpo = `
<section class="numeros" aria-label="Resumo">
  <div><strong>${trabalhos.length}</strong><span ${T('home.trabalhos')}>${t('home.trabalhos')}</span></div>
  <div><strong>${autores.length}</strong><span ${T('home.autores')}>${t('home.autores')}</span></div>
  <div><strong>${eixos.length}</strong><span ${T('home.eixos')}>${t('home.eixos')}</span></div>
</section>
${txt(config.apresentacao) ? `<section class="sec apresentacao"><p ${TR(config.apresentacao)}>${e(txt(config.apresentacao))}</p></section>` : ''}
<section class="sec">
  <h2 ${T('home.eixos_titulo')}>${t('home.eixos_titulo')}</h2>
  <div class="eixos">
    ${eixos.map(x => `<a class="eixo" style="--c:${eixoCor(x)}" href="trabalhos/?eixo=${encodeURIComponent(x)}"><span>${e(x)}</span><strong>${contarEixo(x)}</strong></a>`).join('\n    ')}
  </div>
</section>
<section class="sec">
  <div class="sec-cab">
    <h2 ${T('home.recentes')}>${t('home.recentes')}</h2>
    <a class="link-seta" href="trabalhos/" ${T('home.ver_todos')}>${t('home.ver_todos')}</a>
  </div>
  <ul class="papers">${destaque.map(x => card(x, base)).join('\n')}</ul>
</section>`;
  await salvar('index.html', layout({ base, titulo: '', pagina: 'inicio', corpo, canonical: siteURL ? siteURL + '/' : '' }));
}

// ---------- Trabalhos (lista com busca e filtros na barra lateral) ----------
function grupoFiltro(id, rotulo, valores, contar, cor) {
  return `<div class="filter-group" data-campo="${id}">
      <h3><span ${T(rotulo)}>${t(rotulo)}</span></h3>
      <ul class="filter-list">${valores.map(v => `<li><button type="button" data-valor="${e(v)}" aria-pressed="false"><span class="fl-nome"${cor ? ` style="--c:${cor(v)}"` : ''}>${e(v)}</span><span class="fl-n">${contar(v)}</span></button></li>`).join('')}</ul>
    </div>`;
}
{
  const base = '../';
  const modalidades = [...new Set(trabalhos.map(x => x.modalidade).filter(Boolean))].sort(coll.compare);
  const corpo = `
<div class="layout">
  <aside class="sidebar">
    <button type="button" id="abrir-filtros" class="btn-filtros" aria-expanded="false" aria-controls="sidebar-corpo">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>
      <span ${T('lista.filtros')}>${t('lista.filtros')}</span><span id="n-filtros" class="n-filtros" hidden></span>
    </button>
    <div class="sidebar-corpo" id="sidebar-corpo">
      <h2 class="side-tit" ${T('lista.filtros')}>${t('lista.filtros')}</h2>
      <form class="filter-search" role="search" onsubmit="return false">
        <label class="sr" for="q" ${T('lista.buscar_placeholder')}>${t('lista.buscar_placeholder')}</label>
        <input id="q" type="search" placeholder="${e(t('lista.buscar_placeholder'))}" data-i18n-ph="lista.buscar_placeholder" autocomplete="off">
        <button type="submit" class="btn-primary" ${T('home.buscar_botao')}>${t('home.buscar_botao')}</button>
      </form>
      ${grupoFiltro('eixo', 'lista.eixo', eixos, v => trabalhos.filter(x => x.eixo === v).length, eixoCor)}
      ${grupoFiltro('mod', 'lista.modalidade', modalidades, v => trabalhos.filter(x => x.modalidade === v).length)}
      <button type="button" id="limpar" class="btn-texto" ${T('lista.limpar')}>${t('lista.limpar')}</button>
    </div>
  </aside>
  <section class="content">
    <div class="content-cab">
      <h1 class="pag-tit" ${T('lista.titulo')}>${t('lista.titulo')}</h1>
      <div class="vista" role="group" aria-label="${e(t('lista.vista'))}" ${T('lista.vista')} data-i18n-attr="aria-label">
        <button type="button" data-vista="cards" aria-pressed="true" title="${e(t('lista.vista_cards'))}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v4H4zm0 5h16v4H4zm0 5h16v4H4z"/></svg><span ${T('lista.vista_cards')}>${t('lista.vista_cards')}</span></button>
        <button type="button" data-vista="tabela" aria-pressed="false" title="${e(t('lista.vista_tabela'))}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h18v16H3zm2 2v3h14V6zm0 5v3h14v-3zm0 5v2h14v-2z"/></svg><span ${T('lista.vista_tabela')}>${t('lista.vista_tabela')}</span></button>
      </div>
    </div>
    <p id="contagem" class="contagem" aria-live="polite"></p>
    <div id="tabela" class="tabela-wrap" hidden></div>
    <ul id="lista" class="papers">${trabalhos.map(x => card(x, base)).join('\n')}</ul>
    <nav id="paginacao" class="paginacao" aria-label="Paginação"></nav>
  </section>
</div>`;
  await salvar('trabalhos/index.html', layout({ base, titulo: t('lista.titulo'), pagina: 'trabalhos', corpo, canonical: siteURL ? siteURL + '/trabalhos/' : '' }));
}

// ---------- Página de cada trabalho ----------
for (const x of trabalhos) {
  const base = '../../';
  const url = siteURL ? `${siteURL}/trabalho/${x.slug}/` : '';
  const langs = ['pt', 'en', 'es'];
  const desc = (x.resumo.pt || '').slice(0, 200);
  const meta = [
    ['citation_title', x.titulo],
    ...x.autores.map(a => ['citation_author', a]),
    ['citation_publication_date', x.ano],
    ['citation_conference_title', nomeEvento],
    ['citation_issn', config.issn],
    ['citation_doi', x.doi],
    ['citation_keywords', [...new Set([...x.pc.pt, ...x.pc.en, ...x.pc.es])].join('; ')],
    ...(x.titulos.en ? [['DC.title.alternative', x.titulos.en]] : []),
    ['citation_pdf_url', x.pdfLocal && siteURL ? `${siteURL}/${x.pdfLocal}` : x.pdf?.baixar],
    ['citation_abstract_html_url', url],
    ['citation_language', 'pt']
  ].filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${e(v)}">`).join('\n');
  const dadosCit = {
    autores: x.citacao,
    titulo: x.titulo,
    evento: config.nome_citacao || nomeEvento,
    numero: config.numero_edicao || '',
    cidade: config.cidade || '',
    editora: config.editora || '',
    ano: x.ano,
    issn: config.issn || '',
    doi: x.doi || '',
    url: url || null
  };
  const corpo = `
<article class="sec trabalho">
  <a class="voltar" href="${base}trabalhos/" ${T('trab.voltar')}>${t('trab.voltar')}</a>
  <h1 class="trab-tit" ${titTR(x)}>${e(x.titulo)}</h1>
  ${(() => {
    // Afiliações numeradas, como em artigo: Nome¹; Nome²
    const insts = [];
    const nums = x.instituicoes.map(l => l.map(i => { if (!insts.includes(i)) insts.push(i); return insts.indexOf(i) + 1; }));
    const multi = insts.length > 1;
    return `<p class="trab-aut">${x.autores.map((a, j) => `<a href="${base}autores/#${autorSlug(a)}">${e(a)}</a>${multi && nums[j].length ? `<sup>${nums[j].join(',')}</sup>` : ''}`).join('<span aria-hidden="true">; </span>')}</p>
  ${insts.length ? `<ol class="afil${multi ? '' : ' afil-uma'}">${insts.map(i => `<li>${e(i)}</li>`).join('')}</ol>` : ''}`;
  })()}
  <dl class="trab-meta">
    <div><dt ${T('trab.id')}>${t('trab.id')}</dt><dd>${e(x.id)}</dd></div>
    ${x.modalidade ? `<div><dt ${T('trab.modalidade')}>${t('trab.modalidade')}</dt><dd><a href="${base}trabalhos/?modalidade=${encodeURIComponent(x.modalidade)}">${e(x.modalidade)}</a></dd></div>` : ''}
    ${x.ano ? `<div><dt ${T('trab.ano')}>${t('trab.ano')}</dt><dd>${e(x.ano)}</dd></div>` : ''}
    ${x.doi ? `<div><dt>DOI</dt><dd><a href="https://doi.org/${e(x.doi)}">${e(x.doi)}</a></dd></div>` : ''}
  </dl>
  <button type="button" id="compartilhar" class="btn-link" hidden>
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 16a3 3 0 00-2.4 1.2l-6.7-3.4a3 3 0 000-1.6l6.7-3.4A3 3 0 1015 7l-6.7 3.4a3 3 0 100 3.2L15 17a3 3 0 103-1z"/></svg>
    <span ${T('trab.compartilhar')}>${t('trab.compartilhar')}</span>
  </button>
  <div class="trab-grid">
    <div class="trab-princ">
      <section class="caixa">
        <div class="caixa-cab">
          <h2 ${T('trab.resumo')}>${t('trab.resumo')}</h2>
          <div class="abas" role="tablist" aria-label="${t('trab.resumo')}">
            ${langs.map((l, i) => `<button type="button" role="tab" id="aba-${l}" aria-controls="res-${l}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-aba="${l}"${x.resumo[l] ? '' : ' data-vazio="1"'}>${l.toUpperCase()}</button>`).join('')}
          </div>
        </div>
        ${langs.map((l, i) => `<div class="resumo" role="tabpanel" id="res-${l}" aria-labelledby="aba-${l}" lang="${l}"${i === 0 ? '' : ' hidden'}>${x.resumo[l]
          ? x.resumo[l].split(/\n+/).map(p => `<p>${e(p)}</p>`).join('')
          : `<p class="aviso" ${T('trab.sem_resumo_idioma')}>${t('trab.sem_resumo_idioma')}</p>${(x.resumo.pt || '').split(/\n+/).map(p => `<p lang="pt">${e(p)}</p>`).join('')}`}${(() => {
            const lista = x.pc[l]?.length ? x.pc[l] : x.pc.pt;
            return lista.length ? `<div class="pc"><span><strong>${e(i18n[l]['trab.palavras_chave'])}</strong>:</span> ${lista.map(p => `<a class="tag" href="${base}trabalhos/?q=${encodeURIComponent(p)}">${e(p)}</a>`).join(' ')}</div>` : '';
          })()}</div>`).join('\n        ')}
      </section>
    </div>
    <aside class="trab-lado">
      <div class="pdf-botoes">
        ${(x.pdfLocal || x.pdf)
          ? `<a class="btn" href="${x.pdfLocal ? base + x.pdfLocal : e(x.pdf.ver)}" target="_blank" rel="noopener"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg><span ${T('trab.ver_pdf')}>${t('trab.ver_pdf')}</span></a>
        <a class="btn btn-sec" href="${x.pdfLocal ? base + x.pdfLocal : e(x.pdf.baixar)}" ${x.pdfLocal ? `download="${e(x.slug)}.pdf"` : 'rel="noopener"'}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5z"/></svg><span ${T('trab.baixar_pdf')}>${t('trab.baixar_pdf')}</span></a>`
          : `<p class="aviso" ${T('trab.sem_pdf')}>${t('trab.sem_pdf')}</p>`}
      </div>
      ${x.eixo ? `<section class="caixa"><div class="caixa-cab"><h2 ${T('trab.eixo')}>${t('trab.eixo')}</h2></div><p class="caixa-corpo"><a href="${base}trabalhos/?eixo=${encodeURIComponent(x.eixo)}">${e(x.eixo)}</a></p></section>` : ''}
      <section class="caixa citar">
        <div class="caixa-cab"><h2 ${T('trab.como_citar')}>${t('trab.como_citar')}</h2><span class="norma">ABNT</span></div>
        <div class="caixa-corpo">
          <p id="citacao" class="citacao"></p>
          <button type="button" id="copiar" class="btn btn-sec btn-peq" ${T('trab.copiar')}>${t('trab.copiar')}</button>
        </div>
      </section>
    </aside>
  </div>
  <script type="application/json" id="dados-citacao">${JSON.stringify(dadosCit).replace(/</g, '\\u003c')}</script>
</article>`;
  await salvar(`trabalho/${x.slug}/index.html`, layout({ base, titulo: x.titulo, descricao: desc, pagina: 'trabalho', corpo, metaExtra: meta, canonical: url }));
}

// ---------- Autores ----------
{
  const base = '../';
  const semAc = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const letraDe = a => semAc(a.nome)[0].toUpperCase();
  const letras = new Set(autores.map(letraDe));
  const insts = new Map();
  for (const a of autores) for (const i of a.instituicoes || []) insts.set(i, (insts.get(i) || 0) + 1);
  const listaInst = [...insts].sort((a, b) => b[1] - a[1] || coll.compare(a[0], b[0]));
  const iniciais = n => { const p = n.split(/\s+/).filter(w => !/^(d[aeo]s?|e)$/i.test(w)); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  const pessoa = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-3.3 0-9 1.7-9 5v2h18v-2c0-3.3-5.7-5-9-5z"/></svg>';
  const corpo = `
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-corpo aberto-sempre">
      <h2 class="side-tit" ${T('lista.filtros')}>${t('lista.filtros')}</h2>
      <form class="filter-search" role="search" onsubmit="return false">
        <label class="sr" for="q-aut" ${T('autores.buscar_placeholder')}>${t('autores.buscar_placeholder')}</label>
        <input id="q-aut" type="search" placeholder="${e(t('autores.buscar_placeholder'))}" data-i18n-ph="autores.buscar_placeholder" autocomplete="off">
        <button type="submit" class="btn-primary" ${T('home.buscar_botao')}>${t('home.buscar_botao')}</button>
      </form>
      ${listaInst.length ? `<details class="filter-group" data-campo="inst" open>
        <summary><h3><span ${T('autores.instituicoes')}>${t('autores.instituicoes')}</span></h3></summary>
        <input type="search" id="q-inst" class="fg-busca" placeholder="${e(t('autores.filtrar_inst'))}" data-i18n-ph="autores.filtrar_inst" aria-label="${e(t('autores.filtrar_inst'))}">
        <ul class="filter-list">${listaInst.map(([i, n]) => `<li><button type="button" data-valor="${e(i)}" aria-pressed="false"><span class="fl-nome">${e(i)}</span><span class="fl-n">${n}</span></button></li>`).join('')}</ul>
      </details>` : ''}
    </div>
  </aside>
  <section class="content">
    <h1 class="pag-tit" ${T('autores.titulo')}>${t('autores.titulo')}</h1>
    <nav class="alphabet" aria-label="A–Z">
      <button type="button" data-letra="" class="active" ${T('autores.todos')}>${t('autores.todos')}</button>
      ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `<button type="button" data-letra="${l}"${letras.has(l) ? '' : ' disabled'}>${l}</button>`).join('')}
    </nav>
    <p id="aut-nenhum" class="contagem" hidden ${T('autores.nenhum')}>${t('autores.nenhum')}</p>
    <ul class="authors-grid">
      ${autores.map(a => `<li class="author-card" id="${a.slug}" data-letra="${letraDe(a)}" data-busca="${e(semAc(a.nome).toLowerCase())}" data-inst="${e(JSON.stringify(a.instituicoes || []))}">
        <details>
          <summary>
            <span class="author-card__avatar" aria-hidden="true"><b>${e(iniciais(a.nome))}</b></span>
            <span class="author-card__name">${e(a.nome)}</span>
            ${a.instituicoes?.length ? `<span class="author-card__inst">${e(a.instituicoes.join('; '))}</span>` : ''}
            <span class="author-card__count">${a.trabalhos.length} <span ${T(a.trabalhos.length === 1 ? 'autores.trabalho' : 'autores.trabalhos')}>${t(a.trabalhos.length === 1 ? 'autores.trabalho' : 'autores.trabalhos')}</span></span>
          </summary>
          <ul class="author-card__works">${a.trabalhos.map(s => porSlug.get(s)).map(x => `<li><a href="${base}trabalho/${x.slug}/" ${titTR(x)}>${e(x.titulo)}</a></li>`).join('')}</ul>
        </details>
      </li>`).join('\n      ')}
    </ul>
  </section>
</div>`;
  await salvar('autores/index.html', layout({ base, titulo: t('autores.titulo'), pagina: 'autores', corpo, canonical: siteURL ? siteURL + '/autores/' : '' }));
}

// ---------- 404 (GitHub Pages usa caminho absoluto, então os links apontam para a raiz do site) ----------
{
  const base = siteURL ? new URL(siteURL + '/').pathname : '/';
  const corpo = `<section class="sec vazio"><h1 ${T('404.titulo')}>${t('404.titulo')}</h1><p ${T('404.texto')}>${t('404.texto')}</p><p><a class="btn" href="${base}trabalhos/" ${T('nav.trabalhos')}>${t('nav.trabalhos')}</a></p></section>`;
  await salvar('404.html', layout({ base, titulo: t('404.titulo'), pagina: '404', corpo }));
}

// ---------- sitemap e robots ----------
if (siteURL) {
  const urls = ['/', '/trabalhos/', '/autores/', ...trabalhos.map(x => `/trabalho/${x.slug}/`)];
  await salvar('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${e(siteURL + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  await salvar('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteURL}/sitemap.xml\n`);
}

if (pendentes.length) {
  console.warn(`\nAtenção: ${pendentes.length} campo(s) do config.json ainda provisório(s):`);
  for (const c of pendentes) console.warn(`  - ${c}`);
  console.warn('');
}
console.log(`Site gerado em dist/: ${trabalhos.length} páginas de trabalho, ${autores.length} autores, ${eixos.length} eixos.`);
