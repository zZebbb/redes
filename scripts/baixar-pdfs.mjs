// Copia para a pasta pdfs/ do repositório os PDFs que ainda só existem no Drive.
// Assim o site serve os arquivos pelo próprio endereço e não depende mais do Drive.
// Usa os links de data/trabalhos.json (gerado pelo "npm run sync").
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'pdfs');
const existe = f => access(f).then(() => true, () => false);

export async function baixarDoDrive(id, base = 'https://drive.usercontent.google.com') {
  // "confirm=t" pula o aviso de antivírus que o Drive mostra para arquivos grandes.
  const resp = await fetch(`${base}/download?id=${encodeURIComponent(id)}&export=download&confirm=t`, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== '%PDF-') throw new Error('o Drive não devolveu um PDF (o arquivo está público para "qualquer pessoa com o link"?)');
  return buf;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const trabalhos = JSON.parse(await readFile(path.join(raiz, 'data', 'trabalhos.json'), 'utf8'));
  await mkdir(pasta, { recursive: true });
  let novos = 0, falhas = 0;
  for (const t of trabalhos) {
    const destino = path.join(pasta, `${t.slug}.pdf`);
    if (await existe(destino)) continue;
    const id = t.pdf?.ver?.match(/\/file\/d\/([^/]+)/)?.[1];
    if (!id) continue;
    try {
      await writeFile(destino, await baixarDoDrive(id));
      console.log(`Baixado: pdfs/${t.slug}.pdf`);
      novos++;
    } catch (err) {
      console.warn(`Aviso: trabalho ${t.id}: ${err.message}`);
      falhas++;
    }
  }
  console.log(`PDFs: ${novos} novo(s) copiado(s) do Drive${falhas ? `, ${falhas} com erro` : ''}.`);
}
