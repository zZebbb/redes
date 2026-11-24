// Baixa a planilha (CSV publicado do Google Sheets) e gera:
//   data/trabalhos.json  – um objeto por trabalho aprovado
//   data/autores.json    – autores com a lista de trabalhos de cada um
// Sem URL configurada, usa data/trabalhos.csv (ou data/exemplo.csv; force com --exemplo).
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCSV, normalizarCabecalho, slugify, driveLinks, separarLista, separarNivel0, autorComInstituicao, nomeABNT } from './lib.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(raiz, 'config.json'), 'utf8'));
const existe = f => access(f).then(() => true, () => false);
const usarExemplo = process.argv.includes('--exemplo');
const url = (process.env.PLANILHA_CSV_URL || config.planilha_csv_url || '').trim();

// Aceita tanto o link "Publicar na web → CSV" quanto o link normal da planilha.
function urlCSV(u) {
  if (/output=csv|format=csv/.test(u)) return u;
  const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1] !== 'e') {
    const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1] || '0';
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
  }
  return u;
}

let texto, origem;
if (url && !usarExemplo) {
  origem = urlCSV(url);
  console.log(`Baixando planilha: ${origem}`);
  const resp = await fetch(origem, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`Não foi possível baixar a planilha (HTTP ${resp.status}). Confira se ela está publicada na web como CSV.`);
  texto = await resp.text();
  if (/^\s*<!DOCTYPE html|<html/i.test(texto)) {
    throw new Error('A URL devolveu uma página HTML, não um CSV. Publique a planilha em Arquivo → Compartilhar → Publicar na web → formato CSV.');
  }
} else {
  const local = path.join(raiz, 'data', 'trabalhos.csv');
  origem = !usarExemplo && await existe(local) ? local : path.join(raiz, 'data', 'exemplo.csv');
  console.log(`Sem URL de planilha: usando ${path.relative(raiz, origem)}`);
  texto = await readFile(origem, 'utf8');
}

// Links dos PDFs guardados no repositório (Nº público → link do Drive), usados
// quando a planilha não tem a coluna "Link do PDF".
const linksPDF = new Map();
const arqLinks = path.join(raiz, 'data', 'pdfs.csv');
if (await existe(arqLinks)) {
  const [cab, ...ls] = parseCSV(await readFile(arqLinks, 'utf8'));
  for (const l of ls) if (l[0] && l[1]) linksPDF.set(l[0].trim(), l[1].trim());
}

const linhas = parseCSV(texto);
if (linhas.length < 2) throw new Error('A planilha está vazia.');
const cab = linhas[0].map(normalizarCabecalho);

// Nomes de coluna aceitos para cada campo (o primeiro que existir vale).
const ALIAS = {
  id: ['id', 'n_publico', 'numero', 'no_publico'],
  status: ['status', 'situacao'],
  titulo_pt: ['titulo_pt', 'titulo'],
  titulo_en: ['titulo_en'],
  titulo_es: ['titulo_es'],
  autores: ['autores_e_instituicoes', 'autores'],
  citacao: ['autores_como_citar', 'autores_citacao'],
  eixo: ['eixo', 'eixo_tematico'],
  modalidade: ['modalidade', 'categoria'],
  resumo_pt: ['resumo_pt', 'resumo'],
  resumo_en: ['resumo_en'],
  resumo_es: ['resumo_es'],
  pc_pt: ['palavras_chave_pt', 'palavras_chave'],
  pc_en: ['palavras_chave_en'],
  pc_es: ['palavras_chave_es'],
  link_pdf: ['link_pdf', 'link_do_pdf', 'link_do_banner', 'pdf'],
  ano: ['ano'],
  doi: ['doi']
};
const col = {};
for (const [campo, nomes] of Object.entries(ALIAS)) col[campo] = nomes.map(n => cab.indexOf(n)).find(i => i >= 0);
for (const c of ['titulo_pt', 'autores']) {
  if (col[c] === undefined) throw new Error(`Coluna obrigatória ausente na planilha: "${ALIAS[c][0]}". Colunas encontradas: ${cab.join(', ')}`);
}

