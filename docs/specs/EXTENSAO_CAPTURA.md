# Especificação — Extensão de captura de atendimentos (D-018)

> Status: **escopo aceito** (respostas de 2026-10-23); detecção de fim de atendimento em stand-by. Produto separado em `extension/`.

## 1. Objetivo
Capturar a transcrição dos atendimentos no navegador do analista, salvá-la em `.txt` numa pasta do computador dele e alimentar o Protocolo CX usando o **número do atendimento/ticket extraído da URL** como chave (= `protocol`, único por organização, D-012).

## 2. Comportamento pedido
| # | Requisito |
|---|---|
| E1 | Botão **Selecionar pasta** onde os `.txt` serão gravados |
| E2 | Caixa de status mostrando "Aguardando o atendimento ser finalizado para salvar" |
| E3 | **Salvamento automático** do `.txt` ao fim do atendimento, sem clique |
| E4 | Botão explícito **Analisar ao vivo**: captura até a última mensagem enviada, grava no mesmo `.txt` e envia para análise |
| E5 | Número do atendimento/ticket lido da URL identifica o arquivo e o registro no sistema |
| E6 | Funcionamento semelhante à extensão Neeko (referência do responsável) |

## 3. Desenho técnico proposto
- **Plataforma de atendimento:** **ClickDesk**, com captura por *scraping* leve do DOM da página (somente leitura, sem automação de cliques nem chamadas a APIs internas).
- **Navegadores:** Chromium com Manifest V3: Chrome, Edge, **Brave** e **Opera**. O Opera não suporta `sidePanel`, então a interface deve funcionar também como popup; testar a File System Access API em cada um.
- **Referência Neeko:** reproduzir a captura de dados e o salvamento automático.
- **Captura:** *content script* com um **adaptador por plataforma de chat**: seletores de mensagens, autor (Atendente/Cliente), horário e detecção de "atendimento finalizado". Regex configurável para extrair o ticket da URL.
- **Multiatendimento:** captura simultânea de vários tickets (4+ conversas), um arquivo por ticket.
- **Formato do `.txt`:** cabeçalho (ticket, canal, analista, início/fim) e linhas `Atendente: ...` / `Cliente: ...`, mesmo formato usado pela IA. Cada gravação reescreve o arquivo com a transcrição completa até o momento, evitando mensagens duplicadas.
- **Pasta local:** File System Access API (`showDirectoryPicker`) com o identificador persistido. O navegador pode pedir reautorização após reiniciar; a interface mostra "Reautorizar pasta". Alternativa: subpasta de Downloads via `chrome.downloads`.
- **Salvamento automático:** **somente grava o `.txt`** localmente; a ingestão é feita depois, pela importação de `.txt` na plataforma (nova função N-13: importar um ou vários `.txt`, usando o número do ticket do nome/cabeçalho como protocolo).
- **Detecção de fim de atendimento:** *stand-by*. Até lá, regravação do `.txt` a cada nova mensagem (com debounce) e ao trocar de ticket ou fechar a aba.
- **Analisar ao vivo:** autenticação na conta do Protocolo CX; envia a transcrição até a última mensagem a uma Edge Function, que cria ou atualiza a avaliação pelo ticket e dispara a análise. **O resultado aparece só no site**; a extensão mostra um link. A extensão **nunca** guarda chave de IA (SEC-20).
- **Privacidade:** os arquivos contêm dados pessoais de clientes; aviso LGPD e política de retenção (SEC-21).

## 4. Estados da interface
Sem pasta → Aguardando atendimento → Capturando (ticket N, X mensagens) → Atendimento finalizado → Salvo (e enviado, se aplicável) · Erro (pasta sem permissão, ticket não identificado, falha de envio).

## 5. Dependências
Fase 2 (auth + organizações), Fase 3 (motor de IA) e a Edge Function de ingestão. Trilha própria após a Fase 4.

## 6. Perguntas abertas
1. ✅ ClickDesk, com scraping leve. ❓ Ainda falta um **exemplo de URL** com o número do ticket (sem dados reais) e acesso a uma conta de teste/página exemplo para mapear o DOM.
2. ⏸️ Detecção de fim de atendimento: stand-by.
3. ✅ Só grava o `.txt`, para importar depois.
4. ✅ A princípio, resultado só no site.
5. ✅ Chrome, Edge, Brave e Opera.
6. ✅ Neeko: captura de dados e salvamento automático.
7. ⚠️ Verificar os termos de uso do ClickDesk quanto a extensões e coleta de dados da página (risco contratual, não técnico).
