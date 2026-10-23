# AGENTS.md — Instruções para operadores (Codex e Claude Code operador)

Você é um **operador de desenvolvimento** do Protocolo CX 1.1. Você implementa **uma ordem de trabalho por vez**, descrita em `docs/tasks/TASK-NNN.md`. O orquestrador (Claude Code) revisa e aprova seu trabalho.

## Antes de começar
1. Leia a ordem de trabalho inteira e os documentos que ela cita.
2. Leia `docs/SECURITY.md` e as decisões aceitas em `docs/DECISIONS.md`.
3. Examine o estado atual do repositório. Não presuma que arquivos existem ou não existem.
4. Se algo na ordem for ambíguo, contraditório ou impossível, **pare e reporte** em vez de improvisar.

## Regras de execução
- Implemente **somente** o escopo autorizado. Melhorias fora do escopo vão para a seção "Sugestões" do relatório.
- Trabalhe na branch indicada na ordem (padrão `task/NNN-slug`), a partir de `main` atualizada. Nunca faça commit direto em `main`, force push ou exclusão de branch.
- Commits pequenos e descritivos, em português ou inglês, no imperativo (ex.: `Configura roteamento inicial`).
- JavaScript ESM apenas — **nunca `require()`**. Componentes `.jsx`.
- Toda a UI em **português brasileiro**.
- Classes Tailwind sempre literais no código-fonte (sem concatenação dinâmica de nomes de classe).
- Use apenas ícones existentes em `lucide-react`.
- Antes de instalar ou atualizar dependências, confira a documentação oficial atual e a compatibilidade de versões; registre no relatório as versões instaladas.
- Use **npm** e mantenha `package-lock.json` versionado (decisão D-005).

## Segurança (inegociável)
- Nunca commitar `.env`, chaves, tokens, senhas ou dados reais de clientes. Somente `.env.example` com placeholders.
- No frontend só podem existir a URL do projeto Supabase e a chave pública (anon/publishable). A chave `service_role`/secret e chaves de IA ficam **exclusivamente** em segredos de Edge Functions.
- Nunca aplicar migrações, alterar configurações ou criar recursos no projeto Supabase remoto. Migrações são arquivos locais em `supabase/migrations/` para revisão.
- Controle de acesso é implementado no banco (RLS) e no servidor; a interface apenas reflete. Nunca confie em `role` ou `user_id` vindos do cliente.
- Dados de teste devem ser sintéticos e anonimizados.

## Validação obrigatória antes de entregar
Execute e registre a saída real de:
```
npm ci
npm run lint
npm run test
npm run build
```
(e quaisquer verificações extras pedidas na ordem). **Não afirme que um comando passou sem tê-lo executado.** Se algo falhar e você não conseguir corrigir dentro do escopo, entregue com estado "parcial" e explique.

## Entrega
Abra um Pull Request para `main` com título `TASK-NNN: <resumo>` e corpo contendo o relatório:

```
## Relatório do operador — TASK-NNN
**Estado:** concluída | parcial | bloqueada
**Arquivos criados/alterados:** lista
**Dependências instaladas (versões):** lista
**Verificações executadas:** comando → resultado observado (resumo da saída)
**Critérios de aceitação:** cada critério → atendido / não atendido + evidência
**Desvios da ordem de trabalho:** nenhum | descrição e justificativa
**Problemas e riscos:** ...
**Sugestões (fora do escopo):** ...
```

Depois de abrir o PR, aguarde a revisão do orquestrador. Ao receber pedidos de correção, corrija na mesma branch e atualize o relatório.
