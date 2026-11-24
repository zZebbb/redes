// Funções compartilhadas pelos scripts de sync e build.

// Leitor de CSV (RFC 4180): aspas, vírgulas e quebras de linha dentro de campos.
export function parseCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.some(v => v.trim() !== ''));
}

export function semAcento(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// "Palavras-chave" → "palavras_chave"; "Resumo (PT)" → "resumo_pt"
export function normalizarCabecalho(s) {
  return semAcento(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function slugify(s) {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

export function separarLista(s, sep) {
  return String(s ?? '').split(sep).map(v => v.trim()).filter(Boolean);
}

// Converte um link de compartilhamento do Drive em links de visualização e download.
export function driveLinks(link) {
  link = String(link ?? '').trim();
  if (!link) return null;
  const m = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return { ver: link, baixar: link };
  const id = m[1];
  return {
    ver: `https://drive.google.com/file/d/${id}/view`,
    baixar: `https://drive.google.com/uc?export=download&id=${id}`
  };
}

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Nome no formato ABNT: "Ana Beatriz da Silva" → "SILVA, Ana Beatriz da";
// "João Santos Filho" → "SANTOS FILHO, João".
const SUFIXOS = new Set(['filho', 'filha', 'neto', 'neta', 'junior', 'júnior', 'jr', 'jr.', 'sobrinho', 'segundo']);
export function nomeABNT(nome) {
  const p = String(nome).trim().split(/\s+/);
  if (p.length < 2) return p[0]?.toUpperCase() ?? '';
  let n = 1;
  if (p.length > 2 && SUFIXOS.has(p[p.length - 1].toLowerCase())) n = 2;
  const sobrenome = p.slice(-n).join(' ').toUpperCase();
  return `${sobrenome}, ${p.slice(0, -n).join(' ')}`;
}

// Texto do objeto (string ou {pt,en,es}) no idioma pedido, com fallback para PT.
export function txt(v, lang = 'pt') {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.pt || '';
}

// Separa por um caractere apenas fora de parênteses: "A (x; y); B" → ["A (x; y)", "B"].
export function separarNivel0(s, sep = ';') {
  const partes = [];
  let nivel = 0, atual = '';
  for (const c of String(s ?? '')) {
    if (c === '(') nivel++;
    else if (c === ')') nivel = Math.max(0, nivel - 1);
    if (c === sep && nivel === 0) { partes.push(atual); atual = ''; } else atual += c;
  }
  partes.push(atual);
  return partes.map(v => v.trim()).filter(Boolean);
}

// "Ana Silva (UnB (DF); Fiocruz)" → { nome: "Ana Silva", instituicoes: ["UnB (DF)", "Fiocruz"] }
const SEM_INST = /^\(?\s*(institui[çc][ãa]o\s+)?n[ãa]o\s+informad[ao]\s*\)?$/i;
export function autorComInstituicao(s) {
  s = String(s ?? '').trim();
  const i = s.indexOf('(');
  if (i < 0 || !s.endsWith(')')) return { nome: s, instituicoes: [] };
  const nome = s.slice(0, i).trim();
  const dentro = s.slice(i + 1, -1).trim();
  const instituicoes = SEM_INST.test(dentro) ? [] : separarNivel0(dentro, ';');
  return { nome, instituicoes };
}
