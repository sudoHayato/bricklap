# Backlog

Prioridades: **P0** bloqueia a próxima sessão; **P1** próxima fase; **P2** quando calhar. Itens marcados "a decidir" precisam do fundador.

## P0 — Fase 1, fecho

- [ ] **Instalar e correr o APK no telemóvel** (build local, `npx expo run:android --device`) e validar START/CHANGE/STOP com os quatro desportos e as duas línguas.

Decidido pelo fundador na sessão 02, já não é backlog: `android.package` = `com.bricklap.app` é **definitivo**; **EAS abandonado** (sem conta Expo) — o caminho é build local, ver `docs/adr/0005-build-local-android.md`.

## P1 — Fase 2 (concluída em 2026-09-10)

Feito na sessão 03 (ADR 0006): adaptador de persistência SQLite append-only e `recovered` real ao reabrir a app. Feito na sessão 04 (ADR 0007): `expo-location` em primeiro plano, textos de permissão en + pt-PT, ecrã ligado enquanto grava, registo bruto `gps-raw.jsonl`, exportação GeoJSON. **Teste de campo do fundador feito** (relatório da sessão 04 §6): 18:37, 1097 amostras a ≈ 1 Hz, um buraco (o fecho/reabertura deliberado), `recovered` na base. Fase 2 fechada pelo CTO. Fica por fazer, sem bloquear nada:

- [x] ~~Ícones e cor de fundo definitivos~~ — **feito nas sessões 15 e 16**: a marca no ícone do lançador, no adaptativo, na notificação e no arranque ([docs/marca/README.md](marca/README.md)). O `expo-splash-screen` continua por instalar; o arranque usa os recursos do template, trocados pelo plugin `withRecursosDaMarca`.
- [ ] Decidir `newArchEnabled` explícito em `app.json` (SDK 57 já usa a nova arquitetura por defeito; deixar explícito evita surpresas).
- [ ] Antes de distribuir: `android.blockedPermissions` para `READ/WRITE_EXTERNAL_STORAGE` (e `INTERNET` enquanto não for usada) — vêm do template do Expo, não do `app.json`.
- [ ] Tema escuro a nível de sistema (diálogos, teclado): exige `expo-system-ui`; hoje a app pinta as suas cores e o `userInterfaceStyle` foi retirado por não ter efeito sem esse módulo.
- [ ] CI (GitHub Actions): `npm test`, `npm run typecheck`, `npm run build:web`, `expo export --platform android`.

## Visão do produto — blocos por métrica (Fase 4+, sem desenho)

Decisão do fundador em [docs/VISAO.md](VISAO.md): um treino HIIT/AMRAP é uma sessão com blocos, cada um com as suas métricas. Uma linha por bloco futuro, **todos Fase 4+**, nenhum desenhado agora:

- [ ] **O Mudar propõe o bloco seguinte do plano como primeira opção** (Fase 4.5, quando existirem planos; sessão 17). A escolha de desporto (`ui/escolhaDesporto.tsx`) continua a permitir escolher outro; só a ordem ou o destaque da primeira opção muda para seguir o plano, quando houver um. **Ligação (sessão 20)**: quando os planos de treino (4.5) tiverem também rondas ([ADR 0011](adr/0011-rondas-e-valores-registados.md), proposto), esta proposta é o mecanismo que os percorre — não uma segunda linha.
- [ ] **Força com exercício, repetições e carga** por segmento (Fase 4+). Introdução após o treino sobre o segmento já gravado é a primeira via a estudar; durante o treino é Fase 5 (relógio).
- [ ] **Passadeira por ritmo × distância → tempo** (Fase 4+): o atleta introduz o ritmo e a distância da máquina; o tempo já está gravado.
- [ ] **Remo indoor com metros** (Fase 4+): metros do monitor do remo, introduzidos após o treino.
- [ ] **Natação em piscina com piscinas/metros** (Fase 4+), pela mesma via.

## Dogfooding 01 (sessão 20, 2026-09-14) — do primeiro treino a sério

Do primeiro registo de campo do fundador com a app instalada ([registo](dogfooding/2026-09-14-treino-01.md); modelo de dados proposto no [ADR 0011](adr/0011-rondas-e-valores-registados.md)):

