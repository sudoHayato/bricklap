# ADR 0011 — Rondas e valores registados: o modelo de dados

**Estado**: **aceite** — decisão do fundador, 2026-09-18 (sessão 26). Escrito pelo CTO na sessão 20 (2026-09-14) a partir do primeiro dogfooding ([registo](../dogfooding/2026-09-14-treino-01.md)); revisto na sessão 20b (2026-09-14) com a identidade de exercício (secção 1b) e a correção da carga (secção 2), e na sessão 22b (2026-09-14) com as duas portas para os valores (secção 2a). **Aceite pelo fundador na sessão 26 com os seis pontos abaixo, e implementado no motor e na app nessa mesma sessão** ([relatório](../reports/2026-09-18-sessao-26.md)). O texto da proposta fica como estava, a seguir, para se perceber o caminho.

## Decisão (aceite pelo fundador, 2026-09-18)

O fundador aprovou as três decisões do CTO e as duas propostas da equipa de desenvolvimento, mais o agregado. Os seis pontos, tal como valem a partir daqui:

1. **A ronda é um evento, com identidade de exercício.** Não é entidade nova, não é desporto. A comparação entre rondas faz-se **pelo identificador do exercício, nunca pela posição** — se o atleta saltar um exercício, a posição mente. A posição pode guardar-se, mas só como dado descritivo. *No motor:* `round_started` no registo de eventos; `roundsFromEvents` deriva as rondas e cada bloco leva `round` (ou `null` antes da primeira ronda); o exercício viaja no evento `recorded` e `exerciseAcrossRounds` compara por ele.
   **1a. A ronda 1 abre com o Iniciar — decisão do CTO, sessão 27 (2026-09-19).** O teste do fundador na sessão 26 carregou em Nova ronda 6 s depois do Iniciar, porque a primeira ronda tinha de se abrir à mão, e ficou um bloco de 6 s sem ronda — num treino real acontecia sempre. Das duas saídas, **não** é a ronda a absorver blocos curtos: um limiar de duração é um número arbitrário que morde um dia (um bloco legítimo de 4 s desaparecia). **É a sessão que nasce na ronda 1**: `createLiveSession` escreve `started` e `round_started` no mesmo instante, e o marcador, por cair em cima do bloco acabado de abrir, marca-o em vez de o partir. O botão passa a dizer a ronda que abre ("Nova ronda · 2"). **Sem casos-limite:** um marcador que não vem *depois* da ronda já aberta é essa ronda dita duas vezes e não abre nada (regra de ordem, na derivação, sem duração nenhuma); um Nova ronda em cima do Iniciar não se escreve (`ROUND_DEDUPE_MS`, que guarda a *escrita* — um toque que não se escreve não perde nada — e nunca a leitura); nenhuma ronda fica sem blocos (teste de propriedade sobre 300 sequências de toques). **As sessões anteriores não têm o marcador e leem-se como sempre, sem rondas** — provado sobre a base real ([relatório da sessão 27](../reports/2026-09-19-sessao-27.md)).
