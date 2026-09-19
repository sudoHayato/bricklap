# ADR 0012 — Taxonomia de exercícios: o tipo decide os campos, o exercício é um dado

**Estado**: **aceite** pelo CTO e pelo fundador na sessão 27 (2026-09-19), depois de proposto e implementado nessa mesma sessão a pedido do CTO ("Escreve um ADR para isto. É decisão estrutural e vai condicionar os planos de treino da 4.5"). As três perguntas que ficaram em aberto foram respondidas pelo fundador e estão no fim, com a resposta. Nada do que aqui está reescreve uma linha da base: se a decisão mudar, muda código e catálogo, não histórico.

## Contexto

Foi a primeira queixa do dogfooding ([treino 01](../dogfooding/2026-09-14-treino-01.md)), nas palavras do fundador: **"força para mim é peso puro; flexões e RDL não são força"**. A app tinha oito desportos e um deles, o que então se chamava Força (hoje **Ginásio**, §6), era o saco onde caía tudo o que não fosse máquina de cardio. A sessão 26 ([ADR 0011](0011-rondas-e-valores-registados.md)) deu valores aos blocos, mas o exercício ficou um nome escrito à mão, e todo o bloco de Força mostrava repetições **e** carga — nas flexões também.

O que existe para desenhar isto são os treinos reais do fundador, e a taxonomia parte deles e de mais nada. O treino 01: **500 m de remo indoor, 10 flexões, 10 bicep com haltere, 500 m de corrida na passadeira, 5 push ups, 10 RDL**, quatro vezes. O treino 03: passadeira alternada com circuito. O treino 02: corrida na rua e circuito. O único nome alguma vez escrito na app do fundador foi **"bicep"**, na sessão de teste de 2026-09-18.

## Decisão

### 1. Dois eixos, e só um é novo

**O primeiro eixo já existe e não muda: o desporto do segmento** (`Sport`). É o que decide **como se grava** — com GPS ou sem ele, que máquina, que campos. O remo indoor e a passadeira **são desportos**, com os seus campos (ADR 0011 §2): não entram no catálogo de exercícios porque não precisam — um bloco de remo é remo, tenha ou não alguém escrito o nome.

**O segundo eixo é novo: o tipo de exercício** (`ExerciseKind`), e só existe dentro de um bloco de `strength`. Um tipo existe por **uma** razão: **decide que campos o bloco mostra.**

| Tipo | Campos | Exercícios reais do fundador |
|---|---|---|
| **Peso livre** (`free_weight`) | repetições, carga | bicep com haltere; RDL (com carga — confirmado pelo fundador) |
| **Peso do corpo** (`bodyweight`) | repetições | flexões (= push ups) |

E, pelo primeiro eixo, o que já existia:

| Desporto | Campos | Origem |
|---|---|---|
| **Remo indoor** (cardio em máquina) | metros, *split* da máquina (opcional; a app deriva o seu) | declarado |
| **Passadeira** (cardio em máquina) | km/h **ou** metros, o outro derivado do tempo do bloco | declarado |
| Corrida, caminhada, bicicleta (cardio na rua) | nenhum — a distância é medida | medido (GPS) |
| Natação em piscina, transição | nenhum | — |

**O que ficou de fora, e porquê.** *Máquina de musculação* teria os mesmos campos do peso livre (repetições e carga) e **nenhum treino real do fundador a usa**: um tipo que não muda os campos e não tem um exercício real por trás é uma etiqueta à espera de uso. Entra no dia em que houver um exercício que a peça — é uma linha em `EXERCISE_KINDS`. *Cardio* não é um tipo de exercício porque é o eixo do desporto. *Isométrico* (prancha: só tempo) não tem exercício real; e o tempo de um bloco já é medido pelo relógio da app, sem campo nenhum. **A distinção entre 70 kg de agachamento e 70 kg de prensa não é trabalho do tipo: é trabalho da identidade de exercício** — são dois exercícios, comparam-se cada um consigo.

**Um tipo é código; um exercício é um dado.** Os campos são código (validação, ficha, agregados), por isso um tipo novo é trabalho de programador, e é raro. Um exercício novo não pode ser.

### 2. O catálogo de partida: exercícios reais, cada um com a sua lista de grafias em pt e en

`packages/engine/src/exercises.ts`, `SEED_EXERCISES`. **Uma entrada do catálogo é um exercício, não um nome**: tem um identificador estável, o nome mostrado, o tipo e uma **lista de grafias, em português e em inglês** (`spellings: { pt, en }`). O fundador escreve em português ou em inglês conforme lhe vem à cabeça a meio do treino — no treino 01 escreveu "flexões" e, na mesma ronda, "push ups" —, e essas duas palavras são **o mesmo movimento dito em duas línguas, não dois exercícios**. Por isso o catálogo traz os pares óbvios **já ligados**, em vez de esperar que o fundador os junte um a um:

