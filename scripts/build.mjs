// Gera o site estático em dist/ a partir de config.json, i18n/ e data/*.json.
import { readFile, writeFile, mkdir, rm, cp, access, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { escapeHTML as e, txt, slugify, nomeABNT, lerFotosCsv } from './lib.mjs';
import QRCode from 'qrcode';

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
// Versão dos arquivos (?v=...) para o navegador não misturar a página nova com CSS/JS/dados guardados em cache.
const versao = createHash('sha1')
  .update(await readFile(path.join(raiz, 'src/assets/app.js')))
  .update(await readFile(path.join(raiz, 'src/assets/style.css')))
  .update(await readFile(path.join(raiz, 'src/assets/explorar.js')))
  .update(await readFile(path.join(raiz, 'src/assets/fotos.js')))
  .update(await readFile(path.join(raiz, 'src/assets/banners.js')))
  .update(JSON.stringify(trabalhos))
  .digest('hex').slice(0, 10);
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
// Valores vindos da planilha (eixos, modalidades) traduzidos pelas chaves "valor.<texto em PT>" de i18n/.
const tv = (l, v) => i18n[l]?.['valor.' + v] ?? v;
const TV = (v, f = x => x) => TR({ pt: f(v, 'pt'), en: f(tv('en', v), 'en'), es: f(tv('es', v), 'es') });
const semPrefixoEixo = v => v.replace(/^[^\d–-]*\d+\s*[–-]\s*/, '');
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
// Cores da identidade Rede Brasil: azul, verde, roxo, amarelo (escurecido para leitura) e azul-noturno.
const CORES_EIXO = ['#2E54A2', '#076633', '#B86CAA', '#C98A12', '#172A55', '#5E595B'];
const eixoCor = eixo => CORES_EIXO[Math.max(0, eixos.indexOf(eixo)) % CORES_EIXO.length];
const eixoCurto = eixo => (eixo.match(/^eixo\s*\d+/i) || [eixo.length > 28 ? eixo.slice(0, 26) + '…' : eixo])[0];
const eixoCurtoEm = (eixo, l) => eixoCurto(eixo).replace(/^eixo/i, tv(l, 'Eixo'));
const eixoBadge = eixo => eixo ? `<span class="eixo-badge" style="--c:${eixoCor(eixo)}" title="${e(eixo)}" ${TR({ pt: eixoCurtoEm(eixo, 'pt'), en: eixoCurtoEm(eixo, 'en'), es: eixoCurtoEm(eixo, 'es') })}>${e(eixoCurto(eixo))}</span>` : '';

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

const temHero = p => p === 'inicio';

// Banner da página inicial em 60/30/10: branco de fundo (com letras animadas), azul no título e no símbolo, amarelo nas ações.
function hero(base) {
  return `<section class="hero">
  <div class="hero-in">
    <div class="hero-texto">
      <h1 class="hero-nome" ${TR(config.nome_evento)}>${e(nomeEvento)}</h1>
      <form class="hero-busca" action="${base}trabalhos/" method="get" role="search">
        <label class="sr" for="q-topo" ${T('home.buscar_titulo')}>${t('home.buscar_titulo')}</label>
        <input id="q-topo" name="q" type="search" placeholder="${e(t('home.buscar_placeholder'))}" data-i18n-ph="home.buscar_placeholder" autocomplete="off">
        <button type="submit"><span ${T('home.buscar_botao')}>${t('home.buscar_botao')}</span></button>
      </form>
      ${sugestoes.length ? `<p class="hero-temas"><span ${T('home.sugestoes')}>${t('home.sugestoes')}</span> ${sugestoes.map(v => `<a href="${base}trabalhos/?q=${encodeURIComponent(v)}">${e(v)}</a>`).join('<span aria-hidden="true">, </span>')}</p>` : ''}
    </div>
    ${config.simbolo_banner ? `<img class="hero-simbolo" src="${base}${e(config.simbolo_banner)}" alt="" width="445" height="339">` : ''}
  </div>
</section>`;
}

function layout({ base, titulo, descricao = '', pagina, corpo, metaExtra = '', canonical = '' }) {
  const tituloCompleto = titulo ? `${titulo} · ${nomeEvento}` : nomeEvento;
  const nav = [['inicio', '', 'nav.inicio'], ['banners', 'banners/', 'nav.banners'], ['trabalhos', 'trabalhos/', 'nav.trabalhos'], ['autores', 'autores/', 'nav.autores'], ['fotos', 'fotos/', 'nav.fotos'], ['explorar', 'explorar/', 'nav.explorar']]
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
<link rel="manifest" href="${base}manifest.webmanifest">
<link rel="apple-touch-icon" href="${base}app-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}assets/style.css?v=${versao}">
<style>:root{--primary:${e(cores.primaria)};--accent:${e(cores.secundaria || cores.primaria)};--accent-ink:${e(cores.texto_sobre_secundaria || '#1D1B20')};--hero-bg:${e(cores.banner_fundo)};--hero-dots:${e(cores.banner_pontos)};--hero-ink:${e(cores.banner_texto || '#FFFFFF')};--bg:${e(cores.fundo)};--text:${e(cores.texto)};--footer:${e(cores.rodape || cores.texto)}}</style>
<script>window.SITE={base:${JSON.stringify(base)},v:${JSON.stringify(versao)},pagina:${JSON.stringify(pagina)},porPagina:${Number(config.itens_por_pagina) || 12},idiomaPadrao:${JSON.stringify(config.idioma_padrao || 'pt')},selo:${JSON.stringify(selo)},mono:${JSON.stringify(monograma)},eixos:${JSON.stringify(Object.fromEntries(eixos.map(x => [x, [eixoCurto(x), eixoCor(x)]])))}};</script>
<script>if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register(${JSON.stringify(base)}+'sw.js').catch(function(){})});</script>
</head>
<body>
<a class="pular" href="#conteudo" ${T('nav.pular')}>${t('nav.pular')}</a>
<header class="topbar">
  <a class="topbar-org" href="${base}">${config.logo_topo
    ? `<img src="${base}${e(config.logo_topo)}" alt="${e(config.logo_topo_alt || config.sigla || nomeEvento)}">`
    : e((config.sigla || nomeEvento).replace(/[\[\]]/g, ''))}</a>
  <nav class="abas-nav" aria-label="${e(t('nav.principal'))}" ${T('nav.principal')} data-i18n-attr="aria-label">${nav}</nav>
  <div class="idiomas" role="group" aria-label="${t('nav.idioma')}" ${T('nav.idioma')} data-i18n-attr="aria-label">
    <button type="button" data-lang="pt" lang="pt">PT</button>
    <button type="button" data-lang="en" lang="en">EN</button>
    <button type="button" data-lang="es" lang="es">ES</button>
  </div>
