# ADR 0011 — Rondas e valores registados: proposta para o modelo de dados

**Estado**: **proposto**. Escrito pelo CTO na sessão 20 (2026-09-14) a partir do primeiro dogfooding ([registo](../dogfooding/2026-09-14-treino-01.md)), para o fundador decidir. Não implementado; nada nesta sessão toca em código.

## Contexto

O primeiro treino a sério do fundador na app — HIIT, 4 rondas de 6 exercícios sem descanso — mostrou três faltas ao mesmo tempo: a app não sabe o que é uma ronda, não há forma de registar valores (metros, repetições, carga, velocidade), e a etiqueta "Força" mistura peso puro com peso do corpo. Esta proposta cobre as duas primeiras, que são modelo de dados; a terceira é taxonomia e fica no BACKLOG.

## Decisão proposta

### 1. A ronda é um evento, não uma entidade nova

O motor grava um **marcador de ronda** no registo de eventos e deriva as rondas dele, exatamente como já deriva os segmentos a partir de `started`/`sport_changed`/`stopped`. Os eventos continuam a ser a única fonte de verdade; nada de ronda persiste fora do *stream* de eventos.

**Porquê não um desporto, nem uma entidade separada**: HIIT e AMRAP são **formatos** de treino — como a sessão está organizada — não **desportos** — o que se faz. São dois eixos diferentes: um bloco de remo é remo, esteja ou não dentro de uma ronda; o mesmo bloco de remo fora de um HIIT continua a ser remo. Meter o formato dentro do desporto mistura os dois eixos e obriga a um desporto "remo-em-HIIT" ao lado de "remo" — um remendo que não se tira depois sem migrar dados. Um marcador de ronda, ortogonal ao desporto, mantém os dois eixos separados: `segmentsFromEvents` continua a responder "o que se fez", e uma nova `roundsFromEvents` responde "como estava organizado".

### 2. Valores por bloco, com campos por desporto

Um bloco passa a poder levar valores, específicos do desporto do segmento:

- **Remo**: metros, *split* médio (ritmo por 500 m).
- **Passadeira**: km/h, ou distância.
- **Exercícios de peso** (a taxonomia fica por decidir, ver BACKLOG): repetições, carga.

Os valores são opcionais e entram depois de o bloco fechar (introdução pós-treino), como já previsto em [docs/VISAO.md](../VISAO.md): "o problema difícil é a introdução de dados durante o treino, não o cálculo".

### 3. Declarado vs. medido, separados desde o primeiro dia

Uma distância que o atleta escreveu à mão não é uma distância de GPS, e as duas não podem cair no mesmo campo nem no mesmo total sem se distinguirem. Se uma corrida de rua (GPS, **medida**) e uma corrida na passadeira (velocidade × tempo, **declarada**) somarem para o mesmo total sem marca, o primeiro recorde pessoal de distância já nasce falso — e a distinção não se pode acrescentar depois sem reescrever o histórico gravado até aí. Cada valor introduzido pelo atleta leva a origem (`declared` vs `measured`) desde a primeira linha do esquema que os grava.

### 4. Agregados: média de pace é tempo total sobre distância total

Quando houver mais do que um troço a combinar (por exemplo, o ritmo médio de todas as rondas de corrida numa sessão), a média é:

```
pace_médio = tempo_total / distância_total
```

**nunca** a média aritmética dos paces de cada ronda (`(pace_1 + pace_2 + … + pace_n) / n`). As duas divergem sempre que as rondas têm distâncias diferentes, e divergem na direção errada — a média aritmética pesa igual uma ronda de 200 m e uma de 500 m, escondendo exatamente a ronda mais lenta que o atleta quer ver. O motor já faz isto para o ritmo médio de um segmento (`recentMetrics`, ADR 0009); a mesma regra sobe para o agregado entre rondas.

## O que fica por decidir para o fundador (quarta, 2026-09-17)

1. **Aceitar, ajustar ou rejeitar** o marcador de ronda como evento (ponto 1).
2. **Os campos exatos por desporto** (ponto 2) — a lista acima é a leitura do CTO do que o fundador pediu no dogfooding, não um levantamento exaustivo.
3. **A taxonomia de exercícios** (peso puro vs. peso do corpo) é decisão de produto separada, no BACKLOG — mas condiciona os campos deste ADR (carga só faz sentido em peso puro).
4. **Ordem de implementação**: este ADR antes ou depois de outra prioridade da Fase 4 (ver ROADMAP).

## Alternativas consideradas

- **HIIT/AMRAP como desporto próprio.** Rejeitado: mistura formato com desporto (ver ponto 1); um treino "HIIT com remo e passadeira" deixaria de ser remo e passadeira.
- **Ronda como entidade na base, ao lado de sessão/evento/segmento.** Rejeitado por agora: o motor não guarda nada além de eventos (regra do `CLAUDE.md`); uma entidade nova furaria essa regra sem necessidade, quando um marcador de evento resolve com a mesma garantia de replay puro.
- **Um só campo de distância, sem `declared`/`measured`.** Rejeitado: é a alternativa mais barata a curto prazo e a mais cara a longo prazo — corrige-se só reescrevendo histórico (ponto 3).