const ids = new Set();
const avisos = [];
const trabalhos = [];
let aprovados = 0;
for (const [i, linha] of linhas.slice(1).entries()) {
  const v = campo => col[campo] === undefined ? '' : String(linha[col[campo]] ?? '').trim();
  if (!v('titulo_pt')) continue; // linha vazia
  const nLinha = i + 2;
  // Com coluna Status, só entram os aprovados.
  if (col.status !== undefined && !/^aprovad/i.test(v('status'))) continue;
  aprovados++;
  const id = v('id') || String(aprovados).padStart(3, '0');
  const slug = slugify(id);
  if (ids.has(slug)) { avisos.push(`Linha ${nLinha}: número "${id}" repetido, ignorada.`); continue; }
  ids.add(slug);

  const autoresInst = separarNivel0(v('autores'), ';').map(autorComInstituicao);
  let citacao = separarNivel0(v('citacao'), ';');
  if (citacao.length !== autoresInst.length) {
    if (citacao.length) avisos.push(`Trabalho ${id}: "Autores (como citar)" tem ${citacao.length} nomes e "Autores" tem ${autoresInst.length}; usando os nomes da coluna Autores.`);
    citacao = autoresInst.map(a => nomeABNT(a.nome));
  }
  const link = v('link_pdf') || linksPDF.get(id) || '';
  if (!link) avisos.push(`Trabalho ${id}: sem link do PDF.`);
  const pc = l => separarLista(v('pc_' + l), /;/);

  trabalhos.push({
    id,
    slug,
    titulo: v('titulo_pt'),
    titulos: { pt: v('titulo_pt'), en: v('titulo_en'), es: v('titulo_es') },
    autores: autoresInst.map(a => a.nome),
    instituicoes: autoresInst.map(a => a.instituicoes),
    citacao,
    eixo: v('eixo'),
    modalidade: v('modalidade'),
    palavras_chave: pc('pt'),
    pc: { pt: pc('pt'), en: pc('en'), es: pc('es') },
    resumo: { pt: v('resumo_pt'), en: v('resumo_en'), es: v('resumo_es') },
    ano: v('ano') || config.edicao || '',
    doi: v('doi') || (config.doi_prefixo ? `${config.doi_prefixo}${id}` : ''),
    pdf: driveLinks(link)
  });
}

// Ordena pelo número público.
const coll = new Intl.Collator('pt', { sensitivity: 'base', numeric: true });
trabalhos.sort((a, b) => coll.compare(a.id, b.id));

const mapa = new Map();
for (const t of trabalhos) {
  t.autores.forEach((nome, j) => {
    const chave = slugify(nome);
    if (!mapa.has(chave)) mapa.set(chave, { nome, slug: chave, instituicoes: [], trabalhos: [] });
    const a = mapa.get(chave);
    a.trabalhos.push(t.slug);
    for (const inst of t.instituicoes[j]) if (!a.instituicoes.includes(inst)) a.instituicoes.push(inst);
  });
}
const autores = [...mapa.values()].sort((a, b) => coll.compare(a.nome, b.nome));

await writeFile(path.join(raiz, 'data', 'trabalhos.json'), JSON.stringify(trabalhos, null, 2) + '\n');
await writeFile(path.join(raiz, 'data', 'autores.json'), JSON.stringify(autores, null, 2) + '\n');

console.log(`OK: ${trabalhos.length} trabalhos, ${autores.length} autores.`);
const semPDF = avisos.filter(a => a.endsWith('sem link do PDF.')).length;
for (const a of avisos.filter(a => !a.endsWith('sem link do PDF.'))) console.warn(`Aviso: ${a}`);
if (semPDF) console.warn(`Aviso: ${semPDF} trabalho(s) ainda sem link do PDF.`);
