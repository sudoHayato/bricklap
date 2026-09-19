# ADR 0012 — Taxonomia de exercícios: o tipo decide os campos, o exercício é um dado

**Estado**: **proposto pela equipa de desenvolvimento e implementado na sessão 27 (2026-09-19)**, a pedido do CTO ("Escreve um ADR para isto. É decisão estrutural e vai condicionar os planos de treino da 4.5"). **À espera da aceitação do CTO e do fundador** — em particular das três perguntas do fim, que só o fundador sabe responder. Nada do que aqui está reescreve uma linha da base: se a decisão mudar, muda código e catálogo, não histórico.

## Contexto

Foi a primeira queixa do dogfooding ([treino 01](../dogfooding/2026-09-14-treino-01.md)), nas palavras do fundador: **"força para mim é peso puro; flexões e RDL não são força"**. A app tinha oito desportos e um deles, Força, era o saco onde caía tudo o que não fosse máquina de cardio. A sessão 26 ([ADR 0011](0011-rondas-e-valores-registados.md)) deu valores aos blocos, mas o exercício ficou um nome escrito à mão, e todo o bloco de Força mostrava repetições **e** carga — nas flexões também.

O que existe para desenhar isto são os treinos reais do fundador, e a taxonomia parte deles e de mais nada. O treino 01: **500 m de remo indoor, 10 flexões, 10 bicep com haltere, 500 m de corrida na passadeira, 5 push ups, 10 RDL**, quatro vezes. O treino 03: passadeira alternada com circuito. O treino 02: corrida na rua e circuito. O único nome alguma vez escrito na app do fundador foi **"bicep"**, na sessão de teste de 2026-09-18.

## Decisão

### 1. Dois eixos, e só um é novo

**O primeiro eixo já existe e não muda: o desporto do segmento** (`Sport`). É o que decide **como se grava** — com GPS ou sem ele, que máquina, que campos. O remo indoor e a passadeira **são desportos**, com os seus campos (ADR 0011 §2): não entram no catálogo de exercícios porque não precisam — um bloco de remo é remo, tenha ou não alguém escrito o nome.

**O segundo eixo é novo: o tipo de exercício** (`ExerciseKind`), e só existe dentro de um bloco de `strength`. Um tipo existe por **uma** razão: **decide que campos o bloco mostra.**

| Tipo | Campos | Exercícios reais do fundador |
|---|---|---|
| **Peso livre** (`free_weight`) | repetições, carga | bicep com haltere; RDL (ver pergunta 2) |
| **Peso do corpo** (`bodyweight`) | repetições | flexões; push ups |

E, pelo primeiro eixo, o que já existia:

| Desporto | Campos | Origem |
|---|---|---|
| **Remo indoor** (cardio em máquina) | metros, *split* da máquina (opcional; a app deriva o seu) | declarado |
| **Passadeira** (cardio em máquina) | km/h **ou** metros, o outro derivado do tempo do bloco | declarado |
| Corrida, caminhada, bicicleta (cardio na rua) | nenhum — a distância é medida | medido (GPS) |
| Natação em piscina, transição | nenhum | — |

**O que ficou de fora, e porquê.** *Máquina de musculação* teria os mesmos campos do peso livre (repetições e carga) e **nenhum treino real do fundador a usa**: um tipo que não muda os campos e não tem um exercício real por trás é uma etiqueta à espera de uso. Entra no dia em que houver um exercício que a peça — é uma linha em `EXERCISE_KINDS`. *Cardio* não é um tipo de exercício porque é o eixo do desporto. *Isométrico* (prancha: só tempo) não tem exercício real; e o tempo de um bloco já é medido pelo relógio da app, sem campo nenhum. **A distinção entre 70 kg de agachamento e 70 kg de prensa não é trabalho do tipo: é trabalho da identidade de exercício** — são dois exercícios, comparam-se cada um consigo.

**Um tipo é código; um exercício é um dado.** Os campos são código (validação, ficha, agregados), por isso um tipo novo é trabalho de programador, e é raro. Um exercício novo não pode ser.