| id | Nome | Tipo | Grafias em pt | Grafias em en |
|---|---|---|---|---|
| `flexoes` | Flexões | peso do corpo | flexão, flexões de braços | push up(s), pushup(s) |
| `barras` | Barras | peso do corpo | barra, elevações | pull up(s), pullup(s) |
| `abdominais` | Abdominais | peso do corpo | abdominal | sit up(s) |
| `agachamento` | Agachamento | peso livre | agachamentos | squat(s) |
| `levantamento_terra` | Levantamento-terra | peso livre | levantamento de terra, peso morto | deadlift(s) |
| `rdl` | RDL | peso livre | peso morto romeno | romanian deadlift |
| `bicep_haltere` | Bicep com haltere | peso livre | **bicep** (o que o fundador escreveu), biceps, bicep haltere, … | bicep curl, dumbbell curl |
| `avancos` | Avanços | peso livre | avanço | lunge(s) |
| `supino` | Supino | peso livre | supino plano | bench press |
| `press_ombros` | Press de ombros | peso livre | press militar, desenvolvimento de ombros | shoulder press, overhead press |
| `remada_haltere` | Remada com haltere | peso livre | remada, remada com halteres | dumbbell row |

Do treino 01 vêm `flexoes`, `bicep_haltere` e `rdl` (o remo e a passadeira são desportos); as outras são **os pares que ele está prestes a escrever** — o critério de entrada é "um exercício que um treino de ginásio com peso do corpo e halteres tem, com o seu par em inglês", e não uma lista completa de ginásio. Onde um exercício podia ir para qualquer dos dois tipos (agachamento, avanços), ficou **peso livre**: uma carga que pode ficar vazia não perde nada, um campo que falta perde a carga.

Os nomes e as grafias comparam-se depois de **dobrados** (`foldExerciseName`): sem maiúsculas, **sem acentos** (o teclado do telemóvel a meio de um treino escreve "flexoes"), com hífenes, pontos e barras lidos como espaços. "Push-ups", "push ups" e "PUSH UPS" são um nome só. **Nenhuma grafia pertence a duas entradas** (há um teste); acrescentar um par é acrescentar uma grafia, e nenhuma linha da base muda.

**A consequência da junção.** No treino 01, "10 flexões" e "5 push ups" eram dois itens da mesma ronda. Agora são **dois blocos do mesmo exercício**: `exerciseAcrossRounds` devolve os dois, e `exerciseTotalsByRound` soma-os — **15 flexões na ronda 1**, 14 na ronda 2 —, com a carga a ser a mais pesada e nunca a soma, e a origem a herdar-se (declarado se algum dos blocos o foi). O texto guardado na base **não se reescreve**: os dois blocos continuam a dizer "Flexões" e "push ups", como foram escritos; quem os junta é a leitura.

**Não é uma lista de ginásio.** Cresce como nasceu: do que se treinou.

### 3. Um exercício novo entra sem programador

O fundador não escreve código. **Escreve o nome na ficha e escolhe o tipo** (duas pílulas: "Peso livre · repetições e carga", "Peso do corpo · só repetições"). O evento `recorded` leva o nome e, quando foi o atleta a dizê-lo, o tipo (`kind`). A partir daí o exercício **é uma entrada do catálogo**: `catalogFromMentions` deriva-o do registo — a partida mais todos os nomes alguma vez registados, com o último tipo escolhido para cada um, do mais recente para o mais antigo — e a ficha da sessão seguinte oferece-o com o tipo já posto.

- **Não há tabela de exercícios.** O catálogo do atleta é derivado dos eventos, como os segmentos, os blocos e as rondas. Apagar as sessões que usaram um exercício tira-o do catálogo, e é o comportamento certo para uma app sem contas: o direito ao apagamento não deixa restos.
- **A última palavra é do atleta.** Se escolher "peso do corpo" para o RDL, o catálogo dele passa a dizer isso — sem tocar na partida e sem programador.
- **Sem tipo escolhido, o bloco mostra repetições e carga**, exatamente como antes desta sessão: nada do que se podia registar ontem é recusado hoje.
- **Os planos de treino (4.5) vão precisar de exercícios antes de haver uma sessão que os use.** Nessa altura o plano é mais uma fonte de menções para o mesmo `catalogFromMentions` — não uma segunda taxonomia. Fica dito aqui para a 4.5 não inventar outra.

### 4. A ligação à identidade de exercício do ADR 0011

O ADR 0011 §1b decidiu que os blocos se comparam entre rondas **pelo que eram, nunca pela posição**. Faltava dizer o que é "o que eram". Agora:

