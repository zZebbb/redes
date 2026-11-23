// Baixa a planilha (CSV publicado do Google Sheets) e gera:
//   data/trabalhos.json  – um objeto por trabalho
//   data/autores.json    – autores com a lista de trabalhos de cada um
// Sem URL configurada (ou com --exemplo), usa data/exemplo.csv.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCSV, normalizarCabecalho, slugify, driveLinks, separarLista } from './lib.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(raiz, 'config.json'), 'utf8'));
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

let texto;
if (url && !usarExemplo) {
  const alvo = urlCSV(url);
  console.log(`Baixando planilha: ${alvo}`);
  const resp = await fetch(alvo, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`Não foi possível baixar a planilha (HTTP ${resp.status}). Confira se ela está publicada na web como CSV.`);
  texto = await resp.text();
  if (/^\s*<!DOCTYPE html|<html/i.test(texto)) {
    throw new Error('A URL devolveu uma página HTML, não um CSV. Publique a planilha em Arquivo → Compartilhar → Publicar na web → formato CSV.');
  }
} else {
  console.log('Sem URL de planilha: usando data/exemplo.csv');
  texto = await readFile(path.join(raiz, 'data', 'exemplo.csv'), 'utf8');
}

const linhas = parseCSV(texto);
if (linhas.length < 2) throw new Error('A planilha está vazia.');
const cab = linhas[0].map(normalizarCabecalho);
const obrigatorias = ['id', 'titulo', 'autores'];
for (const c of obrigatorias) {
  if (!cab.includes(c)) throw new Error(`Coluna obrigatória ausente na planilha: "${c}". Colunas encontradas: ${cab.join(', ')}`);
}

const ids = new Set();
const avisos = [];
const trabalhos = [];
for (const [i, linha] of linhas.slice(1).entries()) {
  const r = Object.fromEntries(cab.map((c, j) => [c, (linha[j] ?? '').trim()]));
  if (!r.id && !r.titulo) continue; // linha vazia
  const nLinha = i + 2;
  if (!r.id) { avisos.push(`Linha ${nLinha}: sem id, ignorada.`); continue; }
  let slug = slugify(r.id);
  if (ids.has(slug)) { avisos.push(`Linha ${nLinha}: id "${r.id}" repetido, ignorada.`); continue; }
  ids.add(slug);
  const pdf = driveLinks(r.link_pdf);
  if (!r.link_pdf) avisos.push(`Trabalho ${r.id}: sem link do PDF.`);
  trabalhos.push({
    id: r.id,
    slug,
    titulo: r.titulo,
    autores: separarLista(r.autores, ';'),
    eixo: r.eixo || '',
    modalidade: r.modalidade || '',
    palavras_chave: separarLista(r.palavras_chave, /[;,]/),
    resumo: { pt: r.resumo_pt || '', en: r.resumo_en || '', es: r.resumo_es || '' },
    ano: r.ano || config.edicao || '',
    doi: r.doi || (config.doi_prefixo ? `${config.doi_prefixo}${r.id}` : ''),
    pdf
  });
}

// Ordena por eixo e depois por título, para uma navegação previsível.
const coll = new Intl.Collator('pt', { sensitivity: 'base', numeric: true });
trabalhos.sort((a, b) => coll.compare(a.eixo, b.eixo) || coll.compare(a.titulo, b.titulo));

const mapa = new Map();
for (const t of trabalhos) {
  for (const nome of t.autores) {
    const chave = slugify(nome);
    if (!mapa.has(chave)) mapa.set(chave, { nome, slug: chave, trabalhos: [] });
    mapa.get(chave).trabalhos.push(t.slug);
  }
}
const autores = [...mapa.values()].sort((a, b) => coll.compare(a.nome, b.nome));

await writeFile(path.join(raiz, 'data', 'trabalhos.json'), JSON.stringify(trabalhos, null, 2) + '\n');
await writeFile(path.join(raiz, 'data', 'autores.json'), JSON.stringify(autores, null, 2) + '\n');

console.log(`OK: ${trabalhos.length} trabalhos, ${autores.length} autores.`);
for (const a of avisos) console.warn(`Aviso: ${a}`);