### 2. O catálogo de partida são os exercícios reais, nas palavras do fundador

`packages/engine/src/exercises.ts`, `SEED_EXERCISES`: quatro entradas, cada uma com um identificador estável, o nome, o tipo e as outras grafias que querem dizer o mesmo.

| id | Nome | Tipo | Outras grafias |
|---|---|---|---|
| `flexoes` | Flexões | peso do corpo | flexão, flexões de braços |
| `push_ups` | Push ups | peso do corpo | push up, pushups, pushup |
| `bicep_haltere` | Bicep com haltere | peso livre | **bicep** (o que o fundador escreveu), biceps, bicep haltere, … |
| `rdl` | RDL | peso livre | romanian deadlift, peso morto romeno |

Os nomes comparam-se depois de **dobrados** (`foldExerciseName`): sem maiúsculas, **sem acentos** (o teclado do telemóvel a meio de um treino escreve "flexoes"), com hífenes, pontos e barras lidos como espaços. "Push-ups", "push ups" e "PUSH UPS" são um nome só.

**Não é uma lista de ginásio.** Não tem agachamento, supino nem elevações, porque o fundador não os fez. Cresce como nasceu: do que se treinou.

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

## Alternativas consideradas

- **Mais desportos em vez de um tipo** ("Peso do corpo" como nono desporto). Rejeitada: cada troca bicep → flexões passava a ser um `sport_changed`, um segmento novo e dois toques no Mudar, dentro de um circuito em que o fundador já não usa a Marca. O desporto decide como se grava; flexões e bicep gravam-se da mesma maneira.
- **Uma tabela `exercises` na base.** Rejeitada por agora: era uma segunda fonte de verdade ao lado dos eventos, com a sua migração e o seu apagamento, para guardar o que o registo já diz. Se a 4.5 precisar de exercícios que nunca foram usados, entram como menções do plano.
- **Guardar o id do catálogo no evento.** Rejeitada: amarrava a base a um catálogo de quatro entradas desenhado com um treino. O nome escrito é o facto; o id é interpretação.
- **Uma lista genérica de ginásio** (as ~100 entradas que qualquer app traz). Rejeitada pelo CTO no brief, e bem: metade dos nomes seria de exercícios que o fundador não faz, com tipos que ninguém verificou.
- **O tipo como texto livre.** Rejeitada: o tipo decide campos, e campos são código.

## Consequências

- A ficha de um bloco de exercícios mostra o nome, as sugestões do catálogo, as duas pílulas de tipo e **só os campos desse tipo**; as flexões deixam de pedir carga. Um bloco que muda de bicep para flexões limpa a carga (um `recorded` com `loadKg: null`; os 12,5 kg continuam no registo).
- `applyRecord` recusa uma carga num exercício de peso do corpo, como já recusava repetições num bloco de remo: é um engano, não um valor.
- **O rótulo "Força" do desporto não mudou.** A queixa do fundador é também sobre esse rótulo, mas mudar o nome de um dos oito botões do ecrã inicial é uma decisão de produto que não é minha (pergunta 3).
- Os planos de treino (4.5) referem exercícios por nome e tipo, resolvidos por `exerciseIdentity` — a mesma identidade que compara rondas compara o previsto com o feito.

## Perguntas para o fundador

1. **Flexões e push ups são o mesmo exercício?** No treino 01 aparecem como dois itens da mesma ronda (10 flexões, depois 5 push ups), e ficaram duas entradas. Se forem o mesmo, junta-se com uma grafia no catálogo e nenhuma linha da base muda.
2. **O RDL é com carga?** O fundador arruma-o em "não é força"; o texto do ADR 0011 dá-lhe 20 kg. Ficou como peso livre porque, entre um campo que pode ficar vazio e um campo que falta, o vazio não perde nada — e o fundador muda-o na ficha com um toque.
3. **"Força" continua a ser o nome do desporto?** Com a taxonomia, o bloco chama-se pelo exercício; o segmento e o botão do ecrã inicial continuam "Força". Alternativas: "Exercícios", "Circuito", "Ginásio". O identificador `strength` na base não muda em nenhum dos casos.
