# ADR 0011 — Rondas e valores registados: proposta para o modelo de dados

**Estado**: **proposto** (continua proposto depois da sessão 20b — quem aceita é o fundador, na quarta). Escrito pelo CTO na sessão 20 (2026-09-14) a partir do primeiro dogfooding ([registo](../dogfooding/2026-09-14-treino-01.md)); revisto na sessão 20b (2026-09-14) com a identidade de exercício (secção 1b) e a correção da carga (secção 2). Não implementado; nada nestas duas sessões toca em código.

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

Os valores são opcionais e entram depois de o bloco fechar (introdução pós-treino), como já previsto em [docs/VISAO.md](../VISAO.md): "o problema difícil é a introdução de dados durante o treino, não o cálculo".

**Correção (sessão 20b): a carga não depende da taxonomia de exercícios, e a ordem estava invertida no relatório da sessão 20.** Carga é um número com unidade — grava-se sempre da mesma forma, venha o exercício a chamar-se "peso livre", "peso do corpo" ou outra coisa qualquer; 10 RDL a 20 kg são 10 RDL a 20 kg independentemente do nome da categoria. O que a taxonomia de exercícios (BACKLOG) decide é **quais exercícios mostram o campo carga na interface** — um push up sem peso externo não o mostra, um RDL com haltere mostra — e isso é decisão de interface, não do modelo de dados. Por isso a carga saiu da lista de pontos por decidir abaixo.

### 3. Declarado vs. medido, separados desde o primeiro dia

Uma distância que o atleta escreveu à mão não é uma distância de GPS, e as duas não podem cair no mesmo campo nem no mesmo total sem se distinguirem. Se uma corrida de rua (GPS, **medida**) e uma corrida na passadeira (velocidade × tempo, **declarada**) somarem para o mesmo total sem marca, o primeiro recorde pessoal de distância já nasce falso — e a distinção não se pode acrescentar depois sem reescrever o histórico gravado até aí. Cada valor introduzido pelo atleta leva a origem (`declared` vs `measured`) desde a primeira linha do esquema que os grava.

### 4. Agregados: média de pace é tempo total sobre distância total

Quando houver mais do que um troço a combinar (por exemplo, o ritmo médio de todas as rondas de corrida numa sessão), a média é:

```
pace_médio = tempo_total / distância_total
```

**nunca** a média aritmética dos paces de cada ronda (`(pace_1 + pace_2 + … + pace_n) / n`). As duas divergem sempre que as rondas têm distâncias diferentes, e divergem na direção errada — a média aritmética pesa igual uma ronda de 200 m e uma de 500 m, escondendo exatamente a ronda mais lenta que o atleta quer ver. O motor já faz isto para o ritmo médio de um segmento (`recentMetrics`, ADR 0009); a mesma regra sobe para o agregado entre rondas.

## O que falta decidir na quarta (2026-09-17)

Revisto na sessão 20b: o ponto sobre a taxonomia de exercícios saiu de aqui — a carga não depende dela (ver "Correção" na secção 2 acima), e o índice de posição já não é uma dúvida em aberto, ficou resolvido como identidade de exercício (secção 1b). Ficam três pontos, todos do fundador:

1. **Aceitar, ajustar ou rejeitar** o marcador de ronda como evento, com identidade de exercício (pontos 1 e 1b).
2. **Os campos exatos por desporto** (ponto 2) — a lista acima é a leitura do CTO do que o fundador pediu no dogfooding, não um levantamento exaustivo.
3. **Ordem de implementação**: este ADR antes ou depois de outra prioridade da Fase 4 (ver ROADMAP).

A taxonomia de exercícios (peso puro vs. peso do corpo) continua a decidir-se em separado, como item de interface no BACKLOG — não bloqueia este ADR.

## Alternativas consideradas

- **HIIT/AMRAP como desporto próprio.** Rejeitado: mistura formato com desporto (ver ponto 1); um treino "HIIT com remo e passadeira" deixaria de ser remo e passadeira.
- **Ronda como entidade na base, ao lado de sessão/evento/segmento.** Rejeitado por agora: o motor não guarda nada além de eventos (regra do `CLAUDE.md`); uma entidade nova furaria essa regra sem necessidade, quando um marcador de evento resolve com a mesma garantia de replay puro.
- **Um só campo de distância, sem `declared`/`measured`.** Rejeitado: é a alternativa mais barata a curto prazo e a mais cara a longo prazo — corrige-se só reescrevendo histórico (ponto 3).