2. **Campos por desporto.** **Remo: metros.** O ritmo médio que a máquina mostra entra como campo opcional; a app calcula o *split* a partir dos metros e do tempo. Não é velocidade — as máquinas de remo dão metros e *split* /500 m. **Passadeira: km/h OU distância**; a app calcula o outro com o tempo do bloco. **Exercícios: repetições e carga.** *No motor:* `VALUE_FIELDS_BY_SPORT`; `blockFigures` deriva o que falta e marca-o como derivado.
3. **Declarado vs. medido, separados na base desde o primeiro dia.** Uma distância que o atleta escreveu não é uma distância de GPS. Se entrarem no mesmo total, o primeiro recorde pessoal é falso; acrescentar isto depois obrigava a reescrever o histórico. *No motor e na base:* cada `recorded` leva `origin` (`declared` | `measured`); tudo o que vem de amostras GPS é medido por construção; `distanceTotals` devolve os dois totais e nunca um só.
   **3a. Qualquer valor derivado de um declarado mostra-se como declarado — regra do CTO, sessão 27 (2026-09-19).** Vale para o ritmo, para a distância, para o *split*, para a velocidade e para tudo o que venha a existir. No teste da sessão 26 o ritmo do remo no "Por desporto" saiu de 450 m declarados e apareceu com o aspeto de um ritmo medido por GPS — a aresta mais séria das três, porque é silenciosa. A distinção está na base desde o primeiro dia precisamente para o primeiro recorde pessoal não ser falso; se a interface a apaga, a base não serviu de nada. *No motor:* `derivedOrigin` é a regra numa função — basta uma entrada declarada para o resultado ser declarado — e todas as derivações passam por ela; `aggregateBySport` deixou de ter um ritmo por desporto e passou a ter **dois totais por origem** (`measured` e `declared`, cada um com os seus metros, o seu tempo e o seu ritmo), sem nenhum campo onde os dois se somem. *Na app:* a marca "decl." ao lado de cada valor declarado ou derivado de um declarado ([DESIGN.md §6](../DESIGN.md), "Valor declarado"). **O caso misto** — GPS e declarado na mesma sessão, o treino 02 do fundador — **não tem total único**: duas linhas, "medidos" e "declarados" (proposta A do relatório da sessão 27, **aceite pelo fundador**).

   **Extensão aos totais semanais e ao histórico (decisão do fundador, sessão 27): dois contadores, nunca um.** O que vale para o total de uma sessão vale para a semana, o mês, o total de sempre e qualquer lista de recordes que venha a existir: **cada agregado tem um contador medido e um contador declarado, e nunca um terceiro campo onde os dois se somem.** A razão é a que fez a regra nascer: **a única forma de um total nunca falsificar um recorde é não haver total.** Um recorde de distância semanal que somasse 20 km de GPS e 8 km de uma passadeira declarada seria um número que ninguém mediu; e, uma vez calculado e mostrado, não há como desmisturá-lo sem reescrever o que o atleta viu. Um recorde compara-se dentro do seu contador — o melhor medido com o melhor medido, o melhor declarado com o melhor declarado — e a app diz qual dos dois está a mostrar. Quem construir os totais semanais e o histórico (4.5 e seguintes) parte daqui: se o tipo do agregado não tiver os dois contadores, está errado.
4. **As duas portas** (proposta da equipa de desenvolvimento, aceite): registar **durante** o treino, bloco a bloco, **e** poder completar ou corrigir **no fim**. Razão: os números da passadeira e do remo estão no mostrador da máquina e desaparecem quando se sai dela. *No motor:* `applyRecord` é a única escrita e aceita-se numa sessão viva e numa sessão parada — o único evento aceite depois de `stopped`.
5. **Vale o último valor registado** (proposta da equipa de desenvolvimento, aceite): a correção acrescenta um evento novo, nunca reescreve o anterior. *No motor:* `blockRecords` faz o replay por campo, o último ganha, os anteriores ficam no registo; `null` limpa um campo.
6. **Agregados:** a média de ritmo é **tempo total a dividir por distância total**, nunca a média aritmética dos ritmos de cada ronda. *No motor:* `paceSecPerKm` e `aggregateBySport`, com o teste que fixa a diferença entre as duas fórmulas.

**Na base** (esquema v4): uma coluna `payload TEXT` na tabela de eventos, `NULL` em todas as linhas anteriores e em todas as que não sejam `recorded`; nenhuma linha antiga muda. Provado sobre a base real do telemóvel do fundador na sessão 26.

