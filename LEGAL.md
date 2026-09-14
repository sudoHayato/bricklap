# LEGAL.md — requisitos e restrições legais do Bricklap

**Isto não é parecer jurídico.** É o registo dos requisitos e das restrições que o projeto já sabe que tem, para nenhuma sessão os esquecer. Nada aqui foi validado por advogado; o que precisa dessa validação está marcado com **[validar com advogado]**. Decisões do fundador, escritas na sessão 22.

**Não confundir com os textos legais.** As páginas de privacidade, cookies, termos e direitos de autor do lab estão em [`apps/web-lab/LEGAL.md`](apps/web-lab/LEGAL.md), `apps/web-lab/src/lib/legal/` e `apps/web-lab/src/routes/legal.*.tsx`, e **a redação delas não se altera** sem pedido explícito do fundador (regra do [`AGENTS.md`](AGENTS.md)). Este ficheiro não substitui nem altera nenhum desses textos.

## Estado atual (sessão 22)

- A app grava **só no telemóvel do próprio atleta**: base SQLite local, sem contas, sem servidor, sem envio de dados para lado nenhum (ADR 0006).
- **O único utilizador é o fundador.** Não há utilizadores externos.
- A app **não lê frequência cardíaca** nem liga a sensores. Grava tempo, desporto e, nos desportos de rua, a posição GPS.
- A identidade do responsável pelo tratamento **está por preencher** (`apps/web-lab/src/lib/legal/config.ts`) e fica assim até decisão do fundador.

## Jurisdição

- **Portugal e União Europeia.** Não se aplica lei de outras jurisdições (por exemplo, a LGPD brasileira) sem decisão do fundador.
- **RGPD** — Regulamento (UE) 2016/679.
- **Lei n.º 58/2019** — execução do RGPD em Portugal.
- **CNPD** (Comissão Nacional de Proteção de Dados) — autoridade de controlo.

## Requisitos e restrições

### Dados de saúde — RGPD, artigo 9.º

- **Os dados de treino e o batimento cardíaco tratam-se como dados de saúde**, uma categoria especial de dados pessoais. É a posição do projeto, conservadora de propósito. **[validar com advogado]**: em que ponto os dados que a app grava hoje (tempo, desporto, percurso GPS), sem frequência cardíaca, passam a ser dados de saúde.
- **Exigem consentimento explícito e separado.** O consentimento para os dados de saúde é um pedido próprio, com texto próprio e ação própria do utilizador. **Nunca embrulhado nos termos de utilização** nem num "aceito tudo". **[validar com advogado]**: a redação e o momento do pedido.

### Registo e avaliação de impacto — RGPD, artigos 30.º e 35.º

- **Registo das atividades de tratamento (RoPA, artigo 30.º)** e **avaliação de impacto sobre a proteção de dados (DPIA, artigo 35.º)** têm de existir **antes de haver qualquer utilizador além do fundador** — ou seja, antes do primeiro utilizador externo da etapa 2 de [`docs/NEGOCIO.md`](docs/NEGOCIO.md). **[validar com advogado]**: o conteúdo de ambos e se a DPIA é obrigatória para o tratamento concreto.

### Lojas de aplicações — estatuto de trader do DSA

- Na submissão a uma loja (Google Play), o Regulamento dos Serviços Digitais (DSA) pede o estatuto de *trader* e dados de contacto públicos.
- **A morada indicada é um apartado, nunca a morada de residência do fundador.**
- Os dados pessoais do fundador só entram quando uma conta de loja ou receita os exigir ([`docs/CTO.md`](docs/CTO.md), factos fixos). **[validar com advogado]**: se o fundador é *trader* para efeitos do DSA antes de haver receita.

### Monetização

- **Nenhuma monetização sem autorização do empregador do fundador.** É um item lento: trata-se muito antes de haver receita, não quando ela aparecer. A via de receita prevista está em [`docs/NEGOCIO.md`](docs/NEGOCIO.md).

### Alegações médicas

- **Zero alegações médicas.** O Bricklap não diagnostica, não trata e não aconselha clinicamente — **nem na interface, nem na divulgação** (loja, sítio, redes). Nada de textos que sugiram efeito na saúde, prevenção ou tratamento de doenças. **[validar com advogado]**: a fronteira com a regulamentação de dispositivos médicos, quando entrarem métricas de desempenho (VO₂max, FTP, HRV).

### Localização e zonas de privacidade

- Um percurso GPS mostra onde o atleta começa e acaba, e isso costuma ser onde mora ou trabalha.
- **As zonas de privacidade — esconder o início e o fim de cada percurso — são obrigatórias antes de qualquer partilha ou mapa público.** Não é uma melhoria para depois: é condição para existir mapa ou partilha. Ver o [`ROADMAP.md`](ROADMAP.md), 4.5b, e o [`docs/BACKLOG.md`](docs/BACKLOG.md), secção do mapa.

### Marca

- **A marca Bricklap não está registada.** A verificação no TMview e no INPI (classes 9 e 42) e o domínio ficam para quando houver algo público; até lá a marca não sai do repositório e da app ([`docs/marca/README.md`](docs/marca/README.md)).

## O que ainda não está tratado

- **Responsável pelo tratamento** por identificar (nome ou denominação, morada, NIF, contacto) — por decisão do fundador, só quando for preciso.
- **Consentimento dos dados de saúde**: nenhum texto nem ecrã existe.
- **RoPA e DPIA**: não existem.
- **Política de privacidade da app Android**: os textos atuais são do lab web e não cobrem a app nativa (permissões de localização em segundo plano, notificações, retenção local, exportação da base) — está no ROADMAP, 4.7b.
- **Retenção e apagamento**: a app apaga uma sessão com `DELETE` real (ADR 0006), mas não há política escrita de retenção.
- **Exportação e importação** (GPX, FIT de um Garmin): que dados saem do telemóvel e para onde, quando existirem.
- **Contas, sincronização e servidor** (Fase 6): mudam a natureza jurídica do tratamento e exigem revisão completa deste ficheiro.
- **Feed social e dados de terceiros**: fora do âmbito até à etapa 3 ([`docs/NEGOCIO.md`](docs/NEGOCIO.md)); tornam o fundador responsável por dados de outras pessoas.
- **Termos da loja e estatuto DSA**: nada submetido.
- **Autorização do empregador do fundador para monetizar**: por pedir.
- **Validação por advogado** de tudo o que está marcado acima: nenhuma feita. O custo da Fase 1 exclui advogado até ser mesmo necessário ([`docs/CTO.md`](docs/CTO.md)).