</header>
${temHero(pagina) ? hero(base) : ''}
<main id="conteudo">
${corpo}
</main>
<footer class="rodape">
  <div class="rodape-in">
    <div class="rodape-marcas">
      ${config.logo_rodape_rede ? `<img class="rodape-rede" src="${base}${e(config.logo_rodape_rede)}" alt="${e(config.logo_rodape_rede_alt || 'Rede Brasil')}" width="200">` : ''}
      ${config.logo_rodape ? `<img class="rodape-logo" src="${base}${e(config.logo_rodape)}" alt="${e(config.logo_rodape_alt || '')}" width="150">` : ''}
    </div>
    <div class="rodape-info">
      <p><strong ${TR(config.nome_evento)}>${e(nomeEvento)}</strong></p>
      ${config.editora && !/^\[/.test(config.editora) ? `<p>${e(config.editora)}</p>` : ''}
      <p ${T('rodape.feito')}>${t('rodape.feito')}</p>
      ${instagram ? `<a class="rodape-ig" href="https://www.instagram.com/${e(instagram)}/" target="_blank" rel="noopener" aria-label="Instagram @${e(instagram)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.9 1.4 1.4 0 000-2.9z"/></svg><span>@${e(instagram)}</span></a>` : ''}
    </div>
  </div>
</footer>
<script>window.I18N=${JSON.stringify(i18n)};</script>
${pagina === 'trabalhos' ? `<script src="${base}assets/fuse.min.js" defer></script>` : ''}
<script src="${base}assets/app.js?v=${versao}" defer></script>
${pagina === 'explorar' ? `<script src="${base}assets/explorar.js?v=${versao}" defer></script>` : ''}
${pagina === 'banners' ? `<script src="${base}assets/banners.js?v=${versao}" defer></script>` : ''}
${pagina === 'fotos' ? `<script src="${base}assets/fotos.js?v=${versao}" defer></script>` : ''}
</body>
</html>
`;
}

// Autores no formato do card: até 3 nomes em ABNT; mais que isso, "SOBRENOME, Nome et al."
const autoresCurto = x => x.citacao.length > 3 ? `${x.citacao[0]} et al.` : x.citacao.join('; ');

// Card de trabalho em lista (o JS da página Trabalhos gera a mesma marcação).
function card(x, base) {
  return `<li><a class="paper-card" href="${base}trabalho/${x.slug}/">
  <span class="paper-card__n">${e(x.id)}</span>
  <div class="paper-card__body">
    <p class="paper-card__title" ${titTR(x)}>${e(x.titulo)}</p>
    <p class="paper-card__authors">${e(autoresCurto(x))}</p>
    <p class="paper-card__meta">${eixoBadge(x.eixo)}${x.modalidade ? `<span class="paper-card__mod" ${TV(x.modalidade)}>${e(x.modalidade)}</span>` : ''}</p>
  </div>
</a></li>`;
}

async function salvar(rel, html) {
  const f = path.join(dist, rel);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, html);
}

// QR code para enviar fotos pelo formulário (config.fotos_form_url). Some do site se o link estiver vazio.
const formFotos = (config.fotos_form_url || '').trim();
const qrFotosSvg = formFotos ? (await QRCode.toString(formFotos, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#172A55', light: '#FFFFFF' } })).replace(/<\?xml[^>]*>/, '').replace('<svg ', '<svg aria-hidden="true" ') : '';
const qrEnvio = classe => formFotos ? `<a class="qr-envio ${classe}" href="${e(formFotos)}" target="_blank" rel="noopener">${qrFotosSvg}<span><b ${T('fo.envie')}>${t('fo.envie')}</b><small ${T('fo.envie_sub')}>${t('fo.envie_sub')}</small></span></a>` : '';

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(raiz, 'src/assets'), path.join(dist, 'assets'), { recursive: true });
await cp(path.join(raiz, 'node_modules/fuse.js/dist/fuse.min.js'), path.join(dist, 'assets/fuse.min.js'));
for (const pasta of ['public']) {
  if (await existe(path.join(raiz, pasta))) await cp(path.join(raiz, pasta), dist, { recursive: true });
}
if (await existe(path.join(raiz, 'pdfs'))) await cp(path.join(raiz, 'pdfs'), path.join(dist, 'pdfs'), { recursive: true });

// Fotos do encontro (pessoas ao lado da TV com o banner). Vêm da pasta do Drive pelo "npm run fotos".
// A mais nova primeiro. Cada uma pode estar ligada a um trabalho pelo número.
const fotos = [];
{
  const nums = new Set(trabalhos.map(x => x.slug));
  for (const f of (await lerFotosCsv(path.join(raiz, 'data/fotos.csv'))).reverse()) {
    if (!(await existe(path.join(raiz, 'fotos', f.id + '.jpg')))) continue;
    fotos.push({ id: f.id, n: nums.has(f.numero) ? f.numero : '', g: `fotos/${f.id}.jpg`, p: `fotos/${f.id}-p.jpg` });
  }
  if (fotos.length) await cp(path.join(raiz, 'fotos'), path.join(dist, 'fotos'), { recursive: true });
  for (const x of trabalhos) x.fotos = fotos.filter(f => f.n === x.slug);
}

// Imagens das páginas de cada PDF, para a pré-visualização no celular. O Safari do iPhone/iPad não
// ajusta um PDF dentro de um iframe (mostra um pedaço ampliado, sem rolagem), então lá o site mostra
// estas imagens. Precisa do pdftoppm (pacote poppler-utils); sem ele, fica só o iframe.
{
  const rodar = promisify(execFile);
  const temPoppler = await rodar('pdftoppm', ['-v']).then(() => true, () => false);
  if (!temPoppler) console.warn('Aviso: pdftoppm não encontrado; a pré-visualização em imagem (iPhone) não foi gerada.');
  else {
    const pasta = path.join(dist, 'previas');
    await mkdir(pasta, { recursive: true });
    const comPdf = trabalhos.filter(x => x.pdfLocal);
    for (let i = 0; i < comPdf.length; i += 4) {
      await Promise.all(comPdf.slice(i, i + 4).map(async x => {
        try {
          await rodar('pdftoppm', ['-jpeg', '-jpegopt', 'quality=80', '-scale-to', '1600', '-l', '20', path.join(raiz, x.pdfLocal), path.join(pasta, x.slug)]);
        } catch (err) { console.warn(`Aviso: não deu para gerar a imagem do PDF ${x.slug}: ${err.message.split('\n')[0]}`); }
      }));
    }
    const arquivos = await readdir(pasta);
    for (const x of comPdf) {
      x.previaImgs = arquivos.filter(f => f.startsWith(x.slug + '-') && f.endsWith('.jpg'))
        .sort((a, b) => coll.compare(a, b)).map(f => 'previas/' + f);
    }
  }
}
await mkdir(path.join(dist, 'data'), { recursive: true });
await cp(path.join(raiz, 'data/trabalhos.json'), path.join(dist, 'data/trabalhos.json'));
await writeFile(path.join(dist, '.nojekyll'), '');

// ---------- Início ----------
{
  const base = './';
  const corpo = `
${txt(config.apresentacao) ? `<section class="sec apresentacao"><p ${TR(config.apresentacao)}>${e(txt(config.apresentacao))}</p></section>` : ''}
<section class="sec" id="eixos">
  <div class="sec-cab">
    <h2 class="tit-sec" ${T('home.eixos_titulo')}>${t('home.eixos_titulo')}</h2>
    <a class="link-seta" href="trabalhos/" ${T('home.ver_todos')}>${t('home.ver_todos')}</a>
  </div>
  <ol class="eixos">
    ${eixos.map((x, i) => `<li><a class="eixo" style="--c:${eixoCor(x)}" href="trabalhos/?eixo=${encodeURIComponent(x)}"><b class="eixo-n">${String(i + 1).padStart(2, '0')}</b><span class="eixo-nome" ${TV(x, semPrefixoEixo)}>${e(semPrefixoEixo(x))}</span></a></li>`).join('\n    ')}
  </ol>
</section>
<section class="sec" id="vistos" hidden>
  <h2 class="tit-sec" ${T('home.vistos')}>${t('home.vistos')}</h2>
  <ul class="papers" id="vistos-lista"></ul>
</section>`;
  await salvar('index.html', layout({ base, titulo: '', pagina: 'inicio', corpo, canonical: siteURL ? siteURL + '/' : '' }));
}

// ---------- Trabalhos (lista com busca e filtros na barra lateral) ----------
function grupoFiltro(id, rotulo, valores, contar, cor) {
  return `<div class="filter-group" data-campo="${id}">
      <h3><span ${T(rotulo)}>${t(rotulo)}</span></h3>
      <ul class="filter-list">${valores.map(v => `<li><button type="button" data-valor="${e(v)}" aria-pressed="false"><span class="fl-nome"${cor ? ` style="--c:${cor(v)}"` : ''} ${TV(v)}>${e(v)}</span><span class="fl-n">${contar(v)}</span></button></li>`).join('')}</ul>
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
        <button type="button" data-vista="cards" aria-pressed="true" title="${e(t('lista.vista_cards'))}" data-i18n-title="lista.vista_cards"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v4H4zm0 5h16v4H4zm0 5h16v4H4z"/></svg><span ${T('lista.vista_cards')}>${t('lista.vista_cards')}</span></button>
        <button type="button" data-vista="tabela" aria-pressed="false" title="${e(t('lista.vista_tabela'))}" data-i18n-title="lista.vista_tabela"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h18v16H3zm2 2v3h14V6zm0 5v3h14v-3zm0 5v2h14v-2z"/></svg><span ${T('lista.vista_tabela')}>${t('lista.vista_tabela')}</span></button>
      </div>
    </div>
    <p id="contagem" class="contagem" aria-live="polite"></p>
    <div id="tabela" class="tabela-wrap" hidden></div>
    <ul id="lista" class="papers">${trabalhos.map(x => card(x, base)).join('\n')}</ul>
    <nav id="paginacao" class="paginacao" aria-label="${e(t('lista.paginacao'))}" ${T('lista.paginacao')} data-i18n-attr="aria-label"></nav>
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
    ['citation_doi', x.doi],
    ['citation_keywords', [...new Set([...x.pc.pt, ...x.pc.en, ...x.pc.es])].join('; ')],
    ...(x.titulos.en ? [['DC.title.alternative', x.titulos.en]] : []),
    ['citation_pdf_url', x.pdfLocal && siteURL ? `${siteURL}/${x.pdfLocal}` : x.pdf?.baixar],
    ['citation_abstract_html_url', url],
    ['citation_language', 'pt']
  ].filter(([, v]) => v).map(([n, v]) => `<meta name="${n}" content="${e(v)}">`).join('\n');
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
    ${x.modalidade ? `<div><dt ${T('trab.modalidade')}>${t('trab.modalidade')}</dt><dd><a href="${base}trabalhos/?modalidade=${encodeURIComponent(x.modalidade)}" ${TV(x.modalidade)}>${e(x.modalidade)}</a></dd></div>` : ''}
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
          ? `${x.previaImgs?.length ? `<a class="btn" href="${base}banners/?n=${e(x.slug)}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h7v2H6v5H4zm16 0v7h-2V6h-5V4zM4 20v-7h2v5h5v2zm16 0h-7v-2h5v-5h2z"/></svg><span ${T('trab.modo_banner')}>${t('trab.modo_banner')}</span></a>` : ''}
        <a class="btn btn-sec" href="${x.pdfLocal ? base + x.pdfLocal : e(x.pdf.baixar)}" ${x.pdfLocal ? `download="${e(x.slug)}.pdf"` : 'rel="noopener"'}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5z"/></svg><span ${T('trab.baixar_pdf')}>${t('trab.baixar_pdf')}</span></a>`
          : `<p class="aviso" ${T('trab.sem_pdf')}>${t('trab.sem_pdf')}</p>`}
      </div>
      ${x.eixo ? `<section class="caixa"><div class="caixa-cab"><h2 ${T('trab.eixo')}>${t('trab.eixo')}</h2></div><p class="caixa-corpo"><a href="${base}trabalhos/?eixo=${encodeURIComponent(x.eixo)}" ${TV(x.eixo)}>${e(x.eixo)}</a></p></section>` : ''}
      ${x.fotos.length ? `<section class="caixa trab-fotos"><div class="caixa-cab"><h2 ${T('fo.no_encontro')}>${t('fo.no_encontro')}</h2></div><ul class="trab-fotos-lista">${x.fotos.map(f => `<li><a href="${base}fotos/?foto=${encodeURIComponent(f.id)}"><img src="${base}${f.p}" alt="" loading="lazy" decoding="async"></a></li>`).join('')}</ul><p class="caixa-corpo"><a href="${base}fotos/?n=${x.slug}" ${T('fo.ver_todas')}>${t('fo.ver_todas')}</a></p></section>` : ''}
    </aside>
  </div>
  ${(() => {
    const src = x.pdfLocal ? `${base}${x.pdfLocal}#view=FitH` : x.pdf?.previa;
    return src ? `<section class="previa" id="previa" aria-labelledby="previa-tit">
    <h2 class="tit-sec" id="previa-tit" ${T('trab.previa')}>${t('trab.previa')}</h2>
    ${x.previaImgs?.length ? `<div class="previa-imgs">${x.previaImgs.map((img, i) => `<a href="${base}${x.pdfLocal}" target="_blank" rel="noopener"><img src="${base}${img}" alt="${i === 0 ? `${e(t('trab.previa'))}: ${e(x.titulo)}` : ''}" loading="lazy" decoding="async" width="1200" height="1600"></a>`).join('')}<p class="previa-dica" ${T('trab.previa_dica')}>${t('trab.previa_dica')}</p></div>` : ''}
    <div class="previa-quadro${x.previaImgs?.length ? ' tem-imgs' : ''}"><iframe data-src="${e(src)}" src="${x.previaImgs?.length ? 'about:blank' : e(src)}" title="${e(t('trab.previa'))}: ${e(x.titulo)}" loading="lazy" allow="fullscreen"></iframe></div>
  </section>` : '';
  })()}