**O que ficou de fora, de propósito:** a interface das duas portas é desenho, não modelo (a sessão 26 fez a mínima: a ficha de valores no ecrã de gravação e no resumo); a taxonomia de exercícios ficou no BACKLOG na sessão 26 e **entrou na sessão 27, no [ADR 0012](0012-taxonomia-de-exercicios.md)** — o que se guarda continua a ser o nome escrito, resolvido contra o catálogo ao ler; a natação em piscina não tem campos; a importação de valores medidos por um dispositivo (FIT) usa o mesmo evento com `origin: "measured"`, mas não existe ainda.

---

## A proposta, como foi escrita (sessões 20 a 22b)

## Contexto

O primeiro treino a sério do fundador na app — HIIT, 4 rondas de 6 exercícios sem descanso — mostrou três faltas ao mesmo tempo: a app não sabe o que é uma ronda, não há forma de registar valores (metros, repetições, carga, velocidade), e a etiqueta "Força" mistura peso puro com peso do corpo. Esta proposta cobre as duas primeiras, que são modelo de dados; a terceira é taxonomia e fica no BACKLOG.

## Decisão proposta

### 1. A ronda é um evento, não uma entidade nova

O motor grava um **marcador de ronda** no registo de eventos e deriva as rondas dele, exatamente como já deriva os segmentos a partir de `started`/`sport_changed`/`stopped`. Os eventos continuam a ser a única fonte de verdade; nada de ronda persiste fora do *stream* de eventos.

**Porquê não um desporto, nem uma entidade separada**: HIIT e AMRAP são **formatos** de treino — como a sessão está organizada — não **desportos** — o que se faz. São dois eixos diferentes: um bloco de remo é remo, esteja ou não dentro de uma ronda; o mesmo bloco de remo fora de um HIIT continua a ser remo. Meter o formato dentro do desporto mistura os dois eixos e obriga a um desporto "remo-em-HIIT" ao lado de "remo" — um remendo que não se tira depois sem migrar dados. Um marcador de ronda, ortogonal ao desporto, mantém os dois eixos separados: `segmentsFromEvents` continua a responder "o que se fez", e uma nova `roundsFromEvents` responde "como estava organizado".

### 1b. Comparar blocos entre rondas por identidade de exercício, nunca por posição

Uma dúvida da sessão 20 (relatório, §5) apontava um furo real por uma solução errada: identificar "o terceiro bloco da ronda" por um índice de posição parte-se pela mesma razão que motivou a dúvida — se o atleta salta ou acrescenta um exercício numa ronda, o terceiro bloco deixa de ser o mesmo exercício, e comparar "flexões da ronda 2" com "flexões da ronda 4" pela posição compara coisas diferentes.

**Correção (sessão 20b): o evento carrega uma identidade de exercício.** As flexões da ronda 2 e as da ronda 4 são o mesmo bloco comparável porque partilham essa identidade (um identificador do exercício, não uma casa numa lista) — não porque caem na mesma posição dentro da ronda. Com isto, uma ronda pode ter seis, cinco ou sete blocos, em qualquer ordem, e a comparação entre rondas continua a funcionar sem se partir.

**O índice de posição pode guardar-se — como informação descritiva, nunca como chave de comparação.** Serve para mostrar a ordem em que o atleta fez os exercícios nessa ronda em concreto; nunca para decidir que dois blocos são "o mesmo bloco" entre rondas diferentes. Fica explícito para não voltar a propor-se como atalho: é a solução óbvia e é a errada, porque resolve "onde estava" em vez de "o que era".

Isto não muda o princípio do ADR: a identidade de exercício é só mais um campo do evento, e continua tudo a derivar do *stream* de eventos, sem entidade nova.

### 2. Valores por bloco, com campos por desporto

Um bloco passa a poder levar valores, específicos do desporto do segmento:

- **Remo**: metros, *split* médio (ritmo por 500 m).
- **Passadeira**: km/h, ou distância.
- **Exercícios**: repetições, carga.

Os valores são opcionais.

