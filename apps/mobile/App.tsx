/**
 * Bricklap — app Android, Fase 4 (parte 7a: o sistema visual na app).
 *
 * INICIAR uma vez, MARCA a cada bloco, MUDAR de desporto sem parar, PARAR no
 * fim. Todo o estado da sessão vive em @bricklap/engine (os eventos são a
 * fonte de verdade; segmentos, blocos e métricas são derivados) e todo o
 * texto vem de @bricklap/i18n.
 *
 * O que este ficheiro é: a máquina de estados e os efeitos — persistência,
 * GPS, permissões, tema. O que os ecrãs mostram está em `./ecras.tsx`, e o
 * sistema visual que eles seguem está em `docs/DESIGN.md` e em `./ui/`.
 *
 * Persistência (Fase 2, parte 1, ADR 0006): cada evento é escrito de forma
 * síncrona numa base SQLite antes de o ecrã reagir; as amostras vão em lotes
 * curtos. Ao arrancar, a app repõe a sessão que estava a decorrer (evento
 * `recovered`) e pergunta se continua ou descarta. Desde a Fase 4 há uma
 * operação que apaga a sério — `deleteSession`, o direito ao apagamento —,
 * explícita e fora do caminho de gravação.
 *
 * GPS (ADR 0007 e 0010): o GPS real é uma tarefa do expo-task-manager com
 * serviço em primeiro plano e notificação persistente (./gps/background) — o
 * único caminho de gravação. A tarefa escreve as amostras diretamente no
 * store, com o `t` do próprio fix; este ecrã relê o store a cada tick do
 * relógio. Sem keep-awake: o ecrã apaga-se e a gravação continua.
 *
 * Desportos sem GPS (ADR 0008): força, remo indoor, passadeira e natação são
 * só tempo. A tarefa de posição segue o segmento e a permissão pede-se quando
 * faz falta.
 *
 * Marca (Fase 4): fecha um bloco dentro do segmento atual sem mudar de
 * desporto. É um evento como os outros — escrito antes de o ecrã reagir.
 *
 * Rondas e valores (sessão 26, ADR 0011): a Ronda é mais um evento; os
 * valores de um bloco (metros, km/h, repetições, carga, o exercício) são um
 * evento `recorded` acrescentado ao registo, escrito pelas duas portas — a
 * ficha durante a gravação e a ficha sobre o resumo — nunca uma reescrita.
 */
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, ScrollView, Text, View } from "react-native";
import {
  createSim,
  currentSport,
  sampleFromGps,
  sampleFromSim,
  segmentsFromEvents,
  sessionMetrics,
  sportHasGps,
  stepSim,
  formatClock,
  type Block,
  type CatalogExercise,
  type RecordInput,
  type Sample,
  type Session,
  type SimState,
  type Sport,
} from "@bricklap/engine";
import { EcraDefinicoes, EcraGravacao, EcraHistorico, EcraInicio, EcraResumo, EcraRetoma } from "./ecras";
import { exportData } from "./export";
import {
  latestLocation,
  startBackgroundRecording,
  stopBackgroundRecording,
  updateRecordingNotification,
  type RecordingNotification,
} from "./gps/background";
import { isBatteryOptimised, requestBatteryExemption } from "./gps/battery";
import { notificationsAllowed, requestNotifications, type NotificationPermission } from "./gps/notifications";
import { rotateDiagLog } from "./gps/diag";
import { isWeak, requestForegroundLocation, type PermissionOutcome } from "./gps/location";
import { rotateRawLog } from "./gps/rawLog";
import { locale, t } from "./i18n";
import type { SessionSummary } from "./persistence";
import { getStore, logRecovery } from "./store";
import { Botao, Cartao } from "./ui/componentes";
import { usarTema } from "./ui/tema";
import { texto } from "./ui/tipografia";
import { CHAVE_TEMA, E, PRESET_PREDEFINIDO, presetValido, type Ecra, type Preset } from "./ui/tokens";
import { rotateWriteCost } from "./writeCostFile";

