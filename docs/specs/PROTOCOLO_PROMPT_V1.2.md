# Especificação — Protocolo CX V1.2: comunicação nas oportunidades (D-019)

> Status: **requisito aceito; texto do prompt aguarda aprovação do responsável.**
> O `PROTOCOL_PROMPT V1.1` permanece verbatim e versionado como linha de base de paridade (A-01). A V1.2 **acrescenta** uma seção sem remover nenhuma regra da V1.1.

## 1. Requisito do responsável
> "O bloco de Oportunidade de melhoria após análise de IA deve utilizar comunicação clara e efetiva, incluir técnicas de comunicação assertiva e rapport."

## 2. Seção acrescentada ao prompt (proposta)
Inserida após o bloco "OPORTUNIDADES DE MELHORIA" da V1.1:

```
COMUNICAÇÃO NAS OPORTUNIDADES DE MELHORIA — redija "recommendation" e "improved_example" com comunicação clara e efetiva: frases curtas, linguagem simples, voz ativa, sem jargão desnecessário e com um objetivo por recomendação.
Aplique técnicas de comunicação assertiva: expor fatos e próximos passos com clareza e respeito, sem agressividade nem passividade; assumir a responsabilidade pelo encaminhamento; oferecer alternativas quando não for possível atender ao pedido; evitar promessas vagas.
Aplique técnicas de rapport: chamar o cliente pelo nome quando ele aparecer na conversa; reconhecer o sentimento e o contexto do cliente; validar a preocupação antes de orientar; acompanhar o vocabulário e o nível de formalidade do cliente; confirmar o entendimento e demonstrar disponibilidade.
O "improved_example" deve ser uma mensagem pronta para uso, coerente com a conversa e concisa o bastante para o contexto de multiatendimento. Quando uma informação necessária não constar da conversa (prazo, protocolo, procedimento), use um marcador entre colchetes, como [prazo], em vez de inventá-la.
Em "communication_techniques", liste as técnicas aplicadas na recomendação.
A recomendação ao analista deve manter tom de desenvolvimento profissional: construtiva, específica e sem julgamento pessoal.
```

## 3. Mudança no schema de saída
Novo campo em cada oportunidade: `communication_techniques`, uma lista com valores de
`["Assertividade", "Rapport", "Escuta ativa", "Validação emocional", "Linguagem positiva", "Clareza e objetividade"]`
(vazia permitida; valores fora da lista são descartados na normalização).
Persistência: coluna `communication_techniques text[]` em `opportunities`. Exibição: badges no `OpportunityCard`.

## 4. Versionamento
- `protocol_versions`: nova entrada **V1.2** ("Comunicação assertiva e rapport nas oportunidades").
- `analysis_runs.prompt_version` registra V1.1 ou V1.2. Testes de hash para as duas versões.
- Versão ativa padrão nas novas análises: **V1.2** ❓ (confirmar).

## 5. Perguntas abertas
1. ❓ O texto da seção 2 está aprovado ou precisa de ajustes?
2. ❓ O mesmo padrão também vale para o `summary_feedback` (feedback consolidado ao analista), ou só para as oportunidades?
3. ❓ A lista de técnicas da seção 3 está adequada?
