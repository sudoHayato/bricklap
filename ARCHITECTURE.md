# Arquitetura

## Modelo de dados

```
amostras (GPS ou simulador)  →  eventos  →  segmentos (derivados)  →  métricas
```

- **`Session`** — `id`, `createdAt`, `status` (`live` | `stopped`), `events[]`, `samples[]`.
- **`SessionEvent`** — `started {at, sport}`, `sport_changed {at, sport}`, `marked {at}` (Marca, Fase 4), `round_started {at}` e `recorded {at, block, origin, exercise?, kind?, values}` (rondas e valores, ADR 0011, sessão 26; o `kind` é o tipo de exercício do ADR 0012, sessão 27), `stopped {at}`, `recovered {at}`. É o registo de verdade: nada derivado é guardado.
- **`Sample`** — `t`, `lat`, `lng`, `speedMps`, `source` (`sim` | `gps`), `accuracyM?` (precisão horizontal reportada pelo provider, em metros; ausente quando desconhecida — simulador, fixes anteriores ao esquema v2; ADR 0009).
- **`Segment`** — derivado: `index`, `sport`, `startAt`, `endAt | null` (aberto), `sampleStart`, `sampleEnd`.
- **`Block`** — derivado: um troço de um segmento entre duas Marcas (ou fronteiras de ronda), com `index`, `segmentIndex`, `sport`, `startAt`, `endAt | null` e `round | null`.
- **`Round`** — derivada de `round_started`: `index`, `startAt`, `endAt | null`. **Desde a sessão 27 a ronda 1 abre com a sessão** (`createLiveSession` escreve `started` e `round_started` no mesmo instante), por isso todo o bloco de uma sessão nova tem ronda; numa sessão anterior os blocos antes da primeira ronda têm `round: null`, e uma sessão sem marcadores não tem rondas.
- **Exercício** (ADR 0012) — um dado, não código: `CatalogExercise {id, name, kind, spellings: {pt, en}, seed}`. O catálogo de partida (`SEED_EXERCISES`) são os exercícios reais do fundador e os pares pt/en que ele vai escrever (flexões = push ups, barras = pull ups, …), já ligados; `exerciseTotalsByRound` soma o mesmo exercício escrito de duas maneiras; o do atleta deriva-se do registo (`catalogFromMentions`). O **tipo** (`ExerciseKind`: `free_weight`, `bodyweight`) é código, porque decide os campos de um bloco de `strength` (`VALUE_FIELDS_BY_KIND`).
- **Valores de um bloco** (ADR 0011): cada `recorded` leva o bloco a que pertence, a **origem** (`ValueOrigin`: `declared` — o atleta escreveu — ou `measured` — um dispositivo mediu), uma identidade de exercício opcional e os campos do desporto (`VALUE_FIELDS_BY_SPORT`: remo `meters` e `splitS`; passadeira `speedKmh` e `meters`; força `reps` e `loadKg`; os desportos com GPS e a piscina não têm campos declarados). `BlockRecord` é o replay: o último valor de cada campo, com a sua origem; `null` limpa. `blockFigures` acrescenta o derivado (o split a partir dos metros e do tempo; na passadeira, o campo que falta a partir do outro e do tempo).
- **`SegmentMetrics`** — `durationMs`, `distanceM`, `avgSpeedMps`.
- **`Sport`** — com GPS: `run`, `bike`, `walk`, `transition`; sem GPS (só tempo, ADR 0008): `strength`, `rowing_indoor`, `treadmill`, `swimming_pool`. `SPORT_HAS_GPS` / `sportHasGps` diz se o desporto tem feed de posição e `SPORT_PACE_KIND` qual o tipo de ritmo (lógica de domínio). Os rótulos visíveis (`"Run"`, `"Corrida"`, …) não estão no motor — vêm de `@bricklap/i18n`, indexados pelo próprio `Sport`.

## Invariantes do motor