**Correção (sessão 20b): a carga não depende da taxonomia de exercícios, e a ordem estava invertida no relatório da sessão 20.** Carga é um número com unidade — grava-se sempre da mesma forma, venha o exercício a chamar-se "peso livre", "peso do corpo" ou outra coisa qualquer; 10 RDL a 20 kg são 10 RDL a 20 kg independentemente do nome da categoria. O que a taxonomia de exercícios (BACKLOG) decide é **quais exercícios mostram o campo carga na interface** — um push up sem peso externo não o mostra, um RDL com haltere mostra — e isso é decisão de interface, não do modelo de dados. Por isso a carga saiu da lista de pontos por decidir abaixo.

### 2a. Duas portas para os valores: durante o treino E no fim

**Correção (sessão 22b).** A primeira versão deste ADR dizia que os valores entravam só depois de o bloco fechar. Estava errado, e a divergência foi apanhada no teste final da sessão 22. O fundador precisa das **duas portas**, como as tem no Garmin:

1. **Durante o treino, bloco a bloco** — o atleta regista o valor enquanto ainda o tem à frente.
2. **No fim** — completa o que ficou por registar e corrige o que registou mal.

**A razão, e é ela que impede que isto se simplifique daqui a três meses:** os números da passadeira e do remo **estão no mostrador da máquina e desaparecem quando o atleta sai dela**. Quem não os registar na hora **perde o dado para sempre** — não há registo de onde os recuperar no fim. Uma app só com a porta do fim serve para repetições e carga, que o atleta se lembra; não serve para metros de remo, *split* ou velocidade da passadeira, que são exatamente os valores que o fundador pediu no [dogfooding](../dogfooding/README.md). E uma app só com a porta de durante obriga a acertar tudo à primeira, a meio de um circuito, sem forma de corrigir.

**Consequência para o modelo:** as duas portas escrevem da mesma maneira — **um valor é um evento acrescentado ao registo**, ligado ao bloco a que pertence (e, por ele, à identidade de exercício da secção 1b). Completar ou corrigir no fim **acrescenta um evento novo; nunca reescreve o anterior** ([ADR 0006](0006-persistencia-sqlite-append-only.md), append-only; [BACKLOG](../BACKLOG.md), "Edição pós-treino"). O valor que vale deriva-se por replay, como tudo o resto — a proposta é o último registado para cada campo do bloco (por decidir, ver abaixo). A origem (`declared` / `measured`, secção 3) não muda por o valor ter entrado durante ou no fim: um metro de remo escrito à mão é declarado nas duas portas.

**O que este ADR não decide:** a interface de nenhuma das portas — como se regista durante o treino sem tirar tempo ao circuito (no telemóvel, ou no relógio da Fase 5) é desenho, não modelo de dados. O modelo só garante que as duas escrevem no mesmo sítio e que nenhuma apaga a outra.

### 3. Declarado vs. medido, separados desde o primeiro dia

Uma distância que o atleta escreveu à mão não é uma distância de GPS, e as duas não podem cair no mesmo campo nem no mesmo total sem se distinguirem. Se uma corrida de rua (GPS, **medida**) e uma corrida na passadeira (velocidade × tempo, **declarada**) somarem para o mesmo total sem marca, o primeiro recorde pessoal de distância já nasce falso — e a distinção não se pode acrescentar depois sem reescrever o histórico gravado até aí. Cada valor introduzido pelo atleta leva a origem (`declared` vs `measured`) desde a primeira linha do esquema que os grava.

### 4. Agregados: média de pace é tempo total sobre distância total

Quando houver mais do que um troço a combinar (por exemplo, o ritmo médio de todas as rondas de corrida numa sessão), a média é:

```
pace_médio = tempo_total / distância_total
```

**nunca** a média aritmética dos paces de cada ronda (`(pace_1 + pace_2 + … + pace_n) / n`). As duas divergem sempre que as rondas têm distâncias diferentes, e divergem na direção errada — a média aritmética pesa igual uma ronda de 200 m e uma de 500 m, escondendo exatamente a ronda mais lenta que o atleta quer ver. O motor já faz isto para o ritmo médio de um segmento (`recentMetrics`, ADR 0009); a mesma regra sobe para o agregado entre rondas.