const CLOCK_TICK_MS = 250;
const GPS_TICK_MS = 1000;

type Screen =
  | { kind: "opening" }
  | { kind: "inicio" }
  | { kind: "retoma" }
  | { kind: "gravacao" }
  | { kind: "resumo"; session: Session; doHistorico: boolean }
  | { kind: "historico"; sessions: SessionSummary[] }
  | { kind: "definicoes"; voltarPara: "inicio" | "historico" };

type ExportState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; files: string[] }
  | { kind: "error"; message: string };

type GpsStatus =
  | { kind: "off" }
  | { kind: "waiting" }
  | { kind: "fix"; lat: number; lng: number; accuracyM: number | null; weak: boolean }
  | { kind: "error"; message: string };

/** Qual dos ecrãs de `temaDoEcra` estamos a desenhar. */
function ecraDoScreen(s: Screen): Ecra {
  switch (s.kind) {
    case "gravacao":
      return "gravacao";
    case "retoma":
      return "retoma";
    case "resumo":
      return "resumo";
    case "historico":
      return "historico";
    case "definicoes":
      return "definicoes";
    default:
      return "inicio";
  }
}

/**
 * O que a notificação persistente diz: o desporto e a hora de início. Sem
 * tempo decorrido — refrescar o texto reinicia o pedido de localização
 * (ADR 0010), e um cronómetro que só andava no Iniciar/Mudar/Continuar ficava
 * parado em "00:00" e lia-se como avariado (sessão 09).
 */
