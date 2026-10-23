# Especificação — Provedor de IA plugável (D-009)

> Status: **aceito no conceito**; provedor inicial ainda não escolhido.

## 1. Objetivo
O modelo usado é determinado pela API conectada. Uma tela de configuração permite trocar provedor e modelo sem mudar código; modelos locais ficam para bem depois.

## 2. Tela "Configurações → Inteligência artificial"
| Campo | Observação |
|---|---|
| Provedor | lista: "Compatível com OpenAI" (genérico), mais adaptadores nativos conforme a escolha do provedor |
| URL base (endpoint) | preenchida pelo provedor; editável no genérico |
| Modelo | texto livre, com sugestão via `GET /models` quando o provedor suportar |
| Chave da API | **somente escrita**; após salvar, mostra só `••••1234`; botão "Substituir chave" |
| Suporte a imagens (visão) | detectado ou declarado; habilita a extração de prints e PDF |
| Botão "Testar conexão" | Edge Function faz uma chamada mínima e valida a saída JSON estruturada |

Acesso: supervisor da organização e admin da plataforma ❓. Sem configuração ativa, a análise fica indisponível com a mensagem "Configure a chave de IA da organização em Configurações".

## 3. Armazenamento e execução
- `ai_provider_configs(organization_id, provider, base_url, model, supports_vision, secret_ref, is_active, updated_by, updated_at)`.
- A chave vai para o **Supabase Vault** (`secret_ref`); nunca volta ao navegador (SEC-19).
- As Edge Functions leem a configuração ativa da organização do usuário, resolvem o segredo e chamam o adaptador.
- `analysis_runs` registra `provider`, `model` e `prompt_version`, garantindo rastreabilidade.
- Registro de consumo (tokens/chamadas por organização) para controle de custo.

## 4. Modelos locais (futuro)
Um servidor local (ex.: compatível com OpenAI rodando no computador do analista) **não é alcançável** pelas Edge Functions na nuvem. Opções futuras: endpoint exposto pela empresa com TLS e autenticação, ou execução local via extensão/agente desktop. Fica fora do escopo até nova decisão.

## 5. Perguntas abertas
1. ✅ **Por organização** (decidido em 2026-10-23): cada empresa informa a própria chave.
2. ✅ Modelos locais: **stand-by**.
3. ❓ Quem configura na organização: só o supervisor? (proposta: sim, mais o admin da plataforma para suporte)