</article>`;
  await salvar(`trabalho/${x.slug}/index.html`, layout({ base, titulo: x.titulo, descricao: desc, pagina: 'trabalho', corpo, metaExtra: meta, canonical: url }));
}

// ---------- Redirecionamentos (numeração antiga → número da planilha) ----------
// Só para números antigos que não foram reaproveitados por outro trabalho.
try {
  const linhas = (await readFile(path.join(raiz, 'data', 'redirecionamentos.csv'), 'utf8')).trim().split(/\r?\n/).slice(1);
  for (const l of linhas) {
    const [antigo, novo] = l.split(',').map(s => s.trim());
    if (!antigo || !novo || porSlug.has(antigo) || !porSlug.has(novo)) continue;
    const destino = `../${novo}/`;
    await salvar(`trabalho/${antigo}/index.html`, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${destino}"><link rel="canonical" href="${siteURL ? `${siteURL}/trabalho/${novo}/` : destino}"><title>Redirecionando…</title></head><body><p><a href="${destino}">Este trabalho agora é o ${novo}.</a></p></body></html>`);
  }
} catch (err) { if (err.code !== 'ENOENT') throw err; }

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
        <input type="search" id="q-inst" class="fg-busca" placeholder="${e(t('autores.filtrar_inst'))}" data-i18n-ph="autores.filtrar_inst" aria-label="${e(t('autores.filtrar_inst'))}" ${T('autores.filtrar_inst')} data-i18n-attr="aria-label">
        <ul class="filter-list">${listaInst.map(([i, n]) => `<li><button type="button" data-valor="${e(i)}" aria-pressed="false"><span class="fl-nome">${e(i)}</span><span class="fl-n">${n}</span></button></li>`).join('')}</ul>
      </details>` : ''}
    </div>
  </aside>
  <section class="content">
    <h1 class="pag-tit" ${T('autores.titulo')}>${t('autores.titulo')}</h1>
    <nav class="alphabet" aria-label="${e(t('autores.alfabeto'))}" ${T('autores.alfabeto')} data-i18n-attr="aria-label">
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
          <ul class="author-card__works">${a.trabalhos.map(s => porSlug.get(s)).map(x => `<li><span class="author-card__wn" aria-hidden="true">${e(x.id)}</span><a href="${base}trabalho/${x.slug}/" ${titTR(x)}>${e(x.titulo)}</a></li>`).join('')}</ul>
        </details>
      </li>`).join('\n      ')}
    </ul>
  </section>