1. Só `started`, `sport_changed` e `stopped` criam, fecham ou alteram segmentos. `recovered` é informativo.
2. Segmentos são contíguos: `endAt` de um é `startAt` do seguinte.
3. Atribuição de amostras a segmentos (`samplesBetween`) usa **limites inclusivos** e, quando nenhuma amostra real cai exatamente na fronteira mas há amostras dos dois lados, **interpola** uma amostra nesse instante. Assim um troço que atravessa a mudança de desporto é repartido pelos dois segmentos (não se perde), e a soma das distâncias dos segmentos iguala a distância da sessão seja qual for a cadência do GPS.
3a. **Um segmento de um desporto sem GPS não tem amostras** (`samplesForSegment` devolve `[]`, distância 0, velocidade 0), mesmo que existam amostras no seu intervalo. E a interpolação **nunca atravessa** um desses segmentos: para um segmento com GPS, só contam as amostras do troço contíguo de segmentos com GPS a que pertence (`gpsSpan`). A distância da sessão é a **soma** das distâncias dos segmentos, por isso obedece às mesmas regras (ADR 0008).
4. `distanceMeters` ignora um troço cuja velocidade implícita exceda **55 m/s** (`MAX_PLAUSIBLE_SPEED_MPS`, teletransporte GPS); com timestamps iguais ou invertidos usa um mínimo de 1 ms, o que também descarta troços fora de ordem. **Não há outro filtro**: a precisão viaja com a amostra mas não muda a distância (decidido com dados de campo, ADR 0009).
4a. `recentMetrics` dá as métricas dos **últimos 30 s** (`RECENT_WINDOW_MS`) de um segmento — o "ritmo atual" — com a janela cortada ao início do segmento e presa pela mesma cerca da regra 3a. Uma paragem é uma janela quase sem distância; os formatadores escrevem "—" abaixo de 20 m.
5. `applyRecovered` não repete um `recovered` a menos de **2000 ms** (`RECOVERED_DEDUPE_MS`) do anterior.
6. `applyChange`, `applyStop`, `appendSample` e `applyRecovered` são puras e imutáveis: devolvem a mesma referência quando não há nada a fazer (sessão parada, mesmo desporto, sem segmento aberto).
7. **Os eventos mandam sobre o `status`**: `isLive` exige `status: "live"` **e** ausência de `stopped`. Com um `stopped` registado, nenhuma transição aceita alterações e `applyStop` limita-se a corrigir o `status`. Se houver dois `stopped`, o último vale — em `segmentsFromEvents` e em `sessionBounds`.
8. `sessionBounds`: início = primeiro `started` (ou `createdAt`); fim = último `stopped`, senão última amostra, senão início.
9. **Rondas (ADR 0011).** `round_started` é fronteira de bloco como uma Marca, **exceto** quando cai exatamente no início do bloco aberto (um CHANGE no mesmo instante): aí o bloco que acabou de abrir é o primeiro da ronda e nada de ~0 s se cria. Um `round_started` a menos de **2000 ms** (`ROUND_DEDUPE_MS`) do anterior é ignorado por `applyRoundStart` — a guarda é na **escrita**, e é também o que impede um Nova ronda em cima do Iniciar de dizer a ronda 1 duas vezes. Na **derivação** não há nenhum limiar de duração: um marcador que não vem *depois* da ronda já aberta é essa ronda dita duas vezes e não abre nada (`roundStartsFromEvents`), e nenhum bloco nem ronda se descarta por ser curto. Nenhuma ronda fica sem blocos. Segmentos não veem rondas: `segmentsFromEvents` lê igual com e sem elas.
10. **Valores (ADR 0011).** `applyRecord` é a única escrita das duas portas e **aceita-se numa sessão parada** — é o único evento aceite depois de `stopped`, e não altera segmentos nem blocos. Campos que o desporto do bloco não tem são descartados; um evento sem nada aplicável não se escreve. Por campo, **vale o último registado**; a correção é um evento novo. A comparação entre rondas faz-se pela identidade (`blockIdentity`: o exercício nomeado, resolvido contra o catálogo por `exerciseIdentity` — sem maiúsculas nem acentos —, ou o desporto quando o desporto é um exercício em si), nunca pela posição. Num bloco de `strength` os campos são os do tipo (`fieldsOfBlock`); `null` limpa qualquer campo do desporto. **O medido e o declarado nunca somam**: `distanceTotals` devolve dois números; `sessionMetrics.distanceM` continua a ser só o GPS. O ritmo agregado é tempo total sobre distância total (`paceSecPerKm`), nunca a média dos ritmos. **Tudo o que deriva de um declarado é declarado** (`derivedOrigin`, ADR 0011 §3a): `aggregateBySport` devolve, por desporto, um total `measured` e um total `declared`, cada um com os seus metros, tempo e ritmo, e nenhum campo onde os dois se somem.