- [ ] **Taxonomia de exercícios**: separar peso puro (haltere, barra) de peso do corpo (flexões, push ups, RDL sem carga externa se for o caso); rever as oito etiquetas de desporto atuais, que hoje juntam os dois num só "Força". Sem isto, "carga" no ADR 0011 não sabe a que exercícios se aplica.
- [ ] **Edição pós-treino**: corrigir e preencher valores em falta (metros, repetições, carga, velocidade) sobre uma sessão já gravada, sem apagar nem reescrever o registo de eventos original — só acrescentar.
- [ ] **Relógio — prioridade alta**: o fundador tem um Garmin Fenix 6X Pro. Facto duro registado para não se perder: uma app Connect IQ escreve-se em **Monkey C**, com limites de memória apertados, e o `packages/engine` em TypeScript **não corre lá** — teria de ser reimplementado. Isto é uma **segunda implementação do motor**, não mais um ecrã da mesma app; exige ADR próprio quando entrar em roadmap (hoje é a Fase 5 do [ROADMAP](../ROADMAP.md); o brief desta sessão referiu-se a esta linha como "Fase 2", que não bate com a numeração atual — ver dúvida no relatório da sessão 20).
- [ ] **Caminho intermédio a avaliar antes do relógio**: importar ficheiros **FIT** gravados pela app nativa do Garmin, sem escrever nenhum Monkey C. Não resolve a introdução de valores durante o treino, mas dá dados reais de um relógio sem o custo de uma segunda implementação do motor.
- [ ] **Marca: em standby**, por decisão do fundador (não desta sessão). A exploração vive em `feat/marca-blender`, não fundido: a **P2122** é a candidata das sessões 18/19 ([relatório](reports/2026-09-13-sessao-19.md)), e a **ligadura BL** — o B a partilhar a haste e o pé do L, a uma cor — é uma direção ainda por testar, não desenhada.

## P1 — Fase 3 (concluída em 2026-09-12; sessões 05–09)

- [x] **Desportos sem GPS** (sessão 05, ADR 0008): força, remo indoor, passadeira, natação em piscina; segmentos só de tempo; watcher ligado ao segmento; permissão sob demanda; oito chips em duas linhas.
- [ ] **Introdução manual de distância nos desportos sem GPS** — absorvido pelos blocos da visão do produto acima (Fase 4+).
- [ ] **Chips do ecrã inicial com oito desportos**: duas linhas rotuladas chegam para não piorar; um desenho a sério (ícones, ordem por uso, último usado primeiro) é Fase 4.