### 5. A Marca por toque simples, com "Anular" — proposta do CTO, aceite em 2026-09-19 (sessão 28); **por implementar, é trabalho de motor**

**Decisão.** A Marca passa de premir e manter (500 ms, desde a sessão 14) a **toque simples**, e ganha um **"Anular" de 5 segundos** que escreve um evento compensatório, `mark_cancelled`, no mesmo padrão do `round_cancelled` que a sessão 27 apontou para o Nova ronda (relatório 27, §9.3: ainda não existe nenhum dos dois). **O Parar mantém o gesto longo**, porque é destrutivo. **Até esta proposta ser implementada, fica o premir.** Dois gestos para o mesmo botão (toque na rua, premir no interior) foi considerado e rejeitado: é pior do que qualquer um deles.

**Porquê — o argumento que decide, e que não se perde.** A razão escrita na sessão 14 para o premir foi o custo do erro: "uma marca não se desfaz, e um toque acidental parte um bloco em dois sem ninguém dar por isso". Essa conta tinha **dois erros possíveis e só pesou um**. Um botão que se dispara ao premir tem os dois:

| | Marca **falsa** (toque acidental) | Marca **perdida** (o premir não chegou ao fim) |
|---|---|---|
| O que acontece | um bloco partido em dois | dois blocos fundidos num só |
| Vê-se no momento? | **sim**: o contador de marcas sobe e entra uma linha na lista | **só se se estiver a olhar para o anel**; quem larga o telemóvel a meio do gesto não vê nada |
| O que se perde | **nada**: os dois pedaços somados são o bloco, e os valores registam-se num deles | **informação que não se recupera**: o segundo exercício não tem bloco onde registar valores, e os tempos dos dois ficam num número só |
| Quem o provoca | telemóvel no bolso com o ecrã ligado; gotas de suor no vidro | mãos suadas, pressa, 500 ms a parecerem uma eternidade entre séries |

A marca perdida é o erro **mais caro e mais provável** no uso do fundador (circuito no ginásio, telemóvel no banco, mãos molhadas), e é precisamente o que o premir favorece. Os registos 02 e 03 mostram "o circuito inteiro num bloco só" e "cinco rondas em dez blocos"; a base não diz se foi o gesto que falhou ou se o fundador não marcou, por isso **isto não conta como prova** — é o padrão que uma Marca difícil de disparar produziria, e a pergunta ao fundador continua aberta. **O que não mudou desde a sessão 14** é que a marca continua sem se desfazer; é por isso que a proposta não é o toque sozinho: com o telemóvel no bolso numa corrida, o suor no vidro gera toques fantasma e cada um ficava no registo para sempre. O Anular converte o erro raro e barato (marca falsa) em algo que se desfaz, e retira ao erro caro (marca perdida) a sua causa.

**Riscos de cada lado.**
- *Ficar no premir*: continuar a perder marcas sem dar por isso — perder o treino que se queria gravar.
- *Toque simples sem Anular*: marcas fantasma permanentes nas sessões de rua.
- *Toque simples com Anular*: mais um evento no motor e 5 s de uma linha nova no ecrã de gravação; a marca fantasma de quem não está a olhar continua a existir, mas deixa de ser o erro mais provável e passa a ser o mais barato.