## API pública de `@bricklap/engine`

Tudo é exportado por `packages/engine/src/index.ts`.

| Grupo | Funções |
|---|---|
| Transições | `createLiveSession(sport, at?, id?)`, `applyChange`, `applyStop`, `applyRecovered`, `appendSample`, `recoverLiveSessions` |
| Derivação | `segmentsFromEvents`, `blocksFromEvents`, `blocksOfSegment`, `currentSport`, `isLive`, `sessionBounds`, `durationMs` |
| Rondas e valores (ADR 0011) | `applyRoundStart`, `roundsFromEvents`, `blocksOfRound`, `applyRecord`, `blockRecords`, `blockRecord`, `blockFigures`, `exerciseKey`, `exerciseAcrossRounds`, `identityAcrossRounds`, `exercisesUsed`, `derivedOrigin`, `paceSecPerKm`, `aggregateBySport`, `distanceTotals`, `sessionEnd`, `roundStartsFromEvents`; constantes `ROUND_DEDUPE_MS`, `VALUE_FIELDS`, `VALUE_FIELDS_BY_SPORT` |
| Taxonomia de exercícios (ADR 0012) | `SEED_EXERCISES`, `foldExerciseName`, `resolveExercise`, `exerciseIdentity`, `catalogFromMentions`, `exerciseMentions`, `blockKind`, `blockIdentity`, `fieldsOfKind`, `fieldsOfBlock`; constantes `EXERCISE_KINDS`, `VALUE_FIELDS_BY_KIND` |
| Amostras e métricas | `samplesInRange` (filtro puro), `samplesBetween` (com interpolação nas fronteiras), `interpolateAt`, `samplesForSegment`, `distanceMeters`, `metricsFor`, `segmentMetrics`, `sessionMetrics`, `recentMetrics(session, segment, at?, windowMs?)`, `hasGpsSegment`; constantes `MAX_PLAUSIBLE_SPEED_MPS`, `RECOVERED_DEDUPE_MS`, `RECENT_WINDOW_MS` |
| Formatação | `formatDuration`, `formatDistance`, `formatPace`, `formatSpeedKmh`, `formatClock(ts, locale?)`, `formatDay(ts, locale?)` |
| Geo e simulador | `haversineMeters`, `destination`, `toRad`, `LISBON`, `createSim`, `stepSim(state, sport, dtMs, rng?)`, `sampleFromSim`, `sampleFromGps(GpsCoords, t)`, `typicalSpeed` |
| Dados de demonstração | `seedSessions()` (duas sessões paradas, determinísticas) |
| Utilidades | `nowMs`, `newId`, `SPORTS`, `SPORT_HAS_GPS`, `sportHasGps`, `SPORT_PACE_KIND`, `SIM_SPEED_MPS`, `nextSport` |

`GpsCoords` é um tipo estrutural (`latitude`, `longitude`, `speed?`, `accuracy?`) compatível com o `GeolocationCoordinates` do browser e com o `LocationObjectCoords` do Expo, sem importar nenhum dos dois.

## API pública de `@bricklap/i18n`

Dicionários de tradução e formatação por sistema de unidades. TypeScript puro (sem DOM, sem React Native); depende só do `@bricklap/engine` (tipo `Sport` e os formatadores métricos). Detalhe completo: [packages/i18n/README.md](packages/i18n/README.md).

