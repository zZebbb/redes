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
const porSlug = new Map(trabalhos.map(t => [t.slug, t]));
const autorSlug = nome => slugify(nome);

const t = k => i18n.pt[k] ?? k;                       // texto padrão (PT) no HTML
const T = k => `data-i18n="${k}"`;                     // marcação para trocar idioma no navegador
const TR = v => (typeof v === 'object' && v) ? `data-tr="${e(JSON.stringify(v))}"` : '';
const siteURL = (config.site_url || '').replace(/\/$/, '');
const nomeEvento = txt(config.nome_evento);
const eixos = [...new Set(trabalhos.map(x => x.eixo).filter(Boolean))];
const coll = new Intl.Collator('pt', { numeric: true, sensitivity: 'base' });
eixos.sort(coll.compare);
const contarEixo = eixo => trabalhos.filter(x => x.eixo === eixo).length;

const cores = Object.assign({ primaria: '#0f5f73', secundaria: '#e07a2e', fundo: '#f6f4ef', texto: '#1d2733' }, config.cores);

function layout({ base, titulo, descricao = '', pagina, corpo, metaExtra = '', canonical = '' }) {
  const tituloCompleto = titulo ? `${titulo} · ${nomeEvento}` : nomeEvento;
  const logo = config.logo
    ? `<img src="${base}${e(config.logo)}" alt="" class="logo-img">`
    : `<span class="logo-mono" aria-hidden="true">${e((config.sigla || nomeEvento).replace(/[\[\]]/g, '').slice(0, 4))}</span>`;
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/style.css">
<style>:root{--c-pri:${e(cores.primaria)};--c-sec:${e(cores.secundaria)};--c-bg:${e(cores.fundo)};--c-txt:${e(cores.texto)}}</style>
<script>window.SITE={base:${JSON.stringify(base)},pagina:${JSON.stringify(pagina)},porPagina:${Number(config.itens_por_pagina) || 12},idiomaPadrao:${JSON.stringify(config.idioma_padrao || 'pt')}};</script>
</head>
<body>
<a class="pular" href="#conteudo" ${T('nav.pular')}>${t('nav.pular')}</a>
<header class="topo">
  <div class="topo-in">
    <a class="marca" href="${base}">
      ${logo}
      <span class="marca-txt">
        <span class="marca-sub" ${TR(config.subtitulo)}>${e(txt(config.subtitulo))}</span>
        <strong class="marca-nome" ${TR(config.nome_evento)}>${e(nomeEvento)}</strong>
        ${config.issn ? `<span class="marca-issn">ISSN: ${e(config.issn)}</span>` : ''}
      </span>
    </a>
    <div class="idiomas" role="group" aria-label="${t('nav.idioma')}" ${T('nav.idioma')} data-i18n-attr="aria-label">
      <button type="button" data-lang="pt" lang="pt">PT</button>
      <button type="button" data-lang="en" lang="en">EN</button>
      <button type="button" data-lang="es" lang="es">ES</button>
    </div>
  </div>
  <nav class="nav" aria-label="Principal"><div class="nav-in">${nav}</div></nav>
</header>
<main id="conteudo">
${corpo}
</main>
<footer class="rodape">
  <div class="rodape-in">
    <div>
      <strong ${TR(config.nome_evento)}>${e(nomeEvento)}</strong>
      ${config.issn ? `<div>ISSN ${e(config.issn)}</div>` : ''}
      ${config.editora ? `<div>${e(config.editora)}</div>` : ''}
    </div>
    <div class="rodape-dir" ${T('rodape.feito')}>${t('rodape.feito')}</div>
  </div>
</footer>
<script>window.I18N=${JSON.stringify(i18n)};</script>
${pagina === 'trabalhos' ? `<script src="${base}assets/fuse.min.js" defer></script>` : ''}
<script src="${base}assets/app.js" defer></script>
</body>
</html>
`;
}

// Card usado na home (o JS da lista de trabalhos usa a mesma marcação).
function card(x, base) {
  return `<article class="card">
  <div class="card-tags">${x.eixo ? `<span class="tag tag-eixo">${e(x.eixo)}</span>` : ''}${x.modalidade ? `<span class="tag">${e(x.modalidade)}</span>` : ''}</div>
  <h3 class="card-tit"><a href="${base}trabalho/${x.slug}/">${e(x.titulo)}</a></h3>
  <p class="card-aut">${e(x.autores.join('; '))}</p>
</article>`;
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
await mkdir(path.join(dist, 'data'), { recursive: true });
await cp(path.join(raiz, 'data/trabalhos.json'), path.join(dist, 'data/trabalhos.json'));
await writeFile(path.join(dist, '.nojekyll'), '');

// ---------- Início ----------
{
  const base = './';
  const bannerStyle = config.banner ? ` style="--banner:url('${e(config.banner)}')"` : '';
  // Até 6 trabalhos, alternando entre os eixos para mostrar variedade.
  const filas = eixos.map(x => trabalhos.filter(y => y.eixo === x));
  if (trabalhos.some(y => !y.eixo)) filas.push(trabalhos.filter(y => !y.eixo));
  const destaque = [];
  for (let i = 0; destaque.length < Math.min(6, trabalhos.length); i++) for (const f of filas) if (f[i] && destaque.length < 6) destaque.push(f[i]);
  const corpo = `
<section class="hero${config.banner ? ' hero-img' : ''}"${bannerStyle}>
  <div class="hero-in">
    <p class="hero-ed">${e(config.sigla || '')} ${e(config.edicao || '')}</p>
    <h1 class="hero-tit" ${TR(config.nome_evento)}>${e(nomeEvento)}</h1>
    <p class="hero-sub" ${TR(config.subtitulo)}>${e(txt(config.subtitulo))}</p>
    <form class="busca busca-hero" action="trabalhos/" method="get" role="search">
      <label class="sr" for="q-home" ${T('home.buscar_titulo')}>${t('home.buscar_titulo')}</label>
      <input id="q-home" name="q" type="search" placeholder="${e(t('home.buscar_placeholder'))}" data-i18n-ph="home.buscar_placeholder" autocomplete="off">
      <button type="submit" ${T('home.buscar_botao')}>${t('home.buscar_botao')}</button>
    </form>
    ${config.issn ? `<p class="hero-issn">ISSN ${e(config.issn)}</p>` : ''}
  </div>
</section>
<section class="numeros" aria-label="Resumo">
  <div><strong>${trabalhos.length}</strong><span ${T('home.trabalhos')}>${t('home.trabalhos')}</span></div>
  <div><strong>${autores.length}</strong><span ${T('home.autores')}>${t('home.autores')}</span></div>
  <div><strong>${eixos.length}</strong><span ${T('home.eixos')}>${t('home.eixos')}</span></div>
</section>
${txt(config.apresentacao) ? `<section class="sec apresentacao"><p ${TR(config.apresentacao)}>${e(txt(config.apresentacao))}</p></section>` : ''}
<section class="sec">
  <h2 ${T('home.eixos_titulo')}>${t('home.eixos_titulo')}</h2>
  <div class="eixos">
    ${eixos.map(x => `<a class="eixo" href="trabalhos/?eixo=${encodeURIComponent(x)}"><span>${e(x)}</span><strong>${contarEixo(x)}</strong></a>`).join('\n    ')}
  </div>
</section>
<section class="sec">
  <div class="sec-cab">
    <h2 ${T('home.recentes')}>${t('home.recentes')}</h2>
    <a class="link-seta" href="trabalhos/" ${T('home.ver_todos')}>${t('home.ver_todos')}</a>
  </div>
  <div class="cards">${destaque.map(x => card(x, base)).join('\n')}</div>
</section>`;
  await salvar('index.html', layout({ base, titulo: '', pagina: 'inicio', corpo, canonical: siteURL ? siteURL + '/' : '' }));
}

// ---------- Trabalhos (lista com busca) ----------
{
  const base = '../';
  const modalidades = [...new Set(trabalhos.map(x => x.modalidade).filter(Boolean))].sort(coll.compare);
  const corpo = `
<section class="sec">
  <h1 class="pag-tit" ${T('lista.titulo')}>${t('lista.titulo')}</h1>
  <form class="filtros" role="search" onsubmit="return false">
    <div class="busca">
      <label class="sr" for="q" ${T('lista.buscar_placeholder')}>${t('lista.buscar_placeholder')}</label>
      <input id="q" type="search" placeholder="${e(t('lista.buscar_placeholder'))}" data-i18n-ph="lista.buscar_placeholder" autocomplete="off">
    </div>
    <button type="button" id="abrir-filtros" class="btn-filtros" aria-expanded="false" aria-controls="selects">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>
      <span ${T('lista.filtros')}>${t('lista.filtros')}</span><span id="n-filtros" class="n-filtros" hidden></span>
    </button>
    <div class="selects" id="selects">
      <label><span ${T('lista.eixo')}>${t('lista.eixo')}</span>
        <select id="f-eixo"><option value="" ${T('lista.todos')}>${t('lista.todos')}</option>${eixos.map(x => `<option>${e(x)}</option>`).join('')}</select>
      </label>
      <label><span ${T('lista.modalidade')}>${t('lista.modalidade')}</span>
        <select id="f-mod"><option value="" ${T('lista.todas')}>${t('lista.todas')}</option>${modalidades.map(x => `<option>${e(x)}</option>`).join('')}</select>
      </label>
      <button type="button" id="limpar" class="btn-sec" ${T('lista.limpar')}>${t('lista.limpar')}</button>
    </div>
  </form>
  <p id="contagem" class="contagem" aria-live="polite"></p>
  <div id="lista" class="cards">
    <noscript>${trabalhos.map(x => card(x, base)).join('\n')}</noscript>
  </div>
  <nav id="paginacao" class="paginacao" aria-label="Paginação"></nav>
</section>`;
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
    ['citation_keywords', x.palavras_chave.join('; ')],
    ['citation_pdf_url', x.pdf?.baixar],
    ['citation_abstract_html_url', url],
    ['citation_language', 'pt']
  ].filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${e(v)}">`).join('\n');
  const dadosCit = {
    autores: x.autores.map(nomeABNT),
    titulo: x.titulo,
    evento: nomeEvento,
    edicao: config.edicao || '',
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
  <h1 class="trab-tit">${e(x.titulo)}</h1>
  <p class="trab-aut">${x.autores.map(a => `<a href="${base}autores/#${autorSlug(a)}">${e(a)}</a>`).join('<span aria-hidden="true">; </span>')}</p>
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
          : `<p class="aviso" ${T('trab.sem_resumo_idioma')}>${t('trab.sem_resumo_idioma')}</p>${(x.resumo.pt || '').split(/\n+/).map(p => `<p lang="pt">${e(p)}</p>`).join('')}`}</div>`).join('\n        ')}
        ${x.palavras_chave.length ? `<div class="pc"><span><strong ${T('trab.palavras_chave')}>${t('trab.palavras_chave')}</strong>:</span> ${x.palavras_chave.map(p => `<a class="tag" href="${base}trabalhos/?q=${encodeURIComponent(p)}">${e(p)}</a>`).join(' ')}</div>` : ''}
      </section>
    </div>
    <aside class="trab-lado">
      <div class="pdf-botoes">
        ${x.pdf
          ? `<a class="btn" href="${e(x.pdf.ver)}" target="_blank" rel="noopener"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg><span ${T('trab.ver_pdf')}>${t('trab.ver_pdf')}</span></a>
        <a class="btn btn-sec" href="${e(x.pdf.baixar)}" rel="noopener"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5z"/></svg><span ${T('trab.baixar_pdf')}>${t('trab.baixar_pdf')}</span></a>`
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
  const letras = new Map();
  for (const a of autores) {
    const l = a.nome.normalize('NFD')[0].toUpperCase();
    if (!letras.has(l)) letras.set(l, []);
    letras.get(l).push(a);
  }
  const corpo = `
<section class="sec">
  <h1 class="pag-tit" ${T('autores.titulo')}>${t('autores.titulo')}</h1>
  <div class="busca">
    <label class="sr" for="q-aut" ${T('autores.buscar_placeholder')}>${t('autores.buscar_placeholder')}</label>
    <input id="q-aut" type="search" placeholder="${e(t('autores.buscar_placeholder'))}" data-i18n-ph="autores.buscar_placeholder" autocomplete="off">
  </div>
  <nav class="az" aria-label="A–Z">${[...letras.keys()].map(l => `<a href="#letra-${l}">${l}</a>`).join('')}</nav>
  <p id="aut-nenhum" class="contagem" hidden ${T('autores.nenhum')}>${t('autores.nenhum')}</p>
  ${[...letras].map(([l, lista]) => `<section class="letra" id="letra-${l}">
    <h2>${l}</h2>
    <ul class="autores">
      ${lista.map(a => `<li class="autor" id="${a.slug}" data-busca="${e(a.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())}">
        <details>
          <summary><span class="autor-nome">${e(a.nome)}</span> <span class="autor-n">${a.trabalhos.length}</span></summary>
          <ul>${a.trabalhos.map(s => porSlug.get(s)).map(x => `<li><a href="${base}trabalho/${x.slug}/">${e(x.titulo)}</a>${x.eixo ? ` <span class="autor-eixo">${e(x.eixo)}</span>` : ''}</li>`).join('')}</ul>
        </details>
      </li>`).join('\n      ')}
    </ul>
  </section>`).join('\n  ')}
</section>`;
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
