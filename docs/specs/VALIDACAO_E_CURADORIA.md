# Especificação — Validação e curadoria (D-011)

> Status: **aceito** (respostas de 2026-10-23); um ponto ⚠️ precisa de esclarecimento.
> Substitui o modelo original em que nada da IA chegava ao analista antes da aprovação do supervisor.

## 1. Regras
| # | Regra | Origem |
|---|---|---|
| V1 | O analista vê o resultado da IA (6 competências, diagnóstico e oportunidades) das **próprias** avaliações assim que a análise termina | responsável |
| V2 | O analista valida o **diagnóstico** e **cada oportunidade**: `gostei` (sim/não), `útil` (sim/não) e comentário opcional | responsável |
| V3 | O supervisor vê tudo da organização, inclusive as validações dos analistas, e registra o próprio veredito nos mesmos alvos | responsável |
| V4 | **O veredito do supervisor prevalece.** Veredito efetivo = supervisor, se existir; senão, analista; senão, "sem validação" | responsável |
| V5 | "Meu desenvolvimento" mostra só itens com veredito efetivo **positivo**, inclusive os positivos pelo analista ainda sem veredito do supervisor (para alinhamento) | responsável |
| V6 | Taxa de utilidade da IA nos indicadores; o analista vê só a das próprias avaliações, o supervisor vê a da organização e por analista | responsável |
| V7 | O analista pode mudar a própria validação; nunca a do supervisor nem a de outro analista | segurança |
| V8 | Toda gravação de veredito do supervisor gera `curation_logs` (imutável) | original + SEC-08 |
| V9 | Reanálise cria nova execução; validações ficam ligadas à execução em que foram dadas (D-016) | D-016 |

## 2. Modelo de dados proposto
`analysis_feedback`
| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `organization_id` | uuid | RLS |
| `evaluation_id`, `analysis_run_id` | uuid | |
| `target_type` | `diagnostico` \| `oportunidade` | |
| `opportunity_id` | uuid null | obrigatório quando `oportunidade` |
| `author_id` | uuid | de `auth.uid()`, nunca do cliente |
| `author_role` | `analista` \| `supervisor` | de `memberships`, nunca do cliente |
| `liked`, `useful` | boolean | |
| `comment` | text | |
| `adjusted_recommendation` | text null | só supervisor, **opcional**: por padrão vale o texto da IA |
| `created_at`, `updated_at` | timestamptz | |

Único: `(analysis_run_id, target_type, opportunity_id, author_role)`, com um veredito vigente por papel. A view `effective_feedback` calcula V4.

> **Regra confirmada (D-024, 2026-10-23):** a validação do analista vale por padrão. A revisão do supervisor é opcional e, quando existe, sobrepõe a do analista.
>
> **Refinamento (D-024):** a coluna `adjusted_recommendation` fica em `opportunities`, não aqui. O veredito do supervisor é a decisão de curadoria (`opportunities.status`, `evaluations.diagnosis_status`). As linhas de supervisor em `analysis_feedback` são opcionais e servem só à taxa de utilidade.

## 3. Estados exibidos (proposta do orquestrador)
Proposta: manter os rótulos originais. `analisado` = "Em curadoria", até o supervisor dar veredito no diagnóstico; aí vira `curado` = "Curadoria concluída". A validação do analista não muda o status. A fila de Curadoria prioriza avaliações cujo analista marcou algo como "não útil".

## 4. Perguntas abertas
1. ⚠️ "Retorno positivo": a resposta foi "sim" a uma pergunta com duas opções. **Interpretação adotada até confirmação: `gostei = sim` E `útil = sim`.**
2. ✅ Sim: item positivo pelo analista sem veredito do supervisor aparece, inclusive para alinhamento.
3. ✅ Sim, o supervisor pode ajustar a recomendação, mas o padrão é o texto da IA; o ajuste é opcional.
4. ✅ Sim, o analista vê o veredito e o comentário do supervisor.
