# Anais do evento — site com busca

Site estático dos anais: lista de trabalhos com busca instantânea, filtros por eixo e modalidade, página de cada trabalho (resumo em PT/EN/ES, PDF para ver e baixar, "Como citar" em ABNT) e lista de autores. Interface em português, inglês e espanhol.

Os dados vêm de uma planilha do Google Sheets e os PDFs ficam no Google Drive. O site é gerado automaticamente e publicado no GitHub Pages, sem servidor e sem banco de dados.

> O plano original está em [`docs/PLANO.md`](docs/PLANO.md).

## 1. Preparar a planilha

Uma linha por trabalho, com estas colunas na primeira linha (maiúsculas e acentos não importam):

| Coluna | O que colocar |
|---|---|
| `id` | Identificador único, ex.: `001`. Vira o endereço da página: `/trabalho/001/` |
| `titulo` | Título do trabalho |
| `autores` | Nomes completos separados por **ponto e vírgula**: `Ana da Silva; João Santos Filho` |
| `eixo` | Eixo temático (o site cria os filtros a partir do que estiver aqui) |
| `modalidade` | Ex.: Comunicação Oral, Pôster, Relato de Experiência |
| `palavras_chave` | Separadas por `;` |
| `resumo_pt`, `resumo_en`, `resumo_es` | Resumos. Se faltar algum idioma, o site mostra o resumo em português |
| `link_pdf` | Link de compartilhamento do PDF no Drive |
| `ano` | Ano de publicação |
| `doi` | *(opcional)* DOI do trabalho, ex.: `10.1234/abcd.001` |

Veja o exemplo em [`data/exemplo.csv`](data/exemplo.csv).

**PDFs:** no Drive, cada PDF (ou a pasta inteira) precisa estar em *Compartilhar → Qualquer pessoa com o link → Leitor*. Cole o link na coluna `link_pdf`; o site gera sozinho os botões "Ver PDF" e "Baixar PDF".

**Publicar a planilha:** no Google Sheets, *Arquivo → Compartilhar → Publicar na web*, escolha a aba e o formato **CSV**, e copie o link gerado.

## 2. Ligar a planilha ao site

Escolha uma das opções:

- **Pelo GitHub (recomendado):** em *Settings → Secrets and variables → Actions → Variables*, crie a variável `PLANILHA_CSV_URL` com o link do CSV.
- **Pelo arquivo:** cole o link em `planilha_csv_url` no `config.json`.

Enquanto não houver link, o site usa os 5 trabalhos fictícios de `data/exemplo.csv`.

## 3. Dados do evento, banner e cores

Tudo fica em [`config.json`](config.json), dividido em 4 blocos: **dados do evento**, **visual**, **planilha** e **opcional**. Campos entre `[colchetes]` são provisórios: ao rodar `npm run build` (ou no log do GitHub Actions) aparece a lista do que ainda falta preencher.

- `nome_evento`, `subtitulo`, `apresentacao`: texto em `pt`, `en` e `es` (se deixar só `pt`, ele é usado nos três idiomas).
- `sigla`, `edicao`, `issn`, `cidade`, `editora`: aparecem no topo, na home e no "Como citar".
- `doi_prefixo`: *(opcional)* se os DOIs seguem o padrão prefixo + id, preencha ex.: `10.1234/evento.` e deixe a coluna `doi` vazia. Só use depois que os DOIs estiverem registrados.
- `logo`, `banner`, `favicon`: coloque as imagens na pasta `public/` (crie se não existir) e escreva o nome aqui, ex.: `"banner": "banner.jpg"`. Banner sugerido: 1920×600 px. Sem banner, a home usa um degradê com as cores do evento.
- `cores`: `primaria` (títulos e botões), `secundaria` (destaques), `fundo` e `texto`, em hexadecimal.
- `site_url`: endereço final do site (usado nos links de citação e no sitemap).
- `itens_por_pagina`: trabalhos por página na lista.

Os textos da interface estão em `i18n/pt.json`, `i18n/en.json` e `i18n/es.json`.

## 4. Publicar no GitHub Pages

1. Em *Settings → Pages*, em **Source**, escolha **GitHub Actions** (uma vez só).
2. Pronto: a cada alteração na branch `main` o site é refeito e publicado.
3. Para atualizar depois de mexer na planilha: *Actions → Publicar site → Run workflow*. O site também se atualiza sozinho todo dia às 6h.

Endereço: `https://zzebbb.github.io/redes/`.

## Rodar no computador (opcional)

Precisa do Node.js 20 ou mais novo.

```bash
npm install
npm run sync     # baixa a planilha (ou usa o exemplo) e gera data/*.json
npm run dev      # gera o site em dist/ e abre em http://localhost:4321
npm test         # testes das funções de leitura da planilha e citação
```

## Como funciona

- `scripts/sync.mjs` lê o CSV, confere colunas obrigatórias, avisa sobre ids repetidos e PDFs faltando, converte os links do Drive e gera `data/trabalhos.json` e `data/autores.json`.
- `scripts/build.mjs` gera páginas HTML estáticas em `dist/` (uma por trabalho, com meta tags para Google Acadêmico: `citation_title`, `citation_author`, `citation_pdf_url` etc.), além de `sitemap.xml`.
- `src/assets/app.js` cuida da busca (Fuse.js, tolerante a erros de digitação e acentos), filtros, troca de idioma e botão de copiar a citação.
