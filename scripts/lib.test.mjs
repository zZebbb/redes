import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, nomeABNT, driveLinks, normalizarCabecalho } from './lib.mjs';

test('CSV com aspas, vírgulas e quebras de linha', () => {
  const r = parseCSV('a,b\n"x, y","linha1\nlinha2 ""ok"""\n');
  assert.deepEqual(r, [['a', 'b'], ['x, y', 'linha1\nlinha2 "ok"']]);
});

test('nome no padrão ABNT', () => {
  assert.equal(nomeABNT('Ana Beatriz da Silva'), 'SILVA, Ana Beatriz da');
  assert.equal(nomeABNT('João Pedro Santos Filho'), 'SANTOS FILHO, João Pedro');
  assert.equal(nomeABNT('Roberto Almeida Júnior'), 'ALMEIDA JÚNIOR, Roberto');
});

test('links do Drive', () => {
  const esperado = { ver: 'https://drive.google.com/file/d/ABC_1/view', baixar: 'https://drive.google.com/uc?export=download&id=ABC_1', previa: 'https://drive.google.com/file/d/ABC_1/preview' };
  assert.deepEqual(driveLinks('https://drive.google.com/file/d/ABC_1/view?usp=sharing'), esperado);
  assert.deepEqual(driveLinks('https://drive.google.com/open?id=ABC_1'), esperado);
  assert.equal(driveLinks(''), null);
});

test('cabeçalhos tolerantes', () => {
  assert.equal(normalizarCabecalho('Palavras-chave'), 'palavras_chave');
  assert.equal(normalizarCabecalho(' Resumo (PT) '), 'resumo_pt');
  assert.equal(normalizarCabecalho('Título'), 'titulo');
});

import { separarNivel0, autorComInstituicao } from './lib.mjs';
test('autores com instituições entre parênteses', () => {
  const s = 'Ana Silva (Fundação Oswaldo Cruz Ceará (Fiocruz Ceará)/RENASF; Centro Universitário Christus); João Souza (instituição não informada)';
  const [a, b] = separarNivel0(s).map(autorComInstituicao);
  assert.deepEqual(a, { nome: 'Ana Silva', instituicoes: ['Fundação Oswaldo Cruz Ceará (Fiocruz Ceará)/RENASF', 'Centro Universitário Christus'] });
  assert.deepEqual(b, { nome: 'João Souza', instituicoes: [] });
});

import http from 'node:http';
import { baixarDoDrive } from './baixar-pdfs.mjs';
test('cópia de PDF do Drive aceita só PDF', async () => {
  const srv = http.createServer((req, res) => {
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    res.end(id === 'ok' ? '%PDF-1.7 teste' : '<html>login</html>');
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.equal((await baixarDoDrive('ok', base)).toString(), '%PDF-1.7 teste');
    await assert.rejects(baixarDoDrive('privado', base), /não devolveu um PDF/);
  } finally { srv.close(); }
});
