# AGENTS.md — instruções para agentes de código

Bricklap: uma sessão de treino é uma sequência de desportos. START uma vez, CHANGE sem parar, STOP no fim. Eventos são a fonte de verdade; segmentos e métricas derivam-se.

## Papéis

- **O fundador** (também "o CEO") — decide. Produto, prioridades, legal, dinheiro, hardware. Nunca referido pelo nome em ficheiros do repositório.
- **O CTO** — o agente de CTO, no chat: revê o trabalho, levanta as dúvidas e escreve os briefs de cada sessão.
- **Tu (o agente de código)** — a equipa de desenvolvimento: executas o brief e reportas.

Na documentação, decisões e aprovações são "do fundador"; orientação de sessão, revisão e dúvidas são "para o CTO".

## Ler primeiro

**Nenhuma sessão começa sem ler os ficheiros do nível A.** É a primeira coisa a fazer, antes de qualquer trabalho, e o relatório da sessão **abre com uma secção "Estado lido"** a resumir em cinco linhas onde o projeto está segundo esses ficheiros — e a dizer **que ficheiros dos níveis B e C se leram, e porquê**. Se o que lá está contradisser o brief, **parar e perguntar ao CTO** em vez de decidir.

Ler tudo em todas as sessões não é realista; não saber que um ficheiro existe também não é aceitável. Por isso há três níveis, e **esta lista é o índice**: quem leu este ficheiro já sabe que todos existem e para que servem.

**A — Todas as sessões, por esta ordem:**

1. `STATUS.md` — onde o projeto está: fase atual, estado de cada pacote, limitações conhecidas, ambiente.
2. `ROADMAP.md` — as fases, com a **numeração canónica**; as decisões do fundador em cada fase; o que vem a seguir; o critério de continuar ou parar.
3. `docs/VISAO.md` — a tese do produto e as três frases fixas.
4. O relatório mais recente em `docs/reports/` e `git log --oneline | head -30` — o que se fez por último e o que ficou em aberto.

**B — Na primeira sessão de um agente neste repositório** (outra ferramenta, outro modelo, ou um agente sem registo de os ter lido — na dúvida, é a primeira), **e depois sempre que a sessão tocar no tema:**

5. `docs/CTO.md` — como o CTO trabalha, os factos fixos do projeto, e o que ler se mudares de agente. **Obrigatório** em qualquer sessão que mude a forma de trabalhar.
6. `LEGAL.md` — requisitos e restrições legais: dados de saúde (RGPD, art. 9.º), localização e zonas de privacidade, alegações médicas, lojas, monetização. **Obrigatório** em qualquer sessão que toque em dados pessoais, localização, dados de treino ou de saúde, partilha, exportação, contas, texto visível ao atleta, lojas ou receita. Não são os textos legais do lab (esses estão em `apps/web-lab/` e não se alteram — ver "Nunca").
7. `docs/NEGOCIO.md` — as três etapas do negócio, a receita, a diferenciação, o social. **Obrigatório** em qualquer sessão que decida âmbito ou produto.
8. `docs/AMBIENTE.md` — as máquinas, o telemóvel, o relógio, o build local, e o que se pede e não se pede ao fundador. **Obrigatório** em qualquer sessão que faça build, instale no telemóvel, use o Blender, ou precise de alguma coisa do fundador.
9. `docs/adr/0006-persistencia-sqlite-append-only.md` — **porque é que tudo é eventos e append-only**: um só registo de verdade, nada derivado guardado, uma escrita interrompida não corrompe o que já estava. **Obrigatório** em qualquer sessão que mexa no motor, na persistência ou no modelo de dados.

**C — Consulta, quando o trabalho o pedir:**

10. `README.md` — o mapa do repositório, requisitos e scripts.
11. `ARCHITECTURE.md` — modelo de dados, invariantes do motor, fronteiras entre pacotes. **Obrigatório** antes de mudar o motor ou a fronteira entre pacotes.
12. `packages/engine/src/index.ts` — a API do motor. **Obrigatório** antes de tocar no motor ou no código de uma app que o use.
13. Os outros ADR em `docs/adr/` — o do tema, antes de o contrariar; e `docs/BACKLOG.md`, antes de acrescentar uma ideia.

## Layout

- `packages/engine` — motor puro (`src/`), testes (`test/`).
- `apps/web-lab` — lab web (Vite SPA). Páginas legais em `src/routes/legal.*.tsx`, `src/lib/legal/`, `LEGAL.md`.
- `apps/mobile` — app Android (Expo, dev client).
- `docs/adr`, `docs/BACKLOG.md`, `docs/HISTORY.md`, `docs/reports/`.

## Comandos

```bash
npx -y npm@11 install      # npm 10 falha neste repo (bug do arborist)
npm test                   # motor (vitest)
npm run test:coverage
npm run typecheck          # todos os workspaces
npm run dev:web            # lab em http://localhost:8080
npm run build:web
npm run dev:mobile         # Metro para dev client
npm run export:android -w @bricklap/mobile   # prova Metro/monorepo sem SDK Android
```

Node 24 LTS (`.nvmrc`). Não alterar versões de Node/npm da máquina sem pedir.

## Convenções

