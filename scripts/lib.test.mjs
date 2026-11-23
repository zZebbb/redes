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
  const esperado = { ver: 'https://drive.google.com/file/d/ABC_1/view', baixar: 'https://drive.google.com/uc?export=download&id=ABC_1' };
  assert.deepEqual(driveLinks('https://drive.google.com/file/d/ABC_1/view?usp=sharing'), esperado);
  assert.deepEqual(driveLinks('https://drive.google.com/open?id=ABC_1'), esperado);
  assert.equal(driveLinks(''), null);
});

test('cabeçalhos tolerantes', () => {
  assert.equal(normalizarCabecalho('Palavras-chave'), 'palavras_chave');
  assert.equal(normalizarCabecalho(' Resumo (PT) '), 'resumo_pt');
  assert.equal(normalizarCabecalho('Título'), 'titulo');
});