- [x] ~~**Cadência de amostras**~~ — **resolvido pelo teste de campo** (sessão 04 §6): em movimento a app entrega ≈ 1 Hz (58,9 amostras/min em 18:37). Os 4–6 s medidos com o telemóvel parado eram supressão de fixes repetidos pelo sistema (`Location Change Trigger`), não um defeito. Nada a fazer.
- [x] ~~**Ritmo em caminhada mal calibrado**~~ — **resolvido com dados na sessão 06** ([ADR 0009](adr/0009-ritmo-precisao-exportacao.md)): a caminhada estava bem; o ritmo médio do segmento diluía 103 s de paragens (14:06/km em vez de ≈ 12:20 a andar). A hipótese do ruído confirmou-se por troço (cv 0,49 a andar vs 0,14 a correr) mas o ecrã nunca o mostrava. Sem filtro na distância; "ritmo atual" dos últimos 30 s no ecrã de gravação.
- [ ] **Ritmo em movimento no resumo** (excluir paragens, como o Strava) — **Fase 4, decisão do CTO no fecho da sessão 06**. Definição provisória de "parado": velocidade < 0,5 m/s durante 5 s. A velocidade Doppler do provider pode servir para detetar "parado", **nunca para distância** (decisão do CTO: é 6–12 % lenta face à haversine).
- [x] **Filtro por precisão** (limiar de deslocamento relativo à precisão): rejeitado com números na sessão 06 (só retirava 1 % de deriva nas sessões em movimento) e **revertido pelo CTO na sessão 09** com o teste de campo de 1 h — 348 m de deriva em 33 min de telemóvel pousado, o caso de uso central do fundador. `gateByAccuracy` no motor, `k = 0,25 × precisão`: deriva 348 → 87 m, referências −1,27 % / −0,01 %, ritmo a correr igual em todas as casas decimais. [ADR 0009](adr/0009-ritmo-precisao-exportacao.md), "Revisão".
- [ ] **Limite de plausibilidade por desporto** (decisão do CTO no fecho da sessão 06: fica no BACKLOG). Hoje só há o corte de 55 m/s para todos; uma caminhada da sessão 04 teve um troço a > 6 m/s em 329 (≈ 5 m a mais, 1 % do segmento) que esse corte não apanha. Um limite por desporto (p. ex. 5 m/s a andar) é uma tabela ao lado de `SIM_SPEED_MPS`. Sem data.
- [x] ~~**Exportação de dentro da app**~~ — **feito na sessão 06**: botão "Exportar dados" no histórico (`VACUUM INTO` + folha de partilha do sistema via `expo-sharing`). **Decisão do CTO**: a partilha do sistema chega, sem módulo nativo para a pasta externa da app; a folha dupla num build de dev (base, depois registo bruto) é aceitável. O procedimento de duas instalações fica no README como alternativa.
- [x] ~~**Segundo plano — versão final (sessão 08)**~~ — **feito na sessão 08** sobre o [ADR 0010](adr/0010-segundo-plano.md): watcher antigo e `expo-keep-awake` fora; textos da bateria no i18n e aviso persistente na recusa; `bg-diag.jsonl` só em dev, rodado por sessão; `recovered_headless` na base; teste de dispositivo com `kill -9` a meio (reanimação + hidratação headless) e reinício do telemóvel. Fica a amostra de fronteira como estava (decisão do CTO).
- [x] **Teste de campo de 1 h** (critério de saída da Fase 3, revisto pelo CTO de 2 h para 1 h porque é com o telemóvel parado que o *doze* profundo aparece): feito pelo fundador a **2026-09-12** com o release da sessão 08 — 61:12, 3289 amostras, 28 min na rua + 33 min com o telemóvel pousado e imóvel. **Mecanismo de gravação sem reservas**: zero `recovered`, serviço em primeiro plano a hora inteira, zero buracos em movimento, app a gastar 1,6 % de bateria na hora. O **custo da escrita por lote** ficou medido em **0,56 %** do tempo de gravação (a dúvida que o CTO mandou medir aqui). **Dois números fora do critério**, à decisão do CTO: um intervalo de 10,047 s no troço imóvel e 348 m de deriva com o telemóvel parado. Análise no relatório da sessão 08 §8. **Gatilho do CTO**: o teste **não** mostrou perdas no transporte dos fixes, por isso o módulo Kotlin (ADR 0010 §5b) continua a ser plano B e não trabalho.
- [ ] **Remendo ao `expo-task-manager`** (`patches/expo-task-manager+57.0.17.patch`, sessão 08): gestor de tarefas perdido quando a app abre no motor React headless. Tirar quando houver correção a montante (issue no ADR 0010) e rever a cada atualização do SDK. **À quarta surpresa na camada expo, módulo Kotlin** (regra do CTO).
- [x] **Precisão no bolso e deriva com o telemóvel parado** — resolvido na sessão 09 pelo filtro acima. O efeito no ritmo mediu-se sem gravação nova: o `gps-noise.mjs` passou a ler a precisão da base e a calcular a janela de 30 s como o motor a lê (janela exacta, fronteiras interpoladas, uma leitura por segundo); a medida "por fix" da sessão 06 inventava saltos que o motor nunca mostra.
- [x] **Apagar sessões do histórico** — **feito na sessão 14**, em dois toques com confirmação no cartão. (Fase 4; decisão do CTO no fecho da sessão 03, [ADR 0006](adr/0006-persistencia-sqlite-append-only.md): `DELETE` real de `events` + `samples` pelo `session_id`, o único `DELETE` da base). Hoje não há forma de tirar uma sessão parada do histórico — o "Descartar" só existe no ecrã de retoma. Ficou uma sessão de **00:17** no telemóvel do fundador, de um teste da notificação na sessão 09.
- [ ] **Notificação com cronómetro a andar e distância**: a API do `expo-location` só aceita título/corpo como opções da tarefa, e mudá-los reinicia o pedido de localização (ADR 0010, "Notificação"). A sessão 08 punha lá o tempo decorrido à data do último START/CHANGE/Continuar; o fundador viu-o na barra sempre a zeros e leu-o como avariado, e o CTO mandou tirar o cronómetro falso — hoje a notificação diz só o desporto e a hora de início ("A gravar desde as HH:MM"). Um cronómetro **a andar** exige um serviço nosso (ADR 0010 §5b) ou `expo-notifications` a escrever por cima da notificação do serviço. **Fase 4.**
- [ ] **Amostras fora de ordem na fronteira**: um fix tirado antes do CHANGE/STOP mas entregue depois fica na base atrás da amostra de fronteira (≤ 1 s em campo). A distância não muda; ≤ 1 s de movimento pode cair no segmento errado. Só corrigir se alguma análise o mostrar.
- [ ] **Retoma automática depois de um reinício do telemóvel**: o Android não deixa o `expo-location` arrancar o serviço com a app em segundo plano ao `BOOT_COMPLETED`; a retoma é ao abrir a app (decisão do CTO: chega). Se um dia fizer falta, é um serviço nosso arrancado pelo `BOOT_COMPLETED` (ADR 0010 §5b).
- [ ] **Teste de dispositivo: margem depois de "Continuar"** (decisão do CTO no fecho da sessão 06): se voltar a falhar por margem, alargar a espera de 5 s para 10 s e registar os tempos reais (quanto demorou a primeira amostra nova) no relatório dessa sessão.
- [x] ~~**Precisão junto da amostra**~~ — **feito na sessão 06**: migração v2 (`samples.accuracy REAL NULL`), `Sample.accuracyM` opcional, adaptador a gravar a precisão de cada fix.
- [x] ~~**Registo bruto cresce sem limite**~~ — **feito na sessão 06**: só em builds de desenvolvimento, rodado por sessão (`gps-raw.prev.jsonl` guarda o anterior).
- [ ] `scripts/geojson.mjs` ainda lê a precisão do registo bruto; podia lê-la da base (v2). Não é urgente.
- [x] ~~`t` da amostra = hora de chegada~~ — **desde a sessão 08 (ADR 0010, decisão do CTO) `t` é o timestamp do fix**; o registo bruto (dev) guarda `arrivedAt` para medir o atraso de entrega.

