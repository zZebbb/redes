// Copia para a pasta fotos/ as fotos novas das pastas do Drive em config.json → fotos_pastas_drive
// ("Fotos rede", "2º DIA" etc.). Cada pasta precisa estar compartilhada como "qualquer pessoa com o link: leitor".
// Cada foto vira fotos/<id>.jpg (até 1600 px) e fotos/<id>-p.jpg (miniatura nítida para o globo, 960 px no lado menor),
// e ganha uma linha em data/fotos.csv:
//   id,arquivo,numero,pasta,status
// status "oculta" (curadoria: repetida/parecida) não é baixada nem vai ao site; "destaque" aparece mais e maior no globo.
// "numero" liga a foto a um trabalho (ex.: 017). Vem do nome do arquivo no Drive quando ele começa pelo número
// ("017.jpg", "017 (2).jpg", "017 - Ana.jpg"); senão, fica o que já estiver na planilha (dá para preencher à mão).
// Se houver um Google Forms de envio (config.fotos_respostas_csv = planilha de respostas publicada como CSV),
// o número digitado no formulário liga a foto ao trabalho quando ela é movida para a pasta do site.
// Foto apagada do Drive sai do site. Fotos de pastas que saíram da lista ficam como estão. A foto em destaque pode ter um recorte fotos/<id>-globo.jpg feito à mão.
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lerFotosCsv, escreverFotosCsv, numeroDoNome, numerosDasRespostas } from './lib.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaFotos = path.join(raiz, 'fotos');
const csv = path.join(raiz, 'data', 'fotos.csv');
const existe = f => access(f).then(() => true, () => false);
const rodar = promisify(execFile);

const desentidade = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

// Lista os arquivos da pasta pública pela página "embeddedfolderview" (não precisa de chave de API).
export function listarPasta(html) {
  const itens = [];
  const re = /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(html))) itens.push({ id: m[1], arquivo: desentidade(m[2]).trim() });
  return itens;
}

// Miniatura do globo: 960 px no lado menor, para continuar nítida quando a foto passa na frente, grande, numa TV.
export const ARGS_MINI = ['-auto-orient', '-resize', '960x960^>', '-strip', '-sampling-factor', '4:2:0', '-quality', '82'];
// Bolinha do globo (fotos/<id>-g.jpg): pequena de propósito. Com dezenas de fotos girando, miniaturas grandes travam a TV.
export const ARGS_GLOBO = ['-resize', '420x420^>', '-strip', '-sampling-factor', '4:2:0', '-quality', '80'];

