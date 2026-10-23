# Especificação — Validação e curadoria (D-011)

> Status: **rascunho aceito no conceito**; itens marcados ❓ aguardam confirmação do responsável.
> Substitui o modelo original em que nada da IA chegava ao analista antes da aprovação do supervisor.

## 1. Regras
| # | Regra | Origem |
|---|---|---|
| V1 | O analista vê o resultado da IA (6 competências, diagnóstico e oportunidades) das **próprias** avaliações assim que a análise termina | responsável |
| V2 | O analista valida o **diagnóstico** e **cada oportunidade**: `gostei` (sim/não), `útil` (sim/não) e comentário opcional | responsável |
| V3 | O supervisor vê tudo da organização, inclusive as validações dos analistas, e registra o próprio veredito nos mesmos alvos | responsável |
| V4 | **O veredito do supervisor prevalece.** Veredito efetivo = supervisor, se existir; senão, analista; senão, "sem validação" | responsável |
| V5 | "Meu desenvolvimento" mostra só itens com veredito efetivo **positivo** | responsável (interpretação ❓) |
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
| `adjusted_recommendation` | text null | só supervisor ❓ |
| `created_at`, `updated_at` | timestamptz | |

Único: `(analysis_run_id, target_type, opportunity_id, author_role)`, com um veredito vigente por papel. A view `effective_feedback` calcula V4.

## 3. Estados exibidos ❓
Proposta: manter os rótulos originais. `analisado` = "Em curadoria", até o supervisor dar veredito no diagnóstico; aí vira `curado` = "Curadoria concluída". A validação do analista não muda o status. A fila de Curadoria prioriza avaliações cujo analista marcou algo como "não útil".

## 4. Perguntas abertas
1. ❓ O que é "retorno positivo" (V5): `útil = sim`? `gostei = sim` **e** `útil = sim`?
2. ❓ V5: item **sem** veredito do supervisor, mas positivo pelo analista, aparece em "Meu desenvolvimento"? A proposta é **sim**.
3. ❓ O supervisor ainda pode **ajustar** a recomendação de uma oportunidade (texto alternativo exibido ao analista), como no original?
4. ❓ O analista vê o veredito e o comentário do supervisor quando são contrários aos dele?
