# Anais do evento — site com busca

Site estático dos anais: lista de trabalhos com busca instantânea, filtros por eixo e modalidade, página de cada trabalho (resumo em PT/EN/ES, PDF para ver e baixar, "Como citar" em ABNT) e lista de autores. Interface em português, inglês e espanhol.

Os dados vêm de uma planilha do Google Sheets e os PDFs ficam no Google Drive. O site é gerado automaticamente e publicado no GitHub Pages, sem servidor e sem banco de dados.

> O plano original está em [`docs/PLANO.md`](docs/PLANO.md).

## 1. A planilha

O site lê a aba **Trabalhos** da planilha da Rede Brasil (só as colunas azuis). Colunas reconhecidas, com qualquer acentuação:

| Coluna | Uso no site |
|---|---|
| `Status` | Se existir, só entram as linhas com **Aprovado** |
| `Nº público` | Número do trabalho e endereço da página: `/trabalho/001/` |
| `Eixo temático`, `Categoria` | Filtros e etiquetas (o site monta a lista a partir do que estiver aqui) |
| `Título (PT)`, `Título (EN)`, `Título (ES)` | Título no idioma escolhido (sem tradução, mostra o PT) |
| `Autores (como citar)` | Nomes no "Como citar" (ABNT), separados por `;` |
| `Autores e instituições` | `Nome (Instituição); Nome (Instituição)` → autores e afiliações numeradas |
| `Resumo (PT/EN/ES)`, `Palavras-chave (PT/EN/ES)` | Abas do resumo; palavras-chave separadas por `;` |
| `Link do PDF` *(opcional)* | Link do banner no Drive. Sem essa coluna, o site usa `data/pdfs.csv` |
| `DOI` *(opcional)* | DOI do trabalho |

As colunas cinza (`RB (interno)`, `Observações (interno)`) são ignoradas e nunca aparecem no site.

Enquanto a planilha não estiver publicada, o site usa `data/trabalhos.csv` (os 40 aprovados, só colunas públicas). O formato antigo de exemplo continua em `data/exemplo.csv`.

**PDFs:** o Drive é só a caixa de entrada. Cada PDF precisa estar lá como *Qualquer pessoa com o link → **Leitor*** (não "Editor"), com o link em `data/pdfs.csv` (`numero,link_pdf`) ou numa coluna `Link do PDF` na planilha. Na publicação diária, o GitHub copia cada PDF novo para a pasta `pdfs/` do repositório (`npm run pdfs`) e o site passa a servir o arquivo de dentro dele: quem lê ou baixa não é levado ao Drive, e o arquivo continua no site mesmo que a pasta do Drive mude. Também dá para pular o Drive e enviar o arquivo direto para `pdfs/` no GitHub, com o nome do número público (`001.pdf`, `002.pdf`…).

## 2. Ligar a planilha ao site

Para não publicar as colunas internas, crie na planilha uma aba **Site** com esta fórmula na célula A1:

```
=QUERY(Trabalhos!A:R; "select C,D,E,F,G,H,I,J,L,M,N,O,P,Q,R where B = 'Aprovado'"; 1)
```

Depois, *Arquivo → Compartilhar → Publicar na web*, escolha **só a aba Site**, formato **CSV**, e copie o link. Coloque o link em *Settings → Secrets and variables → Actions → Variables* como `PLANILHA_CSV_URL` (ou em `planilha_csv_url` no `config.json`).

## 3. Dados do evento, banner e cores

Tudo fica em [`config.json`](config.json), dividido em 4 blocos: **dados do evento**, **visual**, **planilha** e **opcional**. Campos entre `[colchetes]` são provisórios: ao rodar `npm run build` (ou no log do GitHub Actions) aparece a lista do que ainda falta preencher.

- `nome_evento`, `subtitulo`, `apresentacao`: texto em `pt`, `en` e `es` (se deixar só `pt`, ele é usado nos três idiomas).
- `nome_citacao` e `numero_edicao`: como o evento aparece no "Como citar" (ex.: `In: ENCONTRO NACIONAL DA REDE BRASIL, 4., 2026, Brasília.`).
- `sigla`, `edicao`, `issn`, `cidade`, `editora`: aparecem no topo, na home e no "Como citar".
- `doi_prefixo`: *(opcional)* se os DOIs seguem o padrão prefixo + id, preencha ex.: `10.1234/evento.` e deixe a coluna `doi` vazia. Só use depois que os DOIs estiverem registrados.
- `logo`, `banner`, `favicon`: coloque as imagens na pasta `public/` (crie se não existir) e escreva o nome aqui, ex.: `"banner": "banner.jpg"`. Banner: **1920×600 px**. Ele fica atrás do logo, do nome e da busca, que vão no centro, então funciona melhor uma textura ou padrão do que uma imagem com texto; em telas largas o topo e a base podem ser cortados. Opcional: `banner_celular` com **1080×1200 px**. Sem banner, o site desenha um padrão de círculos com `banner_fundo` e `banner_pontos`.
- `cores`, em hexadecimal: `primaria` (barra do topo, abas, botões e links), `secundaria` (destaques: indicador das abas, idioma ativo, selo dos cards) e `texto_sobre_secundaria` (texto em cima dela), `banner_fundo`, `banner_pontos` e `banner_texto` (padrão de círculos do banner e cor do título), `fundo` (fundo da página), `texto` e `rodape` (fundo do rodapé; precisa ser escuro por causa do logo do ECoS). As cores atuais vêm da identidade visual da Rede Brasil: azul `#2E54A2`, amarelo `#F9B234`, azul-marinho `#172A55` e cinza `#5E595B`.
- `site_url`: endereço final do site (usado nos links de citação e no sitemap).
- `itens_por_pagina`: trabalhos por página na lista.
- `instagram` *(opcional)*: perfil que aparece no rodapé, sem o @ (ex.: `"ecos_unb"`). Deixe vazio para esconder.
- `logo_topo` e `logo_topo_alt` *(opcional)*: imagem em `public/` no canto superior esquerdo (hoje, a versão reduzida da marca Rede Brasil em branco, tirada do manual de identidade visual). Sem ela, aparece a `sigla` em texto.
- `logo_rodape` e `logo_rodape_alt` *(opcional)*: imagem em `public/` mostrada no rodapé (hoje, o logo do ECoS em branco e rosa, para fundo escuro) e a descrição dela para leitores de tela.
- `sugestoes_busca` *(opcional)*: lista de termos que aparecem como atalhos embaixo da busca do banner, por exemplo `["Desinformação", "Saúde bucal", "Doulas"]`. Sem ela, o site mostra as palavras-chave mais comuns.

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
- `scripts/baixar-pdfs.mjs` (`npm run pdfs`) copia do Drive para `pdfs/` os PDFs que ainda não estão lá; o build usa `pdfs/NNN.pdf` quando existe e o link do Drive quando não.
- `scripts/build.mjs` gera páginas HTML estáticas em `dist/` (uma por trabalho, com meta tags para Google Acadêmico: `citation_title`, `citation_author`, `citation_pdf_url` etc.), além de `sitemap.xml`.
- `src/assets/app.js` cuida da busca (Fuse.js, tolerante a erros de digitação e acentos), filtros, troca de idioma e botão de copiar a citação.
