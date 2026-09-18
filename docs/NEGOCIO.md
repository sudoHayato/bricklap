# Negócio

**Decisões do fundador, escritas pela primeira vez na sessão 22.** Até aqui só existiam nas conversas com o CTO. O que é produto e visão está em [`VISAO.md`](VISAO.md); o que é lei está em [`LEGAL.md`](../LEGAL.md); a sequência técnica está no [`ROADMAP.md`](../ROADMAP.md).

## Três etapas

1. **Validar se a app presta.** Com o dogfooding do próprio fundador, nos treinos dele ([`dogfooding/`](dogfooding/)). É a etapa em que o projeto está.
2. **Produto pequeno, sem investidores**, com **um primeiro utilizador externo**: um amigo que treina para o Ironman.
3. **Negócio a sério**: que dê dinheiro e cresça.

## Receita

- **Assinatura premium**, a explorar na etapa 3. Nada desenhado.
- **A monetização depende da autorização do empregador do fundador**, registada no [`LEGAL.md`](../LEGAL.md) como item lento, a tratar muito antes de haver receita.

## Social

- **Etapa 2: só social leve** — partilhar o treino como imagem e grupos privados.
- **Etapa 3: feed social público**, e não antes. Exige contas, servidor, moderação e massa crítica de utilizadores. É o que o [`ROADMAP.md`](../ROADMAP.md) já regista como "adiado, sem fase atribuída".

## Diferenciação

- **A combinação** de força + passadeira + remo + corrida na rua **na mesma sessão**. É isso que o Bricklap faz e as outras apps não fazem.
- **Não competir** com Hevy ou Strong no registo de força isolado, **nem com o Garmin**.
- **Onde a diferenciação vive, em concreto — o circuito híbrido de ginásio, não a corrida de rua —** está na "Leitura estratégica" no fim deste ficheiro (decisão do fundador, sessão 26).

## Referência de qualidade

- **O Strava** é a referência de qualidade assumida.
- **Sem copiar** — por receio legal e de perceção.

## Mercado

- **Objetivo global.** Inglês é a língua-base, com traduções; **por agora inglês e pt-PT chegam**.
- **Unidades**: métricas, e as dos EUA e do Reino Unido (as imperiais estão na Fase 6 do [`ROADMAP.md`](../ROADMAP.md)).

## Critério de continuar ou parar

Nas diretrizes do CTO é o critério da "Fase 1 (MVP)", que são as Fases 1 a 3 do [`ROADMAP.md`](../ROADMAP.md), já concluídas. O dogfooding que o mede corre na Fase 4, e é lá que o critério está escrito no roadmap ("Fase 4", "Critério de continuar ou parar").

Ao fim de **~6 semanas de dogfooding**:

- O fundador **escolhe o Bricklap** em vez do Strava ou do Garmin para os seus treinos híbridos?
- **As sessões longas sobrevivem** sem perder dados?

**Se não: pivotar ou parar — nunca acrescentar funcionalidades.**

O primeiro registo de dogfooding é o treino de 2026-09-14 ([`dogfooding/2026-09-14-treino-01.md`](dogfooding/2026-09-14-treino-01.md)). **A data a partir da qual contam as ~6 semanas não está decidida.** **Onde se mede** — no ginásio, no circuito, e não na corrida de rua — está na "Leitura estratégica" abaixo (decisão do fundador, sessão 26).

## Leitura estratégica (sessão 26, decisão do fundador, 2026-09-18)

**Decisões do fundador na sessão 26**, a partir do dogfooding ([`dogfooding/`](dogfooding/)) e do que o relógio e o Strava já fazem. Não é um pormenor da Fase 5: é a pergunta que decide o Bricklap.

- **O relógio é onde a maioria treina; o Strava é onde se publica. Uma app de telemóvel não é nenhum dos dois.** Esta é a pergunta que decide o Bricklap — não um pormenor de Fase 5 (relógio) a tratar mais tarde. Tudo o que vem abaixo é a resposta a esta pergunta.
- **O modo triatlo do Garmin não deteta nada.** Configura a sequência de desportos **antes** de começar, e em cada transição é o atleta que carrega no botão de lap. **O equivalente no Bricklap é o plano de treino** (4.5 do [`ROADMAP.md`](../ROADMAP.md)): com um plano, o Mudar propõe o bloco seguinte. **Não é preciso deteção automática por GPS** — seria lenta, e inútil em blocos de um minuto.
- **O diferenciador NÃO é fazer melhor o que o Garmin faz bem** — três desportos de resistência em sequência fixa. **É o circuito híbrido de ginásio, com rondas e valores por exercício**: aí o Garmin é fraco na contagem de repetições e não tem noção de circuito, e o Strava não regista nada.
- **Consequência para o teste das ~6 semanas** ("Critério de continuar ou parar", acima): **o dogfooding faz-se no ginásio, no circuito.** Na corrida de rua o relógio ganha sempre, e testar aí dá um **falso negativo** — o fundador abandonaria a app pelo suporte (o telemóvel contra o pulso), não pelo produto.
- **A importação de ficheiros FIT sobe de prioridade** no [`BACKLOG.md`](BACKLOG.md): o relógio grava, o Bricklap importa e acrescenta por cima as rondas, os valores e a estrutura. Dá os dados do relógio **sem escrever Monkey C**, e resolve a corrida de rua. Nesta sessão não se tocou em FIT nem em relógio — só se decidiu a prioridade.
