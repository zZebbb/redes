// Copia para a pasta fotos/ as fotos novas da pasta "Fotos rede" do Drive (fotos tiradas ao lado da TV com o banner).
// A pasta precisa estar compartilhada como "qualquer pessoa com o link: leitor".
// Cada foto vira fotos/<id>.jpg (até 1600 px) e fotos/<id>-p.jpg (miniatura), e ganha uma linha em data/fotos.csv:
//   id,arquivo,numero
// "numero" liga a foto a um trabalho (ex.: 017). Vem do nome do arquivo no Drive quando ele começa pelo número
// ("017.jpg", "017 (2).jpg", "017 - Ana.jpg"); senão, fica o que já estiver na planilha (dá para preencher à mão).
// Se houver um Google Forms de envio (config.fotos_respostas_csv = planilha de respostas publicada como CSV),
// o número digitado no formulário liga a foto ao trabalho quando ela é movida para a pasta do site.
// Foto apagada do Drive sai do site. Fotos de pastas antigas (coluna "pasta" diferente da atual) ficam como estão.
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
  const pasta = process.env.FOTOS_PASTA_DRIVE || config.fotos_pasta_drive;
  if (!pasta) { console.log('Fotos: nenhuma pasta do Drive configurada (config.json → fotos_pasta_drive).'); process.exit(0); }
  const trabalhos = JSON.parse(await readFile(path.join(raiz, 'data', 'trabalhos.json'), 'utf8'));
  const numeros = new Set(trabalhos.map(t => t.slug));

  let itens;
  try {
    const resp = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(pasta)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    itens = listarPasta(html);
    if (!itens.length && !/flip-entries/.test(html)) throw new Error('a pasta não está pública ("qualquer pessoa com o link")?');
  } catch (err) {
    console.warn(`Aviso: não deu para ler a pasta de fotos do Drive: ${err.message}. Nada foi alterado.`);
    process.exit(0);
  }
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
  itens = itens.filter(x => /\.(jpe?g|png|heic|heif|webp)$/i.test(x.arquivo) || !/\.[a-z0-9]{2,5}$/i.test(x.arquivo));

  await mkdir(pastaFotos, { recursive: true });
  const antes = await lerFotosCsv(csv);
  const porId = new Map(antes.map(f => [f.id, f]));
  const naPasta = new Set(itens.map(x => x.id));
  const depois = [];
  let novas = 0, falhas = 0, removidas = 0;

  // Mantém a ordem de chegada: as que já estavam primeiro, as novas no fim.
  // Fotos de outra pasta (de antes da troca) ficam no site sem mudança.
  const deOutraPasta = f => f.pasta && f.pasta !== pasta;
  const ordem = [...antes.filter(f => deOutraPasta(f) || naPasta.has(f.id)).map(f => f.id), ...itens.map(x => x.id).filter(id => !porId.has(id))];
  const itemDe = new Map(itens.map(x => [x.id, x]));
  for (const id of ordem) {
    const x = itemDe.get(id), velho = porId.get(id);
    if (!x) { depois.push(velho); continue; }
    const doNome = numeroDoNome(x.arquivo);
    const doFormulario = doForm.get(id);
    const numero = doNome && numeros.has(doNome) ? doNome : velho?.numero || (doFormulario && numeros.has(doFormulario) ? doFormulario : '');
    const grande = path.join(pastaFotos, `${id}.jpg`), mini = path.join(pastaFotos, `${id}-p.jpg`);
    if (!(await existe(grande)) || !(await existe(mini))) {
      try {
        const orig = path.join(pastaFotos, `${id}.orig`);
        await writeFile(orig, await baixarImagem(id));
        await rodar('convert', [orig + '[0]', '-auto-orient', '-resize', '1600x1600>', '-strip', '-quality', '84', grande]);
        await rodar('convert', [orig + '[0]', '-auto-orient', '-resize', '640x640>', '-strip', '-quality', '78', mini]);
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
    depois.push({ id, arquivo: x.arquivo, numero, pasta });
  }
  for (const f of antes) {
    if (naPasta.has(f.id) || deOutraPasta(f)) continue;
    await rm(path.join(pastaFotos, `${f.id}.jpg`), { force: true });
    await rm(path.join(pastaFotos, `${f.id}-p.jpg`), { force: true });
    removidas++;
  }
  await escreverFotosCsv(csv, depois);
  const semNumero = depois.filter(f => !f.numero).length;
  console.log(`Fotos: ${depois.length} no site, ${novas} nova(s), ${removidas} removida(s)${falhas ? `, ${falhas} com erro` : ''}${semNumero ? `; ${semNumero} sem número de trabalho` : ''}.`);
}