- **`exerciseIdentity(nome)`**: o id do catálogo quando o nome é conhecido (`ex:bicep_haltere` para "bicep", "Bíceps" e "Bicep com haltere"), e o nome dobrado quando não é (`name:kettlebell swing`) — um exercício de que o catálogo nunca ouviu falar continua a comparar-se consigo próprio. Os dois espaços de nomes não colidem.
- **`blockIdentity(bloco)`**: a identidade do exercício nomeado; sem nome, **o desporto, quando o desporto é um exercício em si** (`sport:rowing_indoor`, `sport:treadmill`, a corrida, a natação); senão nada — `strength` é um recipiente e `transition` é o intervalo.
- **`identityAcrossRounds`** é o que põe as flexões da ronda 2 ao lado das da ronda 4 e o remo de cada ronda em linha, com a ronda 2 a saltar o bicep. É o teste com o treino 01 em `packages/engine/test/exercises.test.ts`: o RDL é o 6.º bloco da ronda 1 e o 5.º da ronda 2; pela posição tinha sido emparelhado com os push ups.

**O que se guarda é o que o atleta escreveu, nunca um id.** A resolução nome → catálogo faz-se **ao ler**. Consequências, todas queridas: a base não tem ids que um catálogo futuro tenha de honrar; juntar duas entradas é acrescentar uma grafia; e o histórico melhora sozinho quando o catálogo melhora.

### 5. Migração: nenhuma linha muda

- **Sem esquema novo.** O tipo viaja no JSON do `payload` que o esquema v4 já tem; um `payload` escrito antes desta sessão não tem `kind` e lê-se como sempre. Um `kind` desconhecido falha alto, com o `seq` da linha, como o resto do `payload`.
- **Os nomes já escritos sobrevivem porque ninguém lhes toca**, e mapeiam onde dá porque a resolução é na leitura: "bicep" passa a ser `ex:bicep_haltere`, peso livre, com os 22,5 kg que tinha. O que não mapear fica como estava — nome próprio, identidade própria, os dois campos.
- **Provado sobre a base real do telemóvel** (`apps/mobile/test/taxonomia-real.test.ts` e `leitura-real.test.ts`; números no [relatório da sessão 27](../reports/2026-09-19-sessao-27.md)). A base do fundador tem hoje **zero nomes escritos** — o único, "bicep", estava na sessão de teste que ele mandou apagar —, por isso a prova repõe essas oito linhas, **só na cópia temporária**, tal como o relatório da sessão 26 as registou.

### 6. O desporto "Força" passa a "Ginásio"

Decisão do fundador. É **só o rótulo**, nos dois dicionários (`Ginásio` / `Gym`): o identificador `strength` guardado na base não muda e nenhuma sessão antiga se reescreve — uma sessão de há um mês, aberta hoje, diz "Ginásio". A razão é a queixa do treino 01: "força para mim é peso puro". Um bloco de flexões e RDL num desporto chamado Força mentia; num chamado Ginásio, não.

## Alternativas consideradas

- **Mais desportos em vez de um tipo** ("Peso do corpo" como nono desporto). Rejeitada: cada troca bicep → flexões passava a ser um `sport_changed`, um segmento novo e dois toques no Mudar, dentro de um circuito em que o fundador já não usa a Marca. O desporto decide como se grava; flexões e bicep gravam-se da mesma maneira.
- **Uma tabela `exercises` na base.** Rejeitada por agora: era uma segunda fonte de verdade ao lado dos eventos, com a sua migração e o seu apagamento, para guardar o que o registo já diz. Se a 4.5 precisar de exercícios que nunca foram usados, entram como menções do plano.
- **Guardar o id do catálogo no evento.** Rejeitada: amarrava a base a um catálogo de quatro entradas desenhado com um treino. O nome escrito é o facto; o id é interpretação.
- **Uma lista genérica de ginásio** (as ~100 entradas que qualquer app traz). Rejeitada pelo CTO no brief, e bem: metade dos nomes seria de exercícios que o fundador não faz, com tipos que ninguém verificou.
- **O tipo como texto livre.** Rejeitada: o tipo decide campos, e campos são código.

## Consequências

- A ficha de um bloco de exercícios mostra o nome, as sugestões do catálogo, as duas pílulas de tipo e **só os campos desse tipo**; as flexões deixam de pedir carga. Um bloco que muda de bicep para flexões limpa a carga (um `recorded` com `loadKg: null`; os 12,5 kg continuam no registo).
- `applyRecord` recusa uma carga num exercício de peso do corpo, como já recusava repetições num bloco de remo: é um engano, não um valor.
- **O desporto passa a chamar-se "Ginásio"** (§6). É só o rótulo; o identificador `strength` na base não muda.
- Os planos de treino (4.5) referem exercícios por nome e tipo, resolvidos por `exerciseIdentity` — a mesma identidade que compara rondas compara o previsto com o feito.

## Perguntas ao fundador — respondidas (sessão 27)

1. **Flexões e push ups são o mesmo exercício?** **Sim**: a mesma coisa em duas línguas. Uma entrada, com a outra como grafia — e o mesmo tratamento para todos os pares (§2).
2. **O RDL é com carga?** **Sim**, peso livre. O "por confirmar" saiu.
3. **"Força" continua a ser o nome do desporto?** **Não**: passa a "Ginásio" (§6).