## Medalhas e recordes pessoais (Fase 6, sem desenho)

Decisão do CTO na sessão 13b ([ROADMAP](../ROADMAP.md), Fase 6; [VISAO](VISAO.md)): aceites porque saem **da base local**, sem contas e sem servidor. Uma linha por tipo de recorde, nenhuma desenhada. Todos derivados dos eventos já gravados — **nada de métricas novas e nada persistido além do que a base já tem**.

- [ ] **Primeira vez** a fazer um exercício, um desporto ou um plano (Fase 6).
- [ ] **Carga máxima** por exercício — a maior carga registada, medida e não estimada (sem 1RM calculado) (Fase 6).
- [ ] **Melhor tempo num plano** — o mesmo plano repetido, comparado do princípio ao fim (Fase 6). Depende dos planos de treino (4.5).
- [ ] **Melhor distância e melhor ritmo** por desporto, sobre os segmentos já gravados (Fase 6).
- [ ] **Sequências** — dias ou semanas seguidas com treino (Fase 6).

Fora daqui, e de propósito: **feed social e desafios entre atletas** estão **adiados sem fase atribuída** (ROADMAP, "Adiado, sem fase atribuída") — exigem contas, servidor, nuvem, moderação e tornam o fundador responsável pelo tratamento de dados de terceiros. Não entram no backlog até haver utilizadores reais que os peçam.

## Marca (sessões 15, 16 e 17)