</div>`;
  await salvar('autores/index.html', layout({ base, titulo: t('autores.titulo'), pagina: 'autores', corpo, canonical: siteURL ? siteURL + '/autores/' : '' }));
}

// ---------- Explorar (página para a TV de toque: mapa, temas em bolhas e vitrine) ----------
{
  const base = '../';
  const geo = JSON.parse(await readFile(path.join(raiz, 'data/brasil-ufs.json'), 'utf8'));
  const ufDe = new Map();
  try {
    for (const l of (await readFile(path.join(raiz, 'data/ufs.csv'), 'utf8')).trim().split(/\r?\n/).slice(1)) {
      const [n, uf] = l.split(',').map(s => s.trim());
      if (n && uf) ufDe.set(n, uf.toUpperCase());
    }
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  const semUF = trabalhos.filter(x => !ufDe.has(x.slug)).map(x => x.slug);
  if (semUF.length) console.warn(`Aviso: ${semUF.length} trabalho(s) sem estado em data/ufs.csv (fora do mapa): ${semUF.join(', ')}`);

  const REGIOES = { CO: ['Centro-Oeste', '#2E54A2'], NE: ['Nordeste', '#F9B234'], SE: ['Sudeste', '#076633'], S: ['Sul', '#B86CAA'], N: ['Norte', '#5E595B'] };
  const porUF = {};
  for (const x of trabalhos) { const uf = ufDe.get(x.slug); if (uf) (porUF[uf] ??= []).push(x.slug); }
  const dados = {
    regioes: REGIOES,
    ufs: Object.fromEntries(Object.entries(geo.ufs).map(([uf, g]) => [uf, { nome: g.nome, r: g.regiao, n: (porUF[uf] || []).length }])),
    eixos: eixos.map(x => ({ id: x, curto: eixoCurto(x), nome: { pt: semPrefixoEixo(x), en: semPrefixoEixo(tv('en', x)), es: semPrefixoEixo(tv('es', x)) }, cor: eixoCor(x) })),
    trabalhos: trabalhos.map(x => ({
      n: x.slug, uf: ufDe.get(x.slug) || '', eixo: x.eixo,
      t: { pt: x.titulos.pt || x.titulo, en: x.titulos.en || x.titulo, es: x.titulos.es || x.titulo },
      a: autoresCurto(x), img: x.previaImgs?.[0] || ''
    })),
    fotos: fotos.filter(f => f.n).map(f => ({ n: f.n, g: f.g }))
  };
  // Estados pequenos ganham um marcador fora do contorno, com uma linha até o estado.
  const DESLOCA = { DF: [-150, -120], RN: [95, -40], PB: [105, 8], PE: [95, 58], ES: [95, 20], SC: [110, 10], RS: [0, 0], SP: [0, 0], GO: [-10, 25] };
  const marcadores = Object.entries(porUF).map(([uf, l]) => {
    const g = geo.ufs[uf]; if (!g) return '';
    const [dx, dy] = DESLOCA[uf] || [0, 0];
    const [cx, cy] = g.c, mx = cx + dx, my = cy + dy, raio = 26 + Math.sqrt(l.length) * 6;
    const cor = REGIOES[g.regiao]?.[1] || '#5E595B';
    return `<g class="ex-marca" data-uf="${uf}" role="button" tabindex="0" aria-label="${e(g.nome)}: ${l.length}">
      ${dx || dy ? `<line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}"/><circle class="ex-ponto" cx="${cx}" cy="${cy}" r="5"/>` : ''}
      <circle class="ex-bola" cx="${mx}" cy="${my}" r="${raio.toFixed(0)}" style="--c:${cor}"/>
      <text x="${mx}" y="${my - 6}" class="ex-marca-n">${l.length}</text>
      <text x="${mx}" y="${my + 17}" class="ex-marca-uf">${uf}</text>
    </g>`;
  }).join('');
  const mapa = `<svg class="ex-mapa" viewBox="-170 -20 ${geo.w + 300} ${geo.h + 40}" role="group" aria-label="${e(t('ex.mapa_rotulo'))}" ${T('ex.mapa_rotulo')} data-i18n-attr="aria-label">
    <g class="ex-zoom">
      ${Object.entries(geo.ufs).map(([uf, g]) => `<path class="ex-uf${porUF[uf] ? ' tem' : ''}" data-uf="${uf}" d="${g.d}" style="--c:${REGIOES[g.regiao]?.[1] || '#5E595B'}"><title>${e(g.nome)}</title></path>`).join('')}
      ${marcadores}
    </g>
  </svg>`;
  const regioesLista = Object.entries(REGIOES).map(([r, [nome, cor]]) => {
    const ufs = Object.entries(geo.ufs).filter(([uf, g]) => g.regiao === r && porUF[uf]).sort((a, b) => porUF[b[0]].length - porUF[a[0]].length);
    if (!ufs.length) return '';
    const total = ufs.reduce((s, [uf]) => s + porUF[uf].length, 0);
    return `<li class="ex-reg" style="--c:${cor}">
      <p class="ex-reg-tit"><span class="ex-dot" aria-hidden="true"></span>${e(nome)}<span class="ex-reg-n">${total}</span></p>
      <ul>${ufs.map(([uf, g]) => `<li><button type="button" class="ex-uf-btn" data-uf="${uf}"><span>${e(g.nome)}</span><span class="ex-n">${porUF[uf].length}</span></button></li>`).join('')}</ul>
    </li>`;
  }).join('');
  const corpo = `
