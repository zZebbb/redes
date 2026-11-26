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

test('número do trabalho no nome da foto', async () => {
  const { numeroDoNome } = await import('./lib.mjs');
  assert.equal(numeroDoNome('017.jpg'), '017');
  assert.equal(numeroDoNome('17 (2).jpeg'), '017');
  assert.equal(numeroDoNome('RB-38 Ana.jpg'), '038');
  assert.equal(numeroDoNome('043 - Turma.png'), '043');
  assert.equal(numeroDoNome('4AF031B1-738F-4FA7-9F8A-B6947CB8C486.jpg'), '');
  assert.equal(numeroDoNome('1234.jpg'), '');
  assert.equal(numeroDoNome('IMG_5007.png'), '');
});

test('lista da pasta pública do Drive', async () => {
  const { listarPasta } = await import('./fotos.mjs');
  const html = '<div class="flip-entries"><div class="flip-entry" id="entry-1AbC_d-9" tabindex="0"><a href="x"><div class="flip-entry-thumb"></div><div class="flip-entry-title">017 &amp; Ana.jpg</div></a></div></div>';
  assert.deepEqual(listarPasta(html), [{ id: '1AbC_d-9', arquivo: '017 & Ana.jpg' }]);
});

test('numerosDasRespostas liga arquivo do Forms ao número do trabalho', async () => {
  const { numerosDasRespostas } = await import('./lib.mjs');
  const csv = 'Carimbo de data/hora,Número do trabalho,Foto\n26/11/2026 10:00:00,17,"https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWx, https://drive.google.com/open?id=1ZyXwVuTsRqPoNmLkJiHgFeDc"\n26/11/2026 10:05:00,sem número,https://drive.google.com/open?id=1QqQqQqQqQqQqQqQqQqQqQqQ\n';
  const m = numerosDasRespostas(csv);
  assert.equal(m.get('1AbCdEfGhIjKlMnOpQrStUvWx'), '017');
  assert.equal(m.get('1ZyXwVuTsRqPoNmLkJiHgFeDc'), '017');
  assert.equal(m.has('1QqQqQqQqQqQqQqQqQqQqQqQ'), false);
});