async function baixarImagem(id) {
  // lh3 devolve a imagem já em JPEG (também para HEIC do iPhone); se falhar, baixa o original.
  const tentativas = [`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w2000`,
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`];
  let ultimo;
  for (const url of tentativas) {
    try {
      const resp = await fetch(url, { redirect: 'follow' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const jpg = buf[0] === 0xff && buf[1] === 0xd8, png = buf.subarray(0, 4).toString('hex') === '89504e47';
      const heic = buf.subarray(4, 8).toString() === 'ftyp', webp = buf.subarray(8, 12).toString() === 'WEBP';
      if (!(jpg || png || heic || webp)) throw new Error('o Drive não devolveu uma imagem');
      return buf;
    } catch (err) { ultimo = err; }
  }
  throw ultimo;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile(path.join(raiz, 'config.json'), 'utf8'));
  const pastas = process.env.FOTOS_PASTA_DRIVE ? process.env.FOTOS_PASTA_DRIVE.split(',').map(s => s.trim()).filter(Boolean)
    : [].concat(config.fotos_pastas_drive || config.fotos_pasta_drive || []).filter(Boolean);
  if (!pastas.length) { console.log('Fotos: nenhuma pasta do Drive configurada (config.json → fotos_pastas_drive).'); process.exit(0); }
  const trabalhos = JSON.parse(await readFile(path.join(raiz, 'data', 'trabalhos.json'), 'utf8'));
  const numeros = new Set(trabalhos.map(t => t.slug));

  // Lista cada pasta. Pasta que não deu para ler fica como está (nada dela é apagado).
  const itens = [], lidas = new Set();
  for (const pasta of pastas) {
    try {
      const resp = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(pasta)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const daPasta = listarPasta(html);
      if (!daPasta.length && !/flip-entries/.test(html)) throw new Error('a pasta não está pública ("qualquer pessoa com o link")?');
      for (const x of daPasta) if (/\.(jpe?g|png|heic|heif|webp)$/i.test(x.arquivo)) itens.push({ ...x, pasta });
      lidas.add(pasta);
    } catch (err) {
      console.warn(`Aviso: não deu para ler a pasta de fotos ${pasta} do Drive: ${err.message}. Ela fica como está.`);
    }
  }
  if (!lidas.size) process.exit(0);
  // Números digitados no formulário de envio (opcional).
  let doForm = new Map();
  const respostas = process.env.FOTOS_RESPOSTAS_CSV || config.fotos_respostas_csv;
  if (respostas) {
    try {
      const r = await fetch(respostas, { redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      doForm = numerosDasRespostas(await r.text());
    } catch (err) { console.warn(`Aviso: não deu para ler as respostas do formulário de fotos: ${err.message}.`); }
  }

  await mkdir(pastaFotos, { recursive: true });
  const antes = await lerFotosCsv(csv);
  const porId = new Map(antes.map(f => [f.id, f]));
  const itemDe = new Map(itens.map(x => [x.id, x]));
  const depois = [];
  let novas = 0, falhas = 0, removidas = 0;

  // Mantém a ordem de chegada: as que já estavam primeiro, as novas no fim.
  // Linha de pasta que não foi lida agora (ou que saiu da lista) fica sem mudança.
  const fixa = f => !lidas.has(f.pasta) || !f.pasta;
  const ordem = [...antes.filter(f => fixa(f) || itemDe.has(f.id)).map(f => f.id), ...itens.map(x => x.id).filter(id => !porId.has(id))];
  for (const id of [...new Set(ordem)]) {
    const x = itemDe.get(id), velho = porId.get(id);
    if (!x) { depois.push(velho); continue; }
    const status = velho?.status || '';
    const doNome = numeroDoNome(x.arquivo);
    const doFormulario = doForm.get(id);
    const numero = doNome && numeros.has(doNome) ? doNome : velho?.numero || (doFormulario && numeros.has(doFormulario) ? doFormulario : '');
    const pessoas = velho?.pessoas || '';
    if (status === 'oculta') { depois.push({ id, arquivo: x.arquivo, numero, pasta: x.pasta, status, pessoas }); continue; }
    const grande = path.join(pastaFotos, `${id}.jpg`), mini = path.join(pastaFotos, `${id}-p.jpg`);
    if (!(await existe(grande)) || !(await existe(mini))) {
      try {
        const orig = path.join(pastaFotos, `${id}.orig`);
        await writeFile(orig, await baixarImagem(id));
        await rodar('convert', [orig + '[0]', '-auto-orient', '-resize', '1600x1600>', '-strip', '-quality', '84', grande]);
        await rodar('convert', [orig + '[0]', ...ARGS_MINI, mini]);
        await rm(orig, { force: true });
        console.log(`Foto nova: ${x.arquivo}${numero ? ` → trabalho ${numero}` : ' (sem número de trabalho)'}`);
        novas++;
      } catch (err) {
        console.warn(`Aviso: foto ${x.arquivo}: ${err.message.split('\n')[0]}`);
        await rm(path.join(pastaFotos, `${id}.orig`), { force: true });
        falhas++;
        continue;
      }
    }
    const bola = path.join(pastaFotos, `${id}-g.jpg`);
    if (!(await existe(bola))) await rodar('convert', [grande, ...ARGS_GLOBO, bola]).catch(err => console.warn(`Aviso: bolinha ${x.arquivo}: ${err.message.split('\n')[0]}`));
    depois.push({ id, arquivo: x.arquivo, numero, pasta: x.pasta, status, pessoas });
  }
  for (const f of antes) {
    if (itemDe.has(f.id) || fixa(f)) continue;
    await rm(path.join(pastaFotos, `${f.id}.jpg`), { force: true });
    await rm(path.join(pastaFotos, `${f.id}-p.jpg`), { force: true });
    await rm(path.join(pastaFotos, `${f.id}-g.jpg`), { force: true });
    removidas++;
  }
  await escreverFotosCsv(csv, depois);
  const noSite = depois.filter(f => f.status !== 'oculta');
  const semNumero = noSite.filter(f => !f.numero).length;
  console.log(`Fotos: ${noSite.length} no site (${depois.length - noSite.length} oculta(s) pela curadoria), ${novas} nova(s), ${removidas} removida(s)${falhas ? `, ${falhas} com erro` : ''}${semNumero ? `; ${semNumero} sem número de trabalho` : ''}.`);
}