<div class="ex">
  <section class="ex-sec ex-intro">
    <h1 ${T('ex.titulo')}>${t('ex.titulo')}</h1>
    <p ${T('ex.sub')}>${t('ex.sub')}</p>
  </section>

  <section class="ex-sec" aria-labelledby="ex-mapa-tit">
    <h2 class="tit-sec" id="ex-mapa-tit" ${T('ex.mapa_tit')}>${t('ex.mapa_tit')}</h2>
    <div class="ex-mapa-quadro">
      <div class="ex-mapa-area">${mapa}
        <button type="button" class="ex-voltar" hidden ${T('ex.ver_brasil')}>${t('ex.ver_brasil')}</button>
      </div>
      <aside class="ex-lado">
        <div class="ex-lado-lista">
          <p class="ex-lado-tit" ${T('ex.escolha')}>${t('ex.escolha')}</p>
          <ul class="ex-regs">${regioesLista}</ul>
        </div>
        <div class="ex-lado-uf" hidden>
          <p class="ex-lado-tit"><span class="ex-dot" aria-hidden="true"></span><span class="ex-uf-nome"></span></p>
          <ul class="ex-cards"></ul>
        </div>
      </aside>
    </div>
  </section>

  <section class="ex-sec" aria-labelledby="ex-temas-tit">
    <h2 class="tit-sec" id="ex-temas-tit" ${T('ex.temas_tit')}>${t('ex.temas_tit')}</h2>
    <p class="ex-dica" ${T('ex.temas_dica')}>${t('ex.temas_dica')}</p>
    <div class="ex-bolhas" aria-live="polite"></div>
  </section>

  <p class="ex-vitrine-ativar"><button type="button" class="btn btn-sec" id="ex-vitrine-btn" ${T('ex.vitrine_btn')}>${t('ex.vitrine_btn')}</button></p>