- [x] ~~**"Peças brancas" no ícone da app**~~ — **fechado na sessão 17**: o fundador viu-as **na gaveta de aplicações, antes da correção da sessão 16**. Era a moldura da sessão 15, cortada pelo One UI à medida exata do seu próprio traço (relatório da sessão 16 §3.1); resolvido pelo ícone novo da mesma sessão.
- [ ] **Verificar a marca no [TMview](https://www.tmdn.org/tmview/) e no [INPI](https://inpi.justica.gov.pt/) — tarefa do fundador.** A marca **não está registada**. Até haver verificação não se trata como definitiva nem se usa fora deste repositório e da app: nada de sítio público, loja, redes ou material impresso. Faz-se quando houver alguma coisa pública para lançar. Ver [docs/marca/README.md](marca/README.md).
- [ ] **Levar a marca a um designer profissional antes de a app ser mostrada a estranhos** (nota do CTO, sessão 16). A marca fica **congelada como marca de trabalho**: não se redesenha nas sessões de desenvolvimento. O [docs/marca/README.md](marca/README.md) tem as direções, as cores, as medidas e o que falhou, para reduzir o trabalho e o custo de quem pegar nela.
- [x] ~~**Decidir o ícone da app: moldura ou selo cheio**~~ — **decidido pelo fundador na sessão 16, e não foi nenhum dos dois**: campo `#C0402C` a toda a tela com as três peças a claro, sem moldura desenhada — o recorte do sistema é a moldura. A moldura desenhada dentro do ícone lia-se como selo no One UI, que recorta a tela à medida exata da moldura (relatório da sessão 16).
- [ ] **A geometria da marca está escrita em vários sítios e nada os prende um ao outro** (sessão 15; na 16 juntaram-se `bricklap-icone-app.svg`, `bricklap-notificacao.svg` e os PNG do Android, gerados a partir dos mesmos números): o SVG mestre `docs/marca/bricklap-logo.svg`, as constantes de `apps/mobile/ui/logotipo.tsx` e a tabela do `docs/marca/README.md`. Hoje concordam nas 13 medidas — verifiquei — mas a concordância é manual: editar o SVG não parte nada e o componente da app fica a desenhar outra coisa em silêncio. Um teste que leia os três e os compare resolve-o em vinte linhas; fica por decidir se vale atravessar a fronteira entre `apps/mobile/test/` e `docs/`, que hoje nenhum teste atravessa.
- [ ] **Favicon**, quando houver uma página pública — usa a versão a uma cor (regra da cor, `docs/marca/README.md`).
- [ ] **A cor de acento da notificação da gravação ainda é `#070708`** (`notificationColor` em `apps/mobile/gps/background.ts`, vinda do template). No One UI não se vê — o cartão mostra o ícone da app —, mas no Android sem essa camada pinta o ícone pequeno do cabeçalho da notificação quase de preto. Trocar por `#C0402C` quando se mexer na notificação (o cronómetro a andar, acima); não se mexeu na sessão 16 por ser código do caminho da gravação e exigir outro release só por uma cor (sessão 16).

## Mapa dos percursos GPS (Fase 4, a seguir aos planos de treino — sem código)

Decisão do CTO na sessão 16 ([ROADMAP](../ROADMAP.md), 4.5b). O [ADR 0007](adr/0007-gps-primeiro-plano.md) deixou o mapa de fora da Fase 2 por ser uma dependência pesada para uma pergunta que uma linha de texto respondia; na Fase 4 a pergunta passa a ser "por onde andei", e aí o mapa é a resposta. **As zonas de privacidade não são decisão do CTO**: vêm das diretrizes que o fundador deu ao CTO no início do projeto, fora do repositório; o CTO só as trouxe para aqui na sessão 16 (correção do fundador, sessão 17).

- [ ] **Mapa de uma sessão de rua com MapLibre e OpenStreetMap** — gratuito, sem licença paga. Um cartão com contorno, nunca o fundo do ecrã (DESIGN.md §8). Nova dependência nativa: justificar no relatório dessa sessão.
- [ ] **Zonas de privacidade, no mesmo brief que o mapa e não depois**: esconder o início e o fim de cada percurso. Um mapa sem elas mostra onde o atleta mora ou trabalha. A decidir no brief: o raio, e a quem se esconde — ao próprio atleta no ecrã, ou só no que sai do telemóvel (captura, exportação GPX).
- [ ] **Fonte dos mosaicos, a decidir antes de haver código**: os dados do OpenStreetMap são livres (ODbL, **atribuição obrigatória** no mapa), mas os servidores de mosaicos da fundação OpenStreetMap têm uma política de uso que não admite uma aplicação a pedir mosaicos em volume. As vias gratuitas são uma fonte própria, um ficheiro PMTiles, ou o plano gratuito de um fornecedor.

## P1 — i18n (sessão 02)

- [ ] **Unidades imperiais (EUA e Reino Unido) — Fase 6, com o lançamento internacional** (decisão do CTO, sessão 16; [ROADMAP](../ROADMAP.md), Fase 6). Milhas, jardas, libras, pés e ritmo por milha. A app tem de ser utilizável por qualquer pessoa no mundo, mas não bloqueia nada antes disso. Já existe: a secção **Unidades** nas Definições (sessão 14, hoje só com o métrico) e `UnitSystem` com `"imperial"` declarado — `formatDistanceForUnit`/`formatSpeedForUnit`/`formatPaceForUnit` lançam em vez de o implementar. Falta o segundo sistema e fazer da secção um seletor guardado na tabela `settings`, como o do tema.
- [ ] **Língua e unidades no ecrã de definições.** O ecrã existe desde a sessão 14, mas só com o **tema** (quatro presets, guardados na tabela `settings`). A língua e as unidades continuam a ser deteção automática do dispositivo, uma vez, no arranque, sem troca em runtime.
- [ ] **Dicionário `pt-BR` próprio, se o Brasil vier a ser mercado.** O fundador aprovou que, por agora, `pt-BR` (e qualquer variante de português não listada) caia em `pt-PT` — é melhor do que inglês. Se o Brasil passar a ser mercado, merece dicionário próprio: vocabulário (ecrã/tela, telemóvel/celular, ficheiro/arquivo) e ortografia divergem o suficiente para soar estrangeiro.
- [ ] Textos legais: quando a app nativa tiver as suas próprias páginas legais (Fase 4), decidir se continuam só pt-PT/UE ou se passam a ter tradução — hoje a decisão do fundador foi mantê-los fora do i18n.
- [ ] `apps/web-lab/src/lib/i18n.ts` e `apps/mobile/i18n.ts` calculam o locale uma vez, no arranque do módulo — não reagem a uma mudança de língua do sistema operativo enquanto a app está aberta (aceitável sem ecrã de definições).

## P2 — Qualidade e dívida

- [ ] **Por explicar (sessão 14): o estado da permissão de localização preenchido numa sessão de ginásio.** No release da sessão 14, um treino de força mostrou o aviso "a localização está desligada" — as duas chamadas que preenchem esse estado estão guardadas por `sportHasGps`, e a instrumentação no build de desenvolvimento confirmou que nenhuma corre num desporto sem GPS (`start(strength) hasGps=false`, sem pedido de localização). **O sintoma está fechado** pela guarda `avisosDe(precisaGps)`, que impede o aviso de aparecer num treino de ginásio seja qual for o estado; **a origem não foi identificada** e o gatilho não se reproduziu. Ver o relatório da sessão 14 §4.6. Só vale a pena voltar aqui se reaparecer.
- [ ] Motor: `Segment.sampleStart`/`sampleEnd` duplicam `startAt`/`endAt` — simplificar ou dar-lhes significado (índices de amostras).
- [ ] Motor: `newId()` usa `Math.random`; considerar `crypto.randomUUID` quando disponível nas duas plataformas.
- [ ] Lab: decidir ESLint/Prettier (hoje só `.prettierrc` como convenção de editor) e um smoke test e2e.
- [ ] Lab: `apps/mobile/.gitignore` ainda lista `/ios` e `web-build/` (inofensivo; limpar quando se mexer no ficheiro).
- [ ] Mobile: insets calculados à mão (`StatusBar.currentHeight + 8` em cima, `48 + 8` dp em baixo, em `ui/estrutura.tsx`); substituir por `react-native-safe-area-context` — com seis ecrãs e separadores de fundo, o "quando houver mais ecrãs" já chegou.
- [x] ~~Mobile: "Nova sessão" fica desativado 700 ms depois de Parar para um toque duplo não apagar a sessão.~~ **Resolvido na sessão 14 por outra via**: Parar passou a exigir um premir de 0,8 s com a barra a encher, e um toque já não termina a gravação — o atraso artificial deixou de fazer falta e saiu.
- [ ] Badge de cobertura e relatório HTML publicado (opcional).
- [ ] `testID` não mapeia para `resource-id` no `uiautomator dump` desta app (RN 0.86, Android) — confirmado na sessão 03 (`docs/reports/2026-09-10-sessao-03.md` §5.1). Revisitar só se a app vier a precisar de Detox/Appium a sério.
- [ ] Cobrir CHANGE no teste de dispositivo Android: hoje impossível por `uiautomator` (ver `docs/reports/2026-09-10-sessao-03.md` §5.2 — o ecrã ao vivo nunca fica "idle"). Se algum dia for preciso, a via é um *broadcast receiver* de depuração que dispare a troca de desporto diretamente na app, sem tocar no ecrã — não `uiautomator`.