**O desenho, para a sessão que tocar no motor.**
1. **Um toque marca.** A face do botão afunda, o contador sobe e o telemóvel vibra. O anel que hoje se desenha ao longo dos 500 ms deixa de existir na Marca (fica no Parar).
2. **Durante 5 s**, por cima das ações, uma linha "Marca feita · **Anular**" com 56 px de alvo. Anular escreve `mark_cancelled`.
3. **Uma guarda de escrita** contra o duplo toque, como a dos 2000 ms da ronda: guarda a *escrita*, nunca a leitura.
4. **A derivação é de ordem, como a das rondas — sem limiar de duração.** Um `mark_cancelled` só conta se vier **imediatamente a seguir** ao `marked` a que responde, sem nenhum outro evento de sessão pelo meio; senão é ignorado. A interface só oferece o Anular enquanto isso for verdade: o Anular desaparece aos 5 s **ou** no momento em que qualquer outro evento se escreve (um valor, uma ronda, um Mudar, outra marca). Isto fecha o caso que o tempo sozinho deixaria aberto: registar valores no bloco novo e depois anular a marca deixaria o `recorded` a apontar para um bloco que já não existe. Cancelada a marca, os dois blocos voltam a ser um, com o tempo somado.
5. **Nada se reescreve**: o `marked` e o `mark_cancelled` ficam ambos na base, e as sessões antigas — que não têm `mark_cancelled` — leem-se exatamente como hoje.

**Por decidir (do fundador):** nos treinos 02 e 03, tentaste marcar e a Marca não pegou, ou não marcaste? A resposta diz se o problema é o gesto ou o hábito.

## O que faltava decidir na quarta (2026-09-17) — decidido na sessão 26, ver "Decisão" acima

Revisto na sessão 20b: o ponto sobre a taxonomia de exercícios saiu de aqui — a carga não depende dela (ver "Correção" na secção 2 acima), e o índice de posição já não é uma dúvida em aberto, ficou resolvido como identidade de exercício (secção 1b). Na sessão 22b entrou o ponto 2a, das duas portas. Ficam quatro pontos, todos do fundador:

1. **Aceitar, ajustar ou rejeitar** o marcador de ronda como evento, com identidade de exercício (pontos 1 e 1b).
2. **Os campos exatos por desporto** (ponto 2) — a lista acima é a leitura do CTO do que o fundador pediu no dogfooding, não um levantamento exaustivo.
2a. **As duas portas** (secção 2a, sessão 22b): confirmar que o modelo as prevê as duas, e a regra de qual valor vale quando um bloco tem mais do que um — a proposta é o último registado, sem apagar os anteriores. É um detalhe acrescentado pela equipa de desenvolvimento na 22b, não pelo CTO; o CTO manteve-o na sessão 22c como proposta, por ser coerente com o append-only (a correção acrescenta um evento, não reescreve o anterior).
3. **Ordem de implementação**: este ADR antes ou depois de outra prioridade da Fase 4 (ver ROADMAP).

A taxonomia de exercícios (peso puro vs. peso do corpo) continua a decidir-se em separado, como item de interface no BACKLOG — não bloqueia este ADR.

## Alternativas consideradas

- **HIIT/AMRAP como desporto próprio.** Rejeitado: mistura formato com desporto (ver ponto 1); um treino "HIIT com remo e passadeira" deixaria de ser remo e passadeira.
- **Ronda como entidade na base, ao lado de sessão/evento/segmento.** Rejeitado por agora: o motor não guarda nada além de eventos (regra do `CLAUDE.md`); uma entidade nova furaria essa regra sem necessidade, quando um marcador de evento resolve com a mesma garantia de replay puro.
- **Só a porta do fim (introdução pós-treino).** Era a primeira versão deste ADR. Rejeitado na sessão 22b: os números das máquinas desaparecem quando o atleta sai delas, e a porta do fim não os consegue recuperar (secção 2a).
- **Corrigir um valor reescrevendo o anterior.** Rejeitado: fura o append-only do ADR 0006 e apaga o que o atleta registou na hora; a correção é um evento novo (secção 2a).
- **Um só campo de distância, sem `declared`/`measured`.** Rejeitado: é a alternativa mais barata a curto prazo e a mais cara a longo prazo — corrige-se só reescrevendo histórico (ponto 3).