</div>

<div class="ex-folha" role="dialog" aria-modal="true" aria-labelledby="ex-folha-tit" hidden>
  <div class="ex-folha-in">
    <button type="button" class="ex-fechar" aria-label="${e(t('ex.fechar'))}" ${T('ex.fechar')} data-i18n-attr="aria-label">×</button>
    <h2 id="ex-folha-tit"></h2>
    <ul class="ex-posters"></ul>
  </div>
</div>

<div class="ex-vitrine" hidden>
  <div class="ex-vit-img"><img alt=""></div>
  <div class="ex-vit-info">
    <p class="ex-vit-n"></p>
    <p class="ex-vit-t"></p>
    <p class="ex-vit-a"></p>
    <p class="ex-vit-meta"></p>
  </div>
  <p class="ex-vit-toque" ${T('ex.vitrine_toque')}>${t('ex.vitrine_toque')}</p>
  <span class="ex-vit-barra" aria-hidden="true"></span>
</div>
<script>window.EXPLORAR=${JSON.stringify(dados).replace(/</g, '\\u003c')};</script>`;
  await salvar('explorar/index.html', layout({ base, titulo: t('ex.titulo'), pagina: 'explorar', corpo, canonical: siteURL ? siteURL + '/explorar/' : '' }));
}

// ---------- Banners (crachás no trilho: cada pessoa acha o próprio banner e abre grande para a foto) ----------
{
  const base = '../';
  const dados = {
    eixos: eixos.map(x => ({ id: x, curto: eixoCurto(x), nome: { pt: semPrefixoEixo(x), en: semPrefixoEixo(tv('en', x)), es: semPrefixoEixo(tv('es', x)) }, cor: eixoCor(x) })),
    trabalhos: trabalhos.filter(x => x.previaImgs?.length).map(x => ({
      n: x.slug, eixo: x.eixo,
      t: { pt: x.titulos.pt || x.titulo, en: x.titulos.en || x.titulo, es: x.titulos.es || x.titulo },
      a: x.autores, img: x.previaImgs[0], f: x.fotos.map(f => f.p)
    }))
  };
  const corpo = `