| Grupo | API |
|---|---|
| Tradução | `resolveLocale(candidates)`, `translatorFor(locale)` → `t(key, params?)`, `getDictionary(locale)`; `Locale` = `"en" \| "pt-PT"`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE` (`"en"`) |
| Unidades | `formatDistanceForUnit(meters, unit?)`, `formatSpeedForUnit(mps, unit?)`, `formatPaceForUnit(meters, durationMs, unit?)`; `UnitSystem` = `"metric" \| "imperial"`, `DEFAULT_UNIT_SYSTEM` (`"metric"`) |

- `t(key)` é tipado a partir da forma de `Dictionary`: uma chave que não existe, ou que aponta para um objeto em vez de uma string, é erro de compilação. `en.ts` e `pt-PT.ts` são verificados contra o mesmo tipo — uma chave em falta num dos dois também não compila.
- Cada app junta os seus próprios candidatos a locale (`navigator.languages` na web; `I18nManager.getConstants().localeIdentifier` no Android, normalizado de `"pt_PT"` para `"pt-PT"`) e chama `resolveLocale`. O pacote não sabe nada de DOM nem de React Native.
- Métrico está implementado (delega nos formatadores do motor); imperial está **declarado no tipo `UnitSystem` mas não implementado** — as funções lançam em vez de rotular números métricos como milhas. Ver `docs/BACKLOG.md` e [docs/adr/0004-i18n-dicionario-proprio.md](docs/adr/0004-i18n-dicionario-proprio.md).
- **Os textos legais não passam por este módulo.** `apps/web-lab/src/routes/legal.*.tsx`, `LEGAL.md` e `apps/web-lab/src/lib/legal/config.ts` continuam pt-PT/UE, escritos diretamente nas rotas.

## Fronteiras entre pacotes

- **`packages/engine`** não importa DOM, React, React Native, zustand nem armazenamento. Recebe tempos (`at`) e aleatoriedade (`rng`) por parâmetro, o que torna os testes determinísticos. Também não tem texto de interface — só `SPORT_PACE_KIND` e `SPORT_HAS_GPS` (lógica), nunca rótulos.
- **`packages/i18n`** depende só do motor (tipo `Sport` + formatadores). Não importa DOM nem React Native.
- **Adaptadores vivem nas apps.** O lab web tem `apps/web-lab/src/lib/store.ts` (zustand + `localStorage`, chave `bricklap.v1`, migração única de `afterlap.v1`; a leitura está isolada em `loadFrom(storage)` e testada com um storage em memória) e `apps/web-lab/src/lib/i18n.ts` (deteção de locale via `navigator`). A app Android tem `apps/mobile/persistence/` (SQLite append-only, esquema v4: a precisão de cada fix desde a v2 — ADR 0006 e 0009; a tabela `settings` desde a v3; a coluna `payload` dos eventos `recorded` desde a v4 — ADR 0011; a linha `recovered_headless` marca uma recuperação feita pela tarefa em segundo plano, ADR 0010), `apps/mobile/gps/` (tarefa de localização do `expo-location` com serviço em primeiro plano, definida em `index.ts` antes do React e a escrever diretamente no store; permissão; bateria; registo bruto e diagnóstico só em dev), `apps/mobile/export.ts` (cópia consistente da base pela folha de partilha) e `apps/mobile/i18n.ts` para a deteção via `I18nManager`.
- Cada app tem o seu próprio "relógio" e o seu próprio fornecedor de amostras (o lab web usa o simulador; a app Android usa a tarefa de localização do `expo-location` em segundo plano — o `t` de cada amostra é o timestamp do fix — com o simulador por interruptor só em desenvolvimento — ADR 0007 e 0010), e limita-se a chamar as funções puras do motor. O ecrã da app Android não recebe *callbacks* do GPS: relê a cópia em memória do store a cada tick do relógio.

## Mecânica do monorepo

- npm workspaces (`packages/*`, `apps/*`), um só `package-lock.json` na raiz, uma só versão de TypeScript (6.0), React (19.2.3) e `@types/react`.
- O motor e o i18n são consumidos **como código-fonte TypeScript**: os `package.json` apontam `exports` para `./src/index.ts`. Vite (web) e Metro (Expo) transpilam pacotes do workspace; não há passo de build nem `dist/` para nenhum dos dois. Ver [docs/adr/0001-monorepo.md](docs/adr/0001-monorepo.md).
- Expo SDK 52+ deteta monorepos e configura o Metro sozinho; não há `metro.config.js`. Confirmado com `apps/mobile` a resolver `@bricklap/i18n` e `@bricklap/engine` via `expo export`.

## Como cada app corre

| App | Dev | Build / prova |
|---|---|---|
| `apps/web-lab` | `npm run dev:web` (Vite, porta 8080) | `npm run build:web` → `apps/web-lab/dist` (SPA estática) |
| `apps/mobile` | `npm run dev:mobile` (Metro para dev client) | `npm run export:android -w @bricklap/mobile` (bundle Hermes); APK via EAS Build ou `expo run:android` |

## Estratégia de testes

- **Motor**: vitest, `packages/engine/test/*.test.ts`, 293 testes em 16 ficheiros, cobertura 100% (statements, branches, functions, lines) sobre `packages/engine/src`. Desde a sessão 27, `exercises` fixa o ADR 0012 com o treino 01 do fundador tal como foi feito (duas rondas, a segunda a saltar o bicep), e `rounds` tem o teste de propriedade da ronda 1: 300 sequências de Mudar, Marca e Nova ronda, a qualquer intervalo incluindo 0 ms, sem uma ronda vazia nem duas no mesmo instante. Desde a sessão 26, `rounds`, `records` e `aggregates` fixam o ADR 0011: a ronda no mesmo instante de um CHANGE não cria bloco de ~0 s, a ronda com um exercício a menos compara-se por identidade, a correção depois de `stopped` é um evento novo, o bloco com GPS e o bloco declarado convivem na mesma sessão sem somar, e o ritmo agregado difere da média dos ritmos. Os testes fixam os limiares (55 m/s, 2000 ms, 30 s de janela, fronteiras inclusivas e interpoladas, arredondamento do ritmo) de forma a falharem se alguém os alterar — verificado por mutação. `test/pace.test.ts` corre sobre **excertos reais anonimizados** das sessões de campo (`test/fixtures/field-legs.json`: só Δt, distância e precisão por troço).
- **i18n**: vitest, `packages/i18n/test/*.test.ts`, 27 testes em 4 ficheiros, cobertura 100%. Confirma em runtime que `en` e `pt-PT` têm exatamente o mesmo conjunto de chaves (a par da garantia do compilador), que os textos da notificação têm os mesmos `{placeholders}` nas duas línguas, testa `resolveLocale` (correspondência exacta, língua-base, ordem, fallback) e o lançamento em `formatDistanceForUnit(..., "imperial")`.
- **Lab web**: 9 testes ao `loadFrom`/`parsePersisted` do store (migração de chave, payloads corrompidos, lista vazia depois de apagar tudo). Sem testes de UI.
- **App Android**: os testes do adaptador de persistência em Node (`node:sqlite`, mesmo motor SQLite do telemóvel), incluindo as migrações v1 → v2 → v3 → v4, a marca `recovered_headless` (uma linha por reanimação) e, desde a sessão 26, as rondas e os valores no disco (`test/rondas-valores.test.ts`) mais **a prova da migração sobre a base real do telemóvel** (`test/migracao-real.test.ts`, só corre com `BRICKLAP_DB` a apontar para uma cópia da base puxada; senão fica `skipped`); desde a sessão 27, com a mesma variável, **`test/leitura-real.test.ts`** escreve um resumo de tudo o que a app deriva de cada sessão da base real — só com o que o motor já exportava antes, de propósito, para o mesmo ficheiro correr num checkout de `main` e os dois resumos se compararem byte a byte — e **`test/taxonomia-real.test.ts`** prova a ronda 1 e a taxonomia ao lado das sessões antigas sem lhes tocar; dois testes num telemóvel real — recuperação depois de `am force-stop` com o simulador (`npm run test:device`, dev client + Metro) e gravação em segundo plano com GPS real e `kill -9` do processo a meio (`npm run test:device:background`, release *debuggable*).
- **Apps**: verificação por `tsc`, `vite build` (web) e `expo export --platform android` (mobile).

## O que ainda não existe

- Retoma automática da gravação depois de um reinício do telemóvel (o Android não deixa o `expo-location` arrancar o serviço em segundo plano; a retoma é ao abrir a app — ADR 0010).
- Exportação GPX e importação FIT (a importação subiu de prioridade na sessão 26); planos de treino (4.5), que referem exercícios pela identidade do ADR 0012.
- Relógio (Wear OS / Garmin Connect IQ), contas, nuvem, iOS.
- Sistema de unidades imperial (`UnitSystem` já declara `"imperial"`; as funções lançam).
- Ecrã de definições para escolher língua/unidades à mão (hoje é só deteção automática do dispositivo).
