# Decisões descartadas

**Isto não é um ADR.** Os [ADR](adr/) registam o que se decidiu e fica. Este ficheiro regista **o que se tentou e se abandonou, e o argumento que o matou** — o conhecimento que evita repetir o mesmo caminho daqui a três meses. Até à sessão 22d só existia nas conversas com o CTO.

Cada entrada tem a mesma estrutura: **o que se tentou / porque parecia boa ideia / porque se abandonou / a prova / o que não se deve tentar outra vez.** Os números vêm dos relatórios e dos ADR ligados em cada entrada; quando um número não está registado no repositório, a entrada diz isso.

Lê-se antes de propor uma abordagem nova ([`AGENTS.md`](../AGENTS.md), "Ler primeiro", nível B).

## Índice

1. [O Mudar em ciclo](#1-o-mudar-em-ciclo) — sessão 14, revertido na 17
2. [O espaço negativo na marca](#2-o-espaço-negativo-na-marca) — sessão 19b; reaberto e medido na 24
3. [As famílias de marca encerradas com medições](#3-as-famílias-de-marca-encerradas-com-medições) — sessões 18 e 19; a G reaberta na 24
4. [O B sozinho no símbolo, e a ligadura BL medida](#4-o-b-sozinho-no-símbolo-e-a-ligadura-bl-medida) — sessões 19 a 23
5. [A regra das duas tonalidades está partida](#5-a-regra-das-duas-tonalidades-está-partida) — sessões 19 e 19b
6. [O Blender como ferramenta de marca](#6-o-blender-como-ferramenta-de-marca) — sessões 18 a 19b
7. [O âmbito da Fase 1 perante o primeiro dogfooding](#7-o-âmbito-da-fase-1-perante-o-primeiro-dogfooding) — sessão 20
8. [O arco de tijolos (AR)](#8-o-arco-de-tijolos-ar) — sessões 24 e 25, fechada na 26
9. [A volta torcida (GI)](#9-a-volta-torcida-gi) — sessões 24 e 25, fechada na 26

---

## 1. O Mudar em ciclo

**Sessão 14, revertido na sessão 17.** Prova: [relatório da sessão 14](reports/2026-09-13-sessao-14.md) §4.5, ponto 3; [relatório da sessão 17](reports/2026-09-13-sessao-17.md) §3.1; [ADR 0006](adr/0006-persistencia-sqlite-append-only.md).

- **O que se tentou.** O agente de código decidiu, sem o brief o mandar, que o botão Mudar percorria os oito desportos em ciclo, poupando um ecrã: cada toque passava ao desporto seguinte da ordem dos tijolos do início (Força, Passadeira, Remo indoor, Natação, Corrida, Caminhada, Bicicleta, Transição).
- **Porque parecia boa ideia.** Um toque em vez de dois, como num relógio.
- **Porque se abandonou.** Por duas razões, e **a segunda é a que conta**:
  1. Contrariava o fluxo que o fundador aprovou: o protótipo da sessão 10 conta **2 toques** para "mudar de desporto" ([docs/prototipo/README.md](prototipo/README.md)).
  2. **Cada toque escrevia um `changeSport`.** Ir de Força a Bicicleta são 6 toques e deixa **5 segmentos de ~0 s** na base append-only. Numa base em que os eventos são a fonte de verdade, isto é **dano nos dados, não um problema de interface**: não há forma de tirar esses segmentos da sessão sem a apagar inteira (ADR 0006: só se apaga uma sessão completa, a pedido do atleta), e cada um aparece no resumo e no histórico como um bloco que o atleta nunca fez.
- **A prova.**
  - Na ordem do ciclo da sessão 14, Força é a posição 0 e Bicicleta a 6: seis `changeSport` (Passadeira, Remo indoor, Natação, Corrida, Caminhada, Bicicleta), dos quais os cinco primeiros abrem segmentos que fecham logo a seguir.
  - O ciclo inteiro exigia **até 7 toques** entre dois desportos (relatório da 17).
  - Depois da reversão, a mesma troca lida diretamente na base do telemóvel: **2 linhas, não 7** — `started(strength)` e `sport_changed(bike)`. Abrir a escolha e cancelar não escreve nada.
- **O que não se deve tentar outra vez.** **Nenhum atalho de interface pode escrever eventos que o atleta não pediu.** Quando houver planos de treino, o Mudar pode **propor** o bloco seguinte ([BACKLOG](BACKLOG.md), "O Mudar propõe o bloco seguinte") — **propor não é escrever**.

## 2. O espaço negativo na marca

**Sessão 19b: 0 aprovadas em 16.** Prova: [relatório da sessão 19b](reports/2026-09-13-sessao-19b.md) §4.1 e §4.2; a moldura eliminada no [relatório da sessão 18](reports/2026-09-13-sessao-18.md) §4 e §5.

- **O que se tentou.** A dupla leitura do Strava e do Replit: uma forma que também é uma letra, feita com o vazio. Quatro conceitos, quatro variantes cada: **J** (L na junta), **H** (cama de argamassa), **K** (esquina aberta) e **T** (L de luz, a dupla leitura pelo tom).
- **Porque parecia boa ideia.** É o truque das marcas que funcionam: uma só forma com duas leituras, e a letra de graça.
- **Porque se abandonou.** A razão é **estrutural, não falta de jeito**. A dupla leitura precisa de uma forma que **contenha**, e a forma que contém é a **moldura** — que já tinha sido eliminada com medições na sessão 18 (entrada 3). **Sem recipiente, o olho lê a peça de fora antes do vazio de dentro.** Somado aos cortes a 90° e aos 24 px, **o truque fica indisponível dentro das regras do [DESIGN.md](DESIGN.md)**.
- **A prova.**
  - **0 de 16 no espaço negativo**; das 48 variantes da sessão passaram 8, todas parentes da P2122.
  - **L na junta (J)** lê-se **painel com barra lateral** (e rodapé): a peça de fora já é um L, e a junta de 2 px é uma costura, não uma letra.
  - **Junta larga (H)** lê-se **marca de corte** (o canto de enquadramento) com um bloco dentro.
  - **Canto aberto (K)** não lê **letra nenhuma**: o fecho da Gestalt não acontece a 24 px com barras de 3 e 4 px.
  - **L de luz (T)**: a 2,22:1, o tom claro continua a ser tinta, e dois L encaixados à volta de um bloco são outra vez o canto de enquadramento.
  - Todas as 16 destoam no desfoque: peso de 0,30 a 0,48, contra 0,24 da P2122. **O espaço negativo custa massa, e a 24 px a massa lê-se como interface.**
- **O que não se deve tentar outra vez.** **Não voltar a tentar espaço negativo sem primeiro mudar as regras do DESIGN.md.** É uma decisão de produto do fundador, não uma sessão de logótipo.
- **Sessão 24: as regras mudaram, e tentou-se outra vez** ([relatório](reports/2026-09-15-sessao-24.md) §3 e §6). O fundador tornou legais as curvas (2026-09-15), e com curvas o recipiente já não tem de ser a moldura: o conceito **ES** pôs o L no vazio de um **disco** (a volta vista de cima) e de um **tijolo de cantos redondos**, com o corte aberto até à borda ou fechado lá dentro. **0 de 4**, por uma razão nova: no disco, o L vazio **são os ponteiros de um relógio às três** (cronómetro, na lista negra); no tijolo redondo, é **uma letra fechada numa tecla** — a moldura outra vez, só com cantos redondos. E pesam: peso de 0,27 a 0,37 contra 0,24 da P2122. **O que se aprendeu:** tirar os 90° resolve a moldura, mas um L vazio dentro de uma forma redonda lê-se como mostrador. Um espaço negativo que funcione precisa de uma forma de fora que já seja uma ideia (o que o FedEx tem e estes recipientes não).

## 3. As famílias de marca encerradas com medições

**Sessões 18 e 19.** Prova: [relatório da sessão 18](reports/2026-09-13-sessao-18.md) §4 e §5 (a tabela das 56); [relatório da sessão 19](reports/2026-09-13-sessao-19.md) §4.

- **O que se tentou.** Gerar e julgar a 24 px famílias de silhuetas por varrimento de parâmetros: sete na sessão 18 (56 variantes), quatro sementes do CTO na sessão 19 (96 variantes).
- **Porque parecia boa ideia.** A hipótese da sessão 18: o símbolo falhava por falta de volume de variantes julgadas ao tamanho real, não por falta de desenho.
- **Porque se abandonou.** Cada família chumbou numa leitura concreta, quase sempre **nos critérios de leitura, não nos píxeis**. Na 18 passaram 2 de 56 (L221 e L222, a mesma forma rodada); na 19, 8 de 96, todas da mesma ideia.
- **A prova, família a família.**

| Família | Sessão | Resultado | Porque chumba |
|---|---|---|---|
| **F** — fiada | 18 | 0 de 8 na leitura (14 de 16 passam nos píxeis, com a E) | As fiadas leem-se como o **ícone do Histórico** da própria app (F211, F212, F221, F222) ou como linhas de texto e um traço. Com a E (escada), **16 de 16 chumbam na leitura** — "o resultado negativo mais forte da sessão" |
| **M** — moldura | 18 | 0 de 8 | É **o defeito que se estava a corrigir**: lê-se painel, janela com barra lateral, ecrã dividido. Presa entre dois defeitos: **com vão 5 (1,2 px) as juntas não ficam limpas** (M111 fica com uma peça separada em quatro, a uma cor); **com vão 10 o pilar desce a 1,44 px** (M112, M122), porque o aro come o espaço |
| **D** — dentado | 18 | 0 de 8 | Caixa de entrada (`move_to_inbox`) e servidor empilhado (`dns`) |
| **G** — haste e bojo | 18 | 0 de 8 | As letras «lo» — nem controlo, nem marca — ou «l■», um gráfico de duas barras |
| **V** — volta em degrau (S2) | 19 | 0 de 24 na letra | Três barras empilhadas: **lista ou menu**, e a primeira letra é um **Z** |
| **Y** — escada (S3) | 19 | 0 de 24 na letra | Os três blocos leem-se como um **traço inclinado** (/): a forma lê-se, a letra não |
| **N** — encaixe em L (S4) | 19 | 0 de 24 na letra | As duas peças leem-se Γ e ⅃, e juntas um **S quadrado**; finas, a **marca de corte**; redondas, dois ganchos a rodar: o **indicador de carregamento** |

- **O que não se deve tentar outra vez.** **Estas famílias não voltam sem um argumento novo que não seja estético.** Mexer no vão, no raio ou na espessura não as salva: foi exatamente isso que o varrimento fez.
- **Sessão 24: a G reaberta, porque as duas regras que a mataram caíram** ([relatório](reports/2026-09-15-sessao-24.md) §6). A G lia-se «lo» porque a haste e o bojo eram **duas peças separadas por uma junta**, e «l■» porque o bojo era **um retângulo** — a junta obrigatória e os 90°. Com uma peça só e curvas legais (decisão do fundador, 2026-09-15), a haste e o bojo foram desenhados como um **b de pista** (BP, BF: 8 variantes). **Chumbaram de outra maneira:** leem-se «b», uma letra de fonte e nada mais — o mesmo defeito da ligadura BL (entrada 4) —, e no campo vermelho do ícone o b branco num círculo é **a marca da Beats by Dre**. As outras famílias (F, M, D, V, Y, N) não se reabriram: nenhuma morreu por uma regra que caiu.

## 4. O B sozinho no símbolo, e a ligadura BL medida

**Sessões 19 a 23.** Prova: o B saiu do símbolo no brief da sessão 19 ([relatório da sessão 19](reports/2026-09-13-sessao-19.md), §10: "o B e o wordmark ficam para outra sessão"); a ligadura BL ficou registada como direção por testar na sessão 20 ([BACKLOG](BACKLOG.md), "Marca: em standby"); **a medição é da sessão 23** ([relatório da sessão 23](reports/2026-09-15-sessao-23.md), §5). O argumento da ligadura veio das conversas com o CTO e foi registado aqui pela primeira vez na sessão 22d; **a sessão 23 mediu-o e corrigiu esta entrada**.

- **O que se tentou.** Tirar o B do símbolo e deixá-lo só para o wordmark, porque se assumiu — **três vezes** — que um B era impossível a 24 px: as contraformas ficam com **~2 px** e fecham-se com o antisserrilhado.
- **Porque parecia boa ideia.** A conta parecia simples: um B tem dois vazios empilhados, e a 24 px não há píxeis para os dois.
- **O que o CTO propôs em vez disso (sessão 22d, estimativa).** A conta assumia que o B tinha de caber **acima do pé do L**. Se o traço de baixo do B **for** o pé do L — uma **ligadura**, com o B a partilhar a haste e o pé —, **todos os traços ficam ao mesmo peso** e as contraformas passam de **~2 para ~5,5 unidades** da grelha. Número estimado num desenho de navegador, nunca no rasterizador.
- **Uma consequência que não se pode esquecer:** **a ligadura obriga a uma cor.** Um pé partilhado pelo B e pelo L não pode ter dois tons ao mesmo tempo. Isto choca com a regra das duas tonalidades (entrada 5).
- **A prova — medida na sessão 23**, na cadeia do Blender, a 24, 48 e 73 px, creme e escuro, a uma cor, com o recorte circular. O "antes" é uma reconstrução (a P2122 com um B de traço 2 acima do pé, a partilhar a haste), porque o desenho do CTO não está no repositório. **A estimativa estava certa num caso só, e errada em duas coisas:**
  1. **As ~5,5 unidades só existem com traço fino.** Com a haste e o pé na grelha 3..21, cada contraforma mede `(18 − 3 × traço) / 2` de alto. Medido: **traço 2 → 6 e 6** (a estimativa); **traço 3 → 4 e 5**; **traço 4 → 3 e 3**; **traço 5, o peso da P2122 → 1 e 2**. "Todos os traços ao mesmo peso" e "contraformas de 5,5" só são verdade juntos com traços de 2 unidades — **2,5 vezes mais finos do que a P2122**.
  2. **A premissa da impossibilidade também estava errada, por outra razão.** Com as coordenadas inteiras da grelha de 24 (regra da sessão 19b), **contraformas de 2 e 3 px não se fecham com o antisserrilhado**: no "antes", 12 de 12 e 18 de 18 píxeis limpos a 24 px, nos dois temas; mesmo a contraforma de 1 × 2 da ligadura de traço 5 fica limpa (2 de 2). O que fecha as contraformas é o desalinhamento à grelha, não o tamanho do B.
  3. **O custo que a estimativa não via é o peso ótico.** No desfoque (a régua da 19b, ±25 % da P2122, peso 0,24 · mancha 0,80), **nenhuma espessura cabe**: traço 2 fica leve demais (mancha 0,53, −34 %); traço 3 já pesa demais (peso 0,31, +29 %); traço 4 e 5, 0,36 e 0,40. No recorte passam todas (a perna mais cortada, 7 % a 16,6 %).
  4. **E na leitura, a ligadura é um monograma, não um símbolo**: a 24 px lê-se "BL" ou "B_" em letra de píxeis. Responde a "que letra é?", não a "que forma é?" — ao contrário da P2122, que responde às duas.
- **Conclusão da medição.** A ligadura **abre** o B a 24 px, mas não o salvou como símbolo: **não bateu a P2122** (sessão 23). Serve, quando muito, de ponto de partida para um **wordmark** ou um monograma, que é outra pergunta.
- **O que não se deve tentar outra vez.** **Não declarar uma forma impossível sem verificar a premissa geométrica em que a impossibilidade assenta** — e **não dar por boa uma estimativa de contraformas sem dizer com que espessura de traço foi feita**.

## 5. A regra das duas tonalidades está partida

**Sessões 19 e 19b.** Prova: [relatório da sessão 19](reports/2026-09-13-sessao-19.md) §5 e §9; [relatório da sessão 19b](reports/2026-09-13-sessao-19b.md) §7. A regra está em [docs/marca/README.md](marca/README.md) e no [ROADMAP](../ROADMAP.md), 4.4c.

- **O que se tentou.** Manter a regra do fundador (sessão 15): o B em `#C0402C` e o L em `#E89478`, distintos em todas as aplicações visíveis.
- **Porque parecia boa ideia.** É a assinatura da marca, e na moldura funcionava.
- **Porque se abandonou — e não foi o desenho que a partiu, foram as superfícies.** O `#E89478` foi escolhido para viver **dentro de um recipiente vermelho**. Esse recipiente era a moldura, que morreu (entrada 3). Fora dela:
  - **Sobre o creme**, o tom claro dá **2,22:1** — abaixo de qualquer piso de legibilidade.
  - **Sobre o campo vermelho do ícone da app** (`#C0402C`, sessão 16), é o **tom escuro** que desaparece: é a cor do próprio campo.
  - **Na notificação** é monocromático de qualquer forma.
- **A prova** (19b §7, contraste medido; limiar de 3:1):

| Braço | Haste / creme | Pé / creme | Haste / escuro | Pé / escuro | Passa |
|---|---:|---:|---:|---:|:---:|
| atual: haste `#C0402C`, pé `#E89478` | 4,95:1 | **2,22:1** | 3,62:1 | 8,07:1 | não |
| tons trocados | **2,22:1** | 4,95:1 | 8,07:1 | 3,62:1 | não |
| uma cor só, `#C0402C` | 4,95:1 | 4,95:1 | 3,62:1 | 3,62:1 | sim |
| claro escurecido, pé `#E0704B` | 4,95:1 | **3,01:1** | 3,62:1 | 5,95:1 | sim |

  **Conclusão medida: não existe atribuição de dois tons que sobreviva às três superfícies.** Trocar os tons só muda qual peça fica fraca. As opções que sobram são **uma cor só**, ou **escurecer o tom claro para `#E0704B`** — com o pé a 3,01:1 sobre o creme, mas os dois tons a **1,64:1** entre si (ΔE de 34 para 16,9), e o pé também a 1,64:1 sobre o campo do ícone.
- **O que não se deve tentar outra vez.** **Não voltar a atribuir tons sem medir contraste nas três superfícies — creme, campo do ícone, monocromático.** A escolha entre uma cor e o tom escurecido é do fundador.

## 6. O Blender como ferramenta de marca

**Sessões 18, 19 e 19b.** Prova: [relatório da sessão 18](reports/2026-09-13-sessao-18.md) §6, "O que o Blender deu que o desenho direto não dava — e o que não deu"; [relatório da sessão 19b](reports/2026-09-13-sessao-19b.md) §9; gerador em [`tools/marca-blender/`](../tools/marca-blender/).

- **O que se tentou.** Usar o Blender, sem interface, como fábrica de silhuetas: gerar e medir **200 variantes** (56 na sessão 18, 96 na 19, 48 na 19b).
- **Porque parecia boa ideia.** A hipótese era que volume julgado ao tamanho real resolvia o que três rondas de desenho não tinham resolvido.
- **Porque se abandonou como resposta.** O que valeu foi o **rasterizador calibrado ao sRGB do Android** e as **medições reprodutíveis** (a mesma corrida dá as mesmas imagens, píxel a píxel). O que **não deu**:
  - **Ideias** — as famílias eram todas do agente. "O gerador multiplica ideias; não as tem."
  - **O juízo de forma**, que continua a ser humano: o critério que decidiu todas as sessões foi a leitura, não os píxeis.
  - O próprio relatório da 18 concluiu que **um gerador de SVG com um rasterizador (o resvg, ou o Skia) fazia o mesmo**: são polígonos retilíneos em 2D.
- **A prova.** De 56 passaram 2 (a mesma forma); de 96, 8 (a mesma ideia); de 48, 8 (parentes da P2122). Nas três sessões os critérios automáticos quase não eliminaram nada e a leitura eliminou quase tudo. **Três sessões e duas ferramentas** — o gerador em Blender e, na 19b, a skill de ideação de marcas usada para construir o repertório — **convergiram sempre para o mesmo sítio**: a P2122.
- **O que não se deve tentar outra vez.** **Trocar de ferramenta não resolve um problema de repertório.**

## 7. O âmbito da Fase 1 perante o primeiro dogfooding

**Sessão 20, 2026-09-14.** Prova: [registo do treino 01](dogfooding/2026-09-14-treino-01.md); [ADR 0011](adr/0011-rondas-e-valores-registados.md) (proposto); [ROADMAP](../ROADMAP.md), 4.5, "Precedência".

- **O que se tentou.** Seguir da app que grava para os planos de treino (4.5), com o modelo de dados que a Fase 1 deixou: uma sessão é uma sequência de segmentos de tempo, e quando é de rua, uma distância. ("Fase 1" aqui é o MVP das diretrizes do CTO, que são as Fases 1 a 3 do ROADMAP — ver [docs/CTO.md](CTO.md).)
- **Porque parecia boa ideia.** Os planos eram a mudança de natureza do produto: a app deixava de ser cronómetro e passava a guiar o treino.
- **Porque se abandonou esta ordem.** Um treino HIIT real de **4 rondas com 6 exercícios** mostrou que a app gravava **o tempo do treino, não o treino**: **sem valores, sem noção de ronda, sem edição**. O âmbito da Fase 1 revelou-se insuficiente ao **primeiro** contacto com um treino híbrido a sério.
- **A prova.** A sessão ficou gravada como **24 blocos seguidos**, sem noção de que os blocos 1–6 e 7–12 são a mesma ronda repetida; sem metros nem ritmo no remo, sem velocidade na passadeira, sem repetições nem carga — só o tempo de cada bloco.
- **Consequência registada.** **Os planos de treino desceram na ordem**, porque planos sem valores dão um cronómetro mais bonito. **O modelo de dados (ADR 0011) passou à frente.**
- **O que não se deve tentar outra vez.** **Não construir interface sobre um modelo de dados que ainda não foi validado contra um treino real.**

## 8. O arco de tijolos (AR)

**Sessões 24 e 25; fechada na sessão 26 por decisão do fundador (2026-09-18).** Prova: [relatório da sessão 24](reports/2026-09-15-sessao-24.md); [relatório da sessão 25](reports/2026-09-18-sessao-25.md) §4.2, §5, §6 e §8.1. Regras em [DESIGN.md §8b](DESIGN.md).

- **O que se tentou.** Um arco de alvenaria — aduelas de tijolo separadas por juntas, com ou sem pedra de fecho saliente e com ou sem pés-direitos — desenhado com as regras novas da sessão 24 (curvas legais). A ideia prometia duas leituras: o arco de tijolos, e **o arco como a curva de uma pista** (a volta). Na 24 as juntas de 0,9 unidades colavam a 24 px e o semicírculo aos segmentos lia-se indicador de carregamento; na 25 afinou-se: juntas de 2 e 2,5 unidades, 3 ou 5 aduelas, fecho liso ou saliente 1,5, pés-direitos ou não — **16 variantes**.
- **Porque parecia boa ideia.** É tijolo, que é o material da marca; e um arco é a única forma de alvenaria com curva, o que a regra nova acabava de permitir. Era a família nova mais perto de uma candidata desde a sessão 19.
- **Porque se abandonou.** A AR1221 cumpriu o objetivo do brief e **mesmo assim chumba na regra das duas perguntas** (sessão 19): responde "um arco de tijolos" às duas — a forma e a ideia são o mesmo objeto. A segunda leitura prometida, a volta da pista, **não aparece a nenhum tamanho**, nem a 24 nem a 73 px. Não tem letra. **Decisão do fundador (sessão 26): "forma + material" — arco; tijolos — NÃO é leitura dupla.** É o mesmo objeto descrito duas vezes, e a régua da P2122 ("dois tijolos"; "L") exige duas respostas diferentes.
- **A prova** (relatório da 25 §4.2 e §5, 16 variantes):
  - **24 px: as 16 passam**, com todas as juntas abertas nos dois temas (as peças contadas a 24 px são as da forma: 3, 5 ou 7). **Recorte:** 0 a 3,9 %. **Semelhança:** nenhuma sinalizada pela régua relativa.
  - **Lista negra: 10 de 16 chumbam** — as 8 de 5 aduelas leem-se **pontos num semicírculo** (indicador de carregamento); as 2 de 3 aduelas sem pés e fecho liso, um **mostrador de três segmentos**.
  - **Desfoque: 12 de 16 destoam**, todas para leve (de −25 % a −74 % do peso da P2122); é a geometria — com juntas radiais de 2, cinco aduelas não cabem num anel grosso (anel 3,27 com junta 2; 2,63 com junta 2,5; com 3 aduelas o anel fica em 4,5).
  - **A AR1221 e a AR1222** (3 aduelas, pés-direitos, fecho saliente) **passam tudo o que é medido**: 24 px, lista negra, recorte, desfoque dentro dos ±25 % (**−16 % · −10 %** e **−20 % · −13 %**) — e leem-se **arco de tijolos** a 24 px, nos dois temas e no recorte. Chumbam **só** nas duas perguntas.
  - **Passam em tudo: 0 de 16.**
- **O que não se deve tentar outra vez.** **Nenhuma variante de arco** — a família não tem mais para onde ir: o que lhe falta não é afinação, é a segunda leitura, e essa não aparece a nenhum tamanho. E, como regra para qualquer família futura: **nenhuma leitura "forma + material" conta como dupla.** Uma forma que se descreve pelo material de que é feita continua a ser um objeto só.

## 9. A volta torcida (GI)

**Sessões 24 e 25; fechada na sessão 26 por decisão do fundador (2026-09-18), com o argumento geométrico do agente da 25.** Prova: [relatório da sessão 24](reports/2026-09-15-sessao-24.md); [relatório da sessão 25](reports/2026-09-18-sessao-25.md) §4.1, §5, §6 e §8.3. Regras em [DESIGN.md §8b](DESIGN.md).

- **O que se tentou.** Uma volta da pista como fita torcida (uma fita de Möbius, ou uma volta inteira), modelada em 3D e projetada em silhueta plana, como a regra nova da sessão 24 permite. Na 24 a fita era uma superfície sem espessura: onde ficava de perfil, a silhueta descia a zero e o anel partia-se a 24 px — **as 4 GI da 24 perdiam a contraforma**. Na 25 a fita passou a um **sólido de secção retangular** (largura 5 ou 7; espessura 2,4 ou 3,2), com meia volta ou volta inteira e duas câmaras — **16 variantes**, depois de 24 combinações exploratórias de torção e câmara.
- **Porque parecia boa ideia.** A volta é a ideia do produto (lap), e a torção é o que a distingue de um anel qualquer. Com espessura real, a fita já não desaparece de perfil.
- **Porque se abandonou — é geometria, não afinação.** Numa silhueta a uma cor, **a torção só se vê onde a fita, de perfil, chega a zero de largura**: é esse ponto que a desenha. **A regra dos 24 px proíbe exatamente esse ponto:** para o anel não partir, a parte mais fina tem de ter pelo menos ~2 unidades de traço; e para a contraforma não fechar, a parte mais larga não pode passar de ~7,7 unidades. O índice de torção (largura mínima sobre a máxima) fica preso entre **0,29 e 0,55** — e um anel que vai de 2 a 6 px lê-se como um O irregular, **não como uma fita a torcer**. A GI não passa os 24 px sem perder a torção; o que a define é o que os 24 px não deixam existir.
- **A prova** (relatório da 25 §4.1 e §5, 16 variantes):
  - **24 px: as 16 passam**, com a contraforma aberta nos dois temas (na 24, nenhuma). **Recorte:** 0 %. **Desfoque:** só a GI1111 destoa (−26 %). **Semelhança:** nenhuma sinalizada.
  - **Medidas de construção:** traço mínimo 1,90 a 3,40 unidades; vão mínimo 1,10 a 6,75. Com a fita a 7,68 e 8,06 de largura (GI2211 e GI2221) o furo desce a **1,35 e 1,10 unidades** e fica uma fenda — é aí que a contraforma fecha.
  - **A torção não se vê em nenhuma das 16.** Leem-se: **anel oval mais grosso de um lado** (8, câmara a 40°: o O, o indicador de carregamento); **lente** (6, câmara a 25°: o olho, o ícone de mostrar e ocultar); **lábios** (2, fita larga e volta inteira). **Lista negra: 14 de 16.** Duas perguntas: 0 passam. **Passam em tudo: 0 de 16.** O olho entrou na lista negra por causa destas seis (decisão do fundador, sessão 26).
- **O que não se deve tentar outra vez.** **Engrossar, rodar ou mudar a câmara não resolve** — foi exatamente isso que a 25 fez, em 16 variantes mais 24 exploratórias. A torção e os 24 px excluem-se por construção; a única saída seria uma metáfora que não fosse anel nem órbita, e essa já não é esta família.
