# Especificação — Extensão de captura de atendimentos (D-018)

> Status: **escopo aceito**; especificação depende das respostas da §6. Produto separado em `extension/`.

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
- **Plataforma:** extensão Manifest V3 para navegadores Chromium (Chrome/Edge), com painel lateral (side panel) para a interface.
- **Captura:** *content script* com um **adaptador por plataforma de chat**: seletores de mensagens, autor (Atendente/Cliente), horário e detecção de "atendimento finalizado". Regex configurável para extrair o ticket da URL.
- **Multiatendimento:** captura simultânea de vários tickets (4+ conversas), um arquivo por ticket.
- **Formato do `.txt`:** cabeçalho (ticket, canal, analista, início/fim) e linhas `Atendente: ...` / `Cliente: ...`, mesmo formato usado pela IA. Cada gravação reescreve o arquivo com a transcrição completa até o momento, evitando mensagens duplicadas.
- **Pasta local:** File System Access API (`showDirectoryPicker`) com o identificador persistido. O navegador pode pedir reautorização após reiniciar; a interface mostra "Reautorizar pasta". Alternativa: subpasta de Downloads via `chrome.downloads`.
- **Envio ao sistema:** autenticação na conta do Protocolo CX; chama uma Edge Function que cria ou atualiza a avaliação pelo ticket e, no "Analisar ao vivo", dispara a análise e mostra o link do resultado. A extensão **nunca** guarda chave de IA (SEC-20).
- **Privacidade:** os arquivos contêm dados pessoais de clientes; aviso LGPD e política de retenção (SEC-21).

## 4. Estados da interface
Sem pasta → Aguardando atendimento → Capturando (ticket N, X mensagens) → Atendimento finalizado → Salvo (e enviado, se aplicável) · Erro (pasta sem permissão, ticket não identificado, falha de envio).

## 5. Dependências
Fase 2 (auth + organizações), Fase 3 (motor de IA) e a Edge Function de ingestão. Trilha própria após a Fase 4.

## 6. Perguntas abertas
1. ❓ Em qual(is) plataforma(s) de atendimento a extensão vai rodar (nome do sistema) e qual é o formato da URL com o número do ticket (um exemplo sem dados reais)?
2. ❓ Como se detecta que o atendimento foi finalizado nessa plataforma (botão "encerrar", mudança de status, fechamento da aba)?
3. ❓ O salvamento automático também envia a transcrição ao sistema, ou só grava o `.txt`, que depois é importado na plataforma?
4. ❓ "Analisar ao vivo" cria a avaliação no sistema e já mostra o resultado na extensão, ou só no site?
5. ❓ Navegador: só Chrome/Edge é suficiente?
6. ❓ Referência "Neeko": o que exatamente se quer copiar dela (visual, painel lateral, comportamento)?