<div class="bn">
  <section class="bn-topo">
    <div>
      <h1 ${T('bn.titulo')}>${t('bn.titulo')}</h1>
      <p ${T('bn.sub')}>${t('bn.sub')}</p>
    </div>
    <label class="bn-busca">
      <span class="sr" ${T('bn.buscar')}>${t('bn.buscar')}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 2a8 8 0 016.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z"/></svg>
      <input id="bn-q" type="search" autocomplete="off" placeholder="${e(t('bn.buscar'))}" data-i18n-ph="bn.buscar">
    </label>
  </section>
  <nav class="bn-abas" aria-label="${e(t('bn.eixos'))}" ${T('bn.eixos')} data-i18n-attr="aria-label"></nav>
  <section class="bn-loja" aria-live="polite">
    <div class="bn-trilho"><div class="bn-barra" aria-hidden="true"></div><ul class="bn-pecas"></ul></div>
    <p class="bn-nada" hidden ${T('bn.nada')}>${t('bn.nada')}</p>
    <div class="bn-legenda"></div>
  </section>
</div>
<div class="bn-foto${formFotos ? ' tem-qr' : ''}" role="dialog" aria-modal="true" aria-label="${e(t('bn.foto'))}" hidden>
  <div class="bn-foto-cab">
    <button type="button" class="bn-foto-voltar" ${T('bn.voltar')}>${t('bn.voltar')}</button>
    <div class="bn-foto-marca">
      ${config.logo_topo ? `<img src="${base}${e(config.logo_topo)}" alt="Rede Brasil" class="bn-foto-logo">` : ''}
      <p class="bn-foto-ev">${e(nomeEvento)}</p>
    </div>
    <a class="bn-foto-inicio" href="${base}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg><span ${T('nav.inicio')}>${t('nav.inicio')}</span></a>
  </div>
  <div class="bn-foto-img"><img alt=""></div>
  <div class="bn-foto-info"><p class="bn-foto-n"></p><p class="bn-foto-t"></p><p class="bn-foto-a"></p></div>
  ${qrEnvio('qr-banner')}