function recordingNotification(session: Session): RecordingNotification {
  const sport = currentSport(session.events) ?? "run";
  return {
    title: t("mobile.recordingNotificationTitle", { sport: t(`sport.${sport}.label`) }),
    body: t("mobile.recordingNotificationBody", { startedAt: formatClock(session.createdAt, locale) }),
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "opening" });
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [preset, setPreset] = useState<Preset>(PRESET_PREDEFINIDO);
  const [simEnabled, setSimEnabled] = useState(false);
  const [permission, setPermission] = useState<PermissionOutcome | null>(null);
  const [gps, setGps] = useState<GpsStatus>({ kind: "off" });
  const [batteryOptimised, setBatteryOptimised] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<NotificationPermission | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ kind: "idle" });
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);

  const { tema, tokens } = usarTema(preset, ecraDoScreen(screen));

  const refreshBattery = useCallback(() => {
    void isBatteryOptimised().then(setBatteryOptimised);
  }, []);
  const refreshNotifications = useCallback(() => {
    void notificationsAllowed().then((ok) =>
      setNotifications((prev) => (ok ? "granted" : prev === null || prev === "granted" ? "denied" : prev)),
    );
  }, []);
  const askNotifications = useCallback(() => {
    if (notifications === "blocked") void Linking.openSettings();
    else void requestNotifications().then(setNotifications);
  }, [notifications]);

  useEffect(() => {
    void requestNotifications().then(setNotifications);
  }, []);

  const sessionRef = useRef<Session | null>(null);
  const simRef = useRef<SimState>(createSim());
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Arranque: abrir, migrar, replay. Uma sessão viva no disco quer dizer que a
  // app morreu a meio; perguntar antes de voltar a gravar para dentro dela.
  useEffect(() => {
    const store = getStore();
    const live = store.hydrate();
    setPreset(presetValido(store.getSetting(CHAVE_TEMA)));
    if (live) {
      const metrics = sessionMetrics(live, live.samples.at(-1)?.t ?? live.createdAt);
      logRecovery({
        liveId: live.id,
        events: live.events.length,
        samples: live.samples.length,
        segments: segmentsFromEvents(live.events).length,
        lastSampleT: live.samples.at(-1)?.t ?? null,
        distanceM: Math.round(metrics.distanceM * 1000) / 1000,
      });
      setSession(live);
      setScreen({ kind: "retoma" });
    } else {
      logRecovery({ liveId: null });
      setScreen({ kind: "inicio" });
    }
  }, []);

  const escolherPreset = useCallback((p: Preset) => {
    setPreset(p);
    getStore().setSetting(CHAVE_TEMA, p);
  }, []);

  useEffect(() => {
    refreshBattery();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") getStore().flush();
      else {
        refreshBattery();
        refreshNotifications();
      }
    });
    return () => sub.remove();
  }, [refreshBattery, refreshNotifications]);

  const recording = screen.kind === "gravacao";
  const liveSport = recording && session ? currentSport(session.events) : null;
  const feedWanted = liveSport !== null && sportHasGps(liveSport);

  const tickSim = useCallback((): Sample | null => {
    const s = sessionRef.current;
    if (!s || s.status !== "live") return null;
    const sport = currentSport(s.events);
    if (!sport || !sportHasGps(sport)) return null;
    const ts = Date.now();
    const dt = Math.max(0, ts - lastTickRef.current);
    lastTickRef.current = ts;
    simRef.current = stepSim(simRef.current, sport, dt);
    return sampleFromSim(simRef.current, sport, ts);
  }, []);

  const record = useCallback((sample: Sample) => {
    const store = getStore();
    store.pushSample(sample);
    setSession(store.live());
    setNow(sample.t);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const clock = setInterval(() => {
      setNow(Date.now());
      const live = getStore().live();
      if (live !== sessionRef.current) setSession(live);
      if (!simEnabled) {
        const loc = latestLocation();
        if (loc) {
          setGps({
            kind: "fix",
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracyM: loc.coords.accuracy,
            weak: isWeak(loc),
          });
        }
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(clock);
  }, [recording, simEnabled]);

  useEffect(() => {
    if (!feedWanted) return;
    lastTickRef.current = Date.now();

    if (simEnabled) {
      const sim = setInterval(() => {
        const sample = tickSim();
        if (sample) record(sample);
      }, GPS_TICK_MS);
      return () => clearInterval(sim);
    }

    let cancelled = false;
    setGps({ kind: "waiting" });
    (async () => {
      const outcome = await requestForegroundLocation();
      if (cancelled) return;
      setPermission(outcome);
      if (outcome !== "granted") {
        setGps({
          kind: "error",
          message: t(outcome === "services_off" ? "mobile.gpsServicesOff" : "mobile.gpsNoPermission"),
        });
        return;
      }
      const live = getStore().live();
      if (!live) return;
      await startBackgroundRecording(recordingNotification(live));
      if (cancelled) await stopBackgroundRecording("segment changed before the service was up");
    })().catch((e: unknown) => {
      if (!cancelled) setGps({ kind: "error", message: String(e) });
    });
    return () => {
      cancelled = true;
      void stopBackgroundRecording("feed no longer wanted");
      setGps({ kind: "off" });
    };
  }, [feedWanted, simEnabled, tickSim, record]);

  useEffect(() => {
    if (!feedWanted || simEnabled) return;
    const live = getStore().live();
    if (!live) return;
    void updateRecordingNotification(recordingNotification(live));
  }, [liveSport, feedWanted, simEnabled]);

  /**
   * A amostra exatamente na fronteira mantém a distância contínua entre o
   * segmento que fecha e o que abre. Nula quando não há nada a carimbar — sem
   * fix ainda, ou um segmento sem GPS.
   */
  const boundarySample = useCallback((): Sample | null => {
    const s = sessionRef.current;
    if (!s || s.status !== "live") return null;
    const sport = currentSport(s.events);
    if (!sport || !sportHasGps(sport)) return null;
    if (simEnabled) return tickSim();
    const loc = latestLocation();
    if (!loc) return null;
    return sampleFromGps(loc.coords, Date.now());
  }, [simEnabled, tickSim]);

  const start = useCallback(
    async (sport: Sport) => {
      if (!simEnabled && sportHasGps(sport)) {
        const outcome = await requestForegroundLocation();
        setPermission(outcome);
        if (outcome !== "granted") return;
      }
      const ts = Date.now();
      const store = getStore();
      store.start(sport, ts);
      rotateRawLog();
      rotateDiagLog();
      rotateWriteCost();
      simRef.current = createSim();
      lastTickRef.current = ts;
      if (simEnabled && sportHasGps(sport)) store.pushSample(sampleFromSim(simRef.current, sport, ts));
      const live = store.live();
      sessionRef.current = live;
      setNow(ts);
      setSession(live);
      setScreen({ kind: "gravacao" });
    },
    [simEnabled],
  );

  /**
   * A Marca. Como um CHANGE, a amostra da fronteira vai primeiro, para a
   * distância do bloco que fecha não escorregar para o seguinte.
   */
  const marcar = useCallback(() => {
    const sample = boundarySample();
    const store = getStore();
    if (sample) store.pushSample(sample);
    store.mark(sample?.t ?? Date.now());
    setSession(store.live());
  }, [boundarySample]);

  /**
   * O Mudar. Sessão 17: reverte uma decisão de âmbito da sessão 14, que fazia
   * o Mudar percorrer os oito desportos em ciclo sem o brief o mandar. O
   * ecrã (`EscolhaDesporto`) já garantiu a escolha — aqui só falta escrevê-la,
   * com a mesma ordem que o CHANGE sempre teve: a amostra de fronteira
   * primeiro, para a distância do segmento que fecha não escorregar para o
   * seguinte, e só depois o `changeSport`.
   */
  const mudarPara = useCallback(
    (sport: Sport) => {
      const s = sessionRef.current;
      if (!s) return;
      const atual = currentSport(s.events);
      if (!atual || atual === sport) return;
      const sample = boundarySample();
      const store = getStore();
      if (sample) store.pushSample(sample);
      store.changeSport(sport, sample?.t ?? Date.now());
      setSession(store.live());
    },
    [boundarySample],
  );

  /** A Ronda. Não muda o segmento, por isso não precisa de amostra de fronteira. */
  /**
   * O catálogo de exercícios (ADR 0012): a partida mais o que o registo do
   * atleta já nomeou. É uma consulta à base, por isso vive em estado e só
   * se relê quando pode ter mudado — ao trocar de ecrã e depois de cada
   * registo —, nunca a cada segundo do cronómetro.
   */
  const [catalogo, setCatalogo] = useState<CatalogExercise[]>([]);
  useEffect(() => {
    setCatalogo(getStore().exerciseCatalog());
  }, [screen.kind]);

  const novaRonda = useCallback(() => {
    const store = getStore();
    store.startRound(Date.now());
    setSession(store.live());
  }, []);

  /**
   * As duas portas escrevem aqui: a ficha da gravação (sessão viva) e a do
   * resumo (sessão parada, pelo id). O ecrã relê a sessão do store depois,
   * porque a verdade é o que ficou escrito.
   */
  const registar = useCallback((sessionId: string, _block: Block, input: RecordInput) => {
    const store = getStore();
    store.record(sessionId, input, Date.now());
    setCatalogo(store.exerciseCatalog());
    setScreen((atual) => {
      if (atual.kind !== "resumo" || atual.session.id !== sessionId) return atual;
      const relida = store.byId(sessionId);
      return relida ? { ...atual, session: relida } : atual;
    });
    const live = store.live();
    if (live?.id === sessionId) setSession(live);
  }, []);

  const parar = useCallback(() => {
    const sample = boundarySample();
    const store = getStore();
    if (sample) store.pushSample(sample);
    const id = store.stop(sample?.t ?? Date.now());
    setSession(null);
    const stored = id ? store.byId(id) : undefined;
    setScreen(stored ? { kind: "resumo", session: stored, doHistorico: false } : { kind: "inicio" });
  }, [boundarySample]);

  const continuar = useCallback(() => {
    const live = sessionRef.current;
    if (!live) return;
    const last = live.samples.at(-1);
    setSimEnabled(last?.source === "sim");
    simRef.current = last ? createSim({ lat: last.lat, lng: last.lng }) : createSim();
    setNow(Date.now());
    setScreen({ kind: "gravacao" });
  }, []);

  const descartar = useCallback(() => {
    void stopBackgroundRecording("session discarded");
    getStore().discardLive(Date.now());
    setSession(null);
    setScreen({ kind: "inicio" });
  }, []);

  const abrirHistorico = useCallback(() => {
    setExportState({ kind: "idle" });
    setAConfirmar(null);
    setScreen({ kind: "historico", sessions: getStore().summaries() });
  }, []);

  const apagar = useCallback(
    (id: string) => {
      getStore().deleteSession(id);
      setAConfirmar(null);
      abrirHistorico();
    },
    [abrirHistorico],
  );

  const doExport = useCallback(() => {
    setExportState({ kind: "busy" });
    exportData()
      .then((files) => setExportState({ kind: "done", files }))
      .catch((e: unknown) => setExportState({ kind: "error", message: String(e) }));
  }, []);

  const irInicio = useCallback(() => setScreen({ kind: "inicio" }), []);

  /**
   * Os avisos de permissão e de bateria. Nenhum bloqueia: a app grava na
   * mesma e diz o que falta.
   *
   * `precisaGps` é a guarda que a versão da Fase 3 tinha e que eu perdi ao
   * unificar os três cartões num só nó: **um treino de ginásio não pode
   * queixar-se de GPS**. Força, remo, passadeira e natação são só tempo
   * (ADR 0008) e nunca pedem localização; um aviso sobre ela ali em baixo é
   * ruído a dizer ao atleta que falta alguma coisa quando não falta nada.
   */
  const avisosDe = (precisaGps: boolean) => (
    <View style={{ gap: E.e2, marginTop: E.e4 }}>
      {precisaGps && permission !== null && permission !== "granted" && !simEnabled ? (
        <Cartao tokens={tokens}>
          <Text testID="location-problem" style={texto(14, 400, tokens.acentoTinta, { lineHeight: 20 })}>
            {t(
              permission === "denied"
                ? "mobile.locationDenied"
                : permission === "blocked"
                  ? "mobile.locationBlocked"
                  : "mobile.locationServicesOff",
            )}
          </Text>
          {permission === "blocked" ? (
            <Botao
              tokens={tokens}
              testID="btn-open-settings"
              rotulo={t("mobile.openSettings")}
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </Cartao>
      ) : null}
      {precisaGps && batteryOptimised === true && !simEnabled ? (
        <Cartao tokens={tokens}>
          <Text testID="battery-problem" style={texto(14, 400, tokens.acentoTinta, { lineHeight: 20 })}>
            {t("mobile.batteryExemptionCopy")}
          </Text>
          <Botao
            tokens={tokens}
            testID="btn-battery-exemption"
            rotulo={t("mobile.batteryExemptionButton")}
            onPress={() => void requestBatteryExemption().then(refreshBattery)}
          />
        </Cartao>
      ) : null}
      {notifications !== null && notifications !== "granted" ? (
        <Cartao tokens={tokens}>
          <Text testID="notifications-problem" style={texto(14, 400, tokens.acentoTinta, { lineHeight: 20 })}>
            {t("mobile.notificationsCopy")}
          </Text>
          <Botao
            tokens={tokens}
            testID="btn-notifications"
            rotulo={t(notifications === "blocked" ? "mobile.openSettings" : "mobile.notificationsButton")}
            onPress={askNotifications}
          />
        </Cartao>
      ) : null}
    </View>
  );

  const linhaGps = (): string | null => {
    if (simEnabled) return null;
    if (gps.kind === "fix") {
      return `±${gps.accuracyM === null ? "?" : Math.round(gps.accuracyM)} m · ${session?.samples.length ?? 0} ${t(
        "mobile.samplesSaved",
      )}${gps.weak ? ` · ${t("mobile.gpsWeak")}` : ""}`;
    }
    if (gps.kind === "error") return `${t("mobile.gpsUnavailable")} · ${gps.message}`;
    if (gps.kind === "waiting") return t("mobile.gpsWaiting");
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.fundo }}>
      <StatusBar style={tema === "escuro" ? "light" : "dark"} />
      {screen.kind === "opening" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={texto(15, 400, tokens.tinta3)}>{t("mobile.opening")}</Text>
        </View>
      ) : screen.kind === "inicio" ? (
        <EcraInicio
          tokens={tokens}
          tema={tema}
          onIniciar={(s) => void start(s)}
          onDefinicoes={() => setScreen({ kind: "definicoes", voltarPara: "inicio" })}
          onHistorico={abrirHistorico}
          simEnabled={simEnabled}
          onSimEnabled={setSimEnabled}
          avisos={avisosDe(true)}
        />
      ) : screen.kind === "retoma" && session ? (
        <EcraRetoma
          tokens={tokens}
          tema={tema}
          session={session}
          now={now}
          onContinuar={continuar}
          onDescartar={descartar}
        />
      ) : screen.kind === "gravacao" && session ? (
        <EcraGravacao
          tokens={tokens}
          tema={tema}
          session={session}
          now={now}
          gpsLinha={linhaGps()}
          avisos={avisosDe(feedWanted)}
          onMarca={marcar}
          onNovaRonda={novaRonda}
          catalogo={catalogo}
          onRegistar={(block, input) => registar(session.id, block, input)}
          onMudarPara={mudarPara}
          onParar={parar}
        />
      ) : screen.kind === "resumo" ? (
        <EcraResumo
          tokens={tokens}
          tema={tema}
          session={screen.session}
          voltar={screen.doHistorico ? abrirHistorico : undefined}
          onConcluir={screen.doHistorico ? undefined : irInicio}
          onRegistar={(block, input) => registar(screen.session.id, block, input)}
          catalogo={catalogo}
        />
      ) : screen.kind === "historico" ? (
        <EcraHistorico
          tokens={tokens}
          tema={tema}
          sessoes={screen.sessions}
          now={now}
          aConfirmar={aConfirmar}
          onAbrir={(s) => {
            const cheia = getStore().byId(s.id);
            if (cheia) setScreen({ kind: "resumo", session: cheia, doHistorico: true });
          }}
          onPedirApagar={setAConfirmar}
          onCancelarApagar={() => setAConfirmar(null)}
          onApagar={apagar}
          onDefinicoes={() => setScreen({ kind: "definicoes", voltarPara: "historico" })}
          onInicio={irInicio}
          rodape={
            <View style={{ marginTop: E.e6, gap: E.e2 }}>
              <Botao
                tokens={tokens}
                testID="btn-export"
                rotulo={t("mobile.exportData")}
                desativado={exportState.kind === "busy"}
                onPress={doExport}
              />
              {exportState.kind === "error" ? (
                <Text testID="export-problem" style={texto(13, 400, tokens.acentoTinta)}>
                  {t("mobile.exportFailed")} · {exportState.message}
                </Text>
              ) : exportState.kind === "done" ? (
                <Text testID="export-done" style={texto(13, 400, tokens.tinta3)}>
                  {exportState.files.join(" · ")}
                </Text>
              ) : null}
            </View>
          }
        />
      ) : screen.kind === "definicoes" ? (
        <EcraDefinicoes
          tokens={tokens}
          preset={preset}
          onPreset={escolherPreset}
          onVoltar={() => (screen.voltarPara === "historico" ? abrirHistorico() : irInicio())}
        />
      ) : (
        <ScrollView />
      )}
    </View>
  );
}
