# Plano: Repositório de Trabalhos (anais) — repo zZebbb/redes

Crie um site estático de anais/repositório de trabalhos acadêmicos, publicado no GitHub Pages, inspirado em https://proceedings.science/org/abrasco/papers. Deve ser atrativo, simples, objetivo e funcional, e ótimo no celular.

## Dados
- Fonte: planilha Google Sheets no Drive (publicada na web como CSV; URL em `config.json`). Uma linha por trabalho.
- Colunas: `id, titulo, autores (separados por ;), eixo, modalidade, palavras_chave, resumo_pt, resumo_en, resumo_es, link_pdf (Drive), ano`.
- Script Node `npm run sync` baixa o CSV e gera `data/trabalhos.json` e `data/autores.json`; converte links do Drive em links de visualização e de download direto.
- ~50 trabalhos. Eixos e modalidades vêm da própria planilha (nada fixo no código).
- PDFs são públicos para baixar.

## Páginas
1. **Início:** banner (imagem configurável), nome do evento, ISSN, busca em destaque, contadores (trabalhos, autores, eixos), atalhos para os eixos.
2. **Trabalhos:** cards com título, autores, eixo e modalidade; busca instantânea (Fuse.js) por título, autor, palavra-chave e resumo; filtros por eixo e modalidade; paginação.
3. **Trabalho:** título, autores clicáveis, ID, modalidade, eixo, resumo em abas PT/EN/ES, palavras-chave, botões "Ver PDF" e "Baixar PDF", e "Como citar" (ABNT, copiar com 1 clique, com ISSN/DOI quando houver).
4. **Autores:** lista A–Z com busca; cada autor mostra seus trabalhos.

## Idiomas
- Interface em PT, EN e ES com seletor no topo (arquivos i18n). Resumo no idioma escolhido, com fallback para PT.

## Técnico
- Astro (saída estática) ou HTML/JS puro; sem servidor nem banco.
- `config.json`: nome do evento, ISSN, DOI-prefixo (opcional), cores, logo, banner, URL do CSV.
- GitHub Action: roda o sync e publica no GitHub Pages (manual e diariamente).
- Acessibilidade básica, SEO (meta tags por trabalho), carregamento rápido.
- README em português explicando como atualizar a planilha, trocar banner/cores e publicar.

## Primeira entrega
- Planilha CSV de exemplo com 5 trabalhos fictícios em `data/exemplo.csv`, para o site funcionar antes da planilha real.
- Pendências a perguntar ao usuário: nome do evento, logo, cores, ISSN.