- TypeScript `strict` + `noUncheckedIndexedAccess` em todo o lado. Uma só versão de TypeScript, React e `@types/react` no workspace.
- **O motor fica puro**: sem DOM, React, React Native, zustand, `localStorage`, `AsyncStorage`, `fetch`. Tempo (`at`) e aleatoriedade (`rng`) entram por parâmetro. Adaptadores (persistência, GPS, relógio) vivem nas apps.
- **Eventos são a verdade**: nunca guardar segmentos ou métricas; derivar sempre com `segmentsFromEvents` e afins.
- Identificadores em inglês no código; documentação, mensagens de commit descritivas e cópia da app Android em **pt-PT** (não pt-BR: ficheiro, utilizador, equipa, ecrã). A cópia do lab web mantém-se em inglês como está.
- Commits pequenos, no imperativo, com corpo a explicar o porquê, terminados com uma linha `Co-Authored-By:` que identifica **o modelo que fez o trabalho** — o nome do modelo e o endereço que o fornecedor indica para essa linha. O rasto regista quem fez cada commit, não um nome fixo (decisão do CTO, sessão 19b). Se a ferramenta propuser uma linha de atribuição própria, usa-se essa, desde que nomeie o modelo real. Branches: `chore/`, `feat/`, `fix/`, `docs/`.
- Nova dependência só com uma linha no relatório da sessão a justificar. Instalar sempre a partir da raiz.
- `apps/mobile/android` e `ios` são gerados (`expo prebuild`) e ignorados pelo git.
- `apps/web-lab/src/routeTree.gen.ts` é gerado pelo router plugin e **fica** no repo.

## Definition of Done

Uma tarefa só está feita quando:

1. `npm test` verde, com cobertura do motor a 100% mantida.
2. `npm run typecheck` verde em todos os workspaces.
3. `npm run build:web` verde.
4. `npm run export:android -w @bricklap/mobile` verde (Metro resolve o monorepo).
5. `STATUS.md` atualizado e relatório da sessão em `docs/reports/AAAA-MM-DD-sessao-NN.md`, **a abrir com "Estado lido"** e depois feito, por fazer, decisões, dúvidas para o CTO, próximos passos.
5b. **`ROADMAP.md` reflete as decisões tomadas na sessão.** Nenhuma sessão termina com uma decisão do fundador só no relatório: o roadmap é o que a sessão seguinte lê.
5c. **Exceção: branches de exploração.** Num branch de exploração — sem código de produto e que não se funde em `main` (como foi `feat/marca-blender` nas sessões 18 a 19b, antes de a sessão 21 a fundir) — o `STATUS.md` e o `ROADMAP.md` não são obrigatórios. Quando o brief o autoriza, atualiza-se só a linha dessa exploração, e mais nada. Decisão do CTO, sessão 19; não é preciso voltar a perguntar.
6. Nenhuma dependência nova sem justificação escrita.
7. Textos legais intocados (salvo pedido explícito do fundador).
8. **Branch de trabalho publicado no remoto** (`git push -u origin <branch>`), com o commit local confirmado igual ao remoto. Regra permanente: nenhuma sessão termina sem este push.

## Validação no telemóvel

- **O que o atleta vê só conta como validado quando o fundador o vê no telemóvel.** Em particular, **a notificação da gravação só está validada depois de o fundador a ver na barra de notificações** — título e corpo, completos e legíveis. `dumpsys` (serviço em primeiro plano, `foregroundNoti`, canal) prova que o sistema a tem, não que aparece: na sessão 07 deu-se por validada assim, e sem a permissão `POST_NOTIFICATIONS` nunca tinha aparecido (relatório da sessão 08). Nenhuma sessão dá a notificação por validada com `dumpsys` sozinho.

## Nunca

- Nunca alterar a redação dos textos legais (`apps/web-lab/LEGAL.md`, `src/lib/legal/`, `src/routes/legal.*.tsx`, `LICENSE`, `NOTICE`) sem pedido explícito do fundador. Só nome do produto, chave de armazenamento e caminhos de import.
- Nunca configurar iOS na Fase 1 (sem bloco `ios` em `app.json`, sem scripts iOS, sem Xcode).
- Nunca importar zustand, `localStorage`, `AsyncStorage`, DOM ou React Native em `packages/engine`.
- Nunca fazer commit de `apps/mobile/android`, `apps/mobile/ios`, `dist/`, `coverage/`, `.expo/`.
- Nunca correr `npm install` com npm 10 neste repositório; usar npm 11.
- Nunca fazer push para `main`, nunca `push --force`, nunca reescrever histórico já publicado.
- Nunca apagar ou reescrever relatórios em `docs/reports/`.
- Nunca guardar segredos (tokens EAS, keystores) no repositório.
- **Nunca escrever dados pessoais identificáveis do fundador em ficheiros do repositório** (nome próprio, apelidos, morada, telefone, NIF, email pessoal, entidade empregadora). Em relatórios, documentação, comentários e mensagens de commit, referir sempre **"o fundador"** ou **"o CEO"** — nunca por nome. O campo de responsável pelo tratamento nos textos legais (`controllerName`, `address`, `nif`, `email` em `apps/web-lab/src/lib/legal/config.ts`) fica **por preencher** até haver decisão explícita do fundador.
- Nunca mudar `android.package`, o nome da app ou a slug sem decisão do fundador.
- Nunca guardar segmentos/métricas derivados como estado persistido.

## Dúvidas para o CTO

Não bloquear: registar em "Dúvidas para o CTO" no relatório da sessão, tomar a decisão reversível mais simples, e escrever o porquê.