</div>
<script>window.BANNERS=${JSON.stringify(dados).replace(/</g, '\\u003c')};</script>`;
  await salvar('banners/index.html', layout({ base, titulo: t('bn.titulo'), pagina: 'banners', corpo, canonical: siteURL ? siteURL + '/banners/' : '' }));
}

// ---------- Fotos (mural com as fotos do encontro; tocar abre grande) ----------
{
  const base = '../';
  const dados = {
    eixos: Object.fromEntries(eixos.map(x => [x, { curto: eixoCurto(x), cor: eixoCor(x) }])),
    trabalhos: Object.fromEntries(trabalhos.filter(x => x.fotos.length).map(x => [x.slug, { eixo: x.eixo, t: { pt: x.titulos.pt || x.titulo, en: x.titulos.en || x.titulo, es: x.titulos.es || x.titulo }, a: x.autores, banner: !!x.previaImgs?.length }])),
    fotos
  };
  const corpo = `
<section class="fo-roda" aria-label="${e(t('fo.recentes'))}" ${T('fo.recentes')} data-i18n-attr="aria-label">
  <div class="fo-roda-anel"></div>
  <div class="fo-roda-centro">
    <h1 ${T('fo.titulo')}>${t('fo.titulo')}</h1>
    <p class="fo-roda-sub" ${T('fo.roda_sub')}>${t('fo.roda_sub')}</p>
  </div>
  <p class="fo-roda-toque" ${T('fo.descanso')}>${t('fo.descanso')}</p>
  ${qrEnvio('qr-fotos')}
</section>
<div class="fo">
  <section class="fo-topo">
    <div>
      <h2 class="fo-tit-mural" ${T('fo.todas_tit')}>${t('fo.todas_tit')}</h2>
      <p ${T('fo.sub')}>${t('fo.sub')}</p>
    </div>
    <label class="bn-busca fo-busca">
      <span class="sr" ${T('fo.buscar')}>${t('fo.buscar')}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 2a8 8 0 016.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z"/></svg>
      <input id="fo-q" type="search" autocomplete="off" placeholder="${e(t('fo.buscar'))}" data-i18n-ph="fo.buscar">
    </label>
  </section>
  <p class="fo-conta" aria-live="polite"></p>
  <ul class="fo-mural"></ul>
  <p class="fo-nada" hidden ${T('fo.nada')}>${t('fo.nada')}</p>
</div>
<div class="fo-caixa" role="dialog" aria-modal="true" aria-label="${e(t('fo.titulo'))}" hidden>
  <div class="bn-foto-cab">
    <button type="button" class="bn-foto-voltar fo-fechar" ${T('fo.voltar')}>${t('fo.voltar')}</button>
    <div class="bn-foto-marca">
      ${config.logo_rodape_rede ? `<img src="${base}${e(config.logo_rodape_rede)}" alt="Rede Brasil" class="bn-foto-logo">` : ''}
      <p class="bn-foto-ev">${e(nomeEvento)}</p>
    </div>
    <a class="bn-foto-inicio" href="${base}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg><span ${T('nav.inicio')}>${t('nav.inicio')}</span></a>
  </div>
  <div class="fo-palco">
    <button type="button" class="fo-seta fo-ant" aria-label="${e(t('fo.anterior'))}" ${T('fo.anterior')} data-i18n-attr="aria-label"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg></button>
    <div class="fo-img"><img alt=""></div>
    <button type="button" class="fo-seta fo-prox" aria-label="${e(t('fo.proxima'))}" ${T('fo.proxima')} data-i18n-attr="aria-label"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8.6 16.6L10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></button>
  </div>
  <div class="fo-info"></div>
</div>
<script>window.FOTOS=${JSON.stringify(dados).replace(/</g, '\\u003c')};</script>`;
  await salvar('fotos/index.html', layout({ base, titulo: t('fo.titulo'), pagina: 'fotos', corpo, canonical: siteURL ? siteURL + '/fotos/' : '' }));
}

// ---------- 404 (GitHub Pages usa caminho absoluto, então os links apontam para a raiz do site) ----------
{
  const base = siteURL ? new URL(siteURL + '/').pathname : '/';
  const corpo = `<section class="sec vazio"><h1 ${T('404.titulo')}>${t('404.titulo')}</h1><p ${T('404.texto')}>${t('404.texto')}</p><p><a class="btn" href="${base}trabalhos/" ${T('nav.trabalhos')}>${t('nav.trabalhos')}</a></p></section>`;
  await salvar('404.html', layout({ base, titulo: t('404.titulo'), pagina: '404', corpo }));
}

// ---------- sitemap e robots ----------
if (siteURL) {
  const urls = ['/', '/trabalhos/', '/autores/', '/explorar/', '/banners/', '/fotos/', ...trabalhos.map(x => `/trabalho/${x.slug}/`)];
  await salvar('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${e(siteURL + u)}</loc></url>`).join('\n')}\n</urlset>\n`);
  await salvar('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteURL}/sitemap.xml\n`);
}

if (pendentes.length) {
  console.warn(`\nAtenção: ${pendentes.length} campo(s) do config.json ainda provisório(s):`);
  for (const c of pendentes) console.warn(`  - ${c}`);
  console.warn('');
}
console.log(`Site gerado em dist/: ${trabalhos.length} páginas de trabalho, ${autores.length} autores, ${eixos.length} eixos.`);
