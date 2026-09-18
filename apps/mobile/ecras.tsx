import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  SPORT_PACE_KIND,
  VALUE_FIELDS_BY_SPORT,
  aggregateBySport,
  blockMetrics,
  blockRecord,
  blocksFromEvents,
  currentSport,
  distanceTotals,
  durationMs,
  formatClock,
  formatDay,
  formatDuration,
  formatPace,
  hasGpsSegment,
  recentMetrics,
  roundsFromEvents,
  segmentMetrics,
  segmentsFromEvents,
  sessionMetrics,
  sportHasGps,
  type Block,
  type RecordInput,
  type SegmentMetrics,
  type Session,
  type Sport,
} from "@bricklap/engine";
import { formatDistanceForUnit, formatPaceForUnit, formatSpeedForUnit } from "@bricklap/i18n";
import { locale, t } from "./i18n";
import type { SessionSummary } from "./persistence";
import { Botao, Cartao, Kicker, Pilula, Seccao, Tijolo } from "./ui/componentes";
import { EscolhaDesporto } from "./ui/escolhaDesporto";
import { BotaoPremir, Cabeca, FUNDO, LinhaBloco, LinhaRonda, Redondo, TOPO, Tabs } from "./ui/estrutura";
import { FichaValores, formatarCampo, resumoDosValores } from "./ui/ficha";
import { Fiada, type TrocoFiada } from "./ui/fiada";
import { Icone } from "./ui/icones";
import { BotaoMarca } from "./ui/marca";
import { kicker, numero, texto } from "./ui/tipografia";
import { COR_DESPORTO, E, ORDEM_GINASIO, ORDEM_RUA, PRESETS, R, type Preset, type Superficie, type Tokens } from "./ui/tokens";

/**
 * Os ecrãs, com o sistema visual de `docs/DESIGN.md` aplicado: início,
 * gravação, retoma, resumo, histórico e definições. Nenhum sabe qual é o
 * preset de tema ativo — recebe os tokens do seu próprio tema e desenha.
 *
 * Desde a sessão 26 (ADR 0011) um bloco pode ter valores — metros e split
 * no remo, km/h ou distância na passadeira, exercício, repetições e carga —
 * e uma ronda: a ficha (`ui/ficha.tsx`) abre na gravação, para este bloco ou
 * o anterior, e no resumo, sobre qualquer bloco. O que NÃO está aqui, de
 * propósito, porque é a sessão seguinte: planos de treino, comparação com
 * treinos anteriores, gráficos.
 */

/** "3 blocos" / "1 bloco". Recebe as palavras já traduzidas: uma chave montada
 * em runtime não é verificável, e o dicionário é tipado de propósito. */
function plural(n: number, uma: string, varias: string): string {
  return `${n} ${n === 1 ? uma : varias}`;
}

function ritmo(sport: Sport, m: SegmentMetrics): string | null {
  const tipo = SPORT_PACE_KIND[sport];
  if (tipo === "pace") return formatPaceForUnit(m.distanceM, m.durationMs);
  if (tipo === "speed") return formatSpeedForUnit(m.avgSpeedMps);
  return null;
}

/** Os troços da fiada: um por bloco, com a sua duração. */
function trocos(session: Session, blocos: Block[], now: number): TrocoFiada[] {
  return blocos.map((b) => ({ sport: b.sport, ms: blockMetrics(session, b, now).durationMs }));
}

/** Sem planos, uma sessão chama-se pelos desportos que teve. */
function nomeDaSessao(session: Session): string {
  const desportos = [...new Set(segmentsFromEvents(session.events).map((s) => s.sport))];
  return desportos.map((d) => t(`sport.${d}.label`)).join(" + ");
}

/**
 * O valor de um bloco: a distância medida, quando o desporto a mede (nunca
 * "0 m"); senão os valores registados e derivados (ADR 0011), se os houver.
 */
function valorDoBloco(session: Session, b: Block, now: number): string | null {
  if (!sportHasGps(b.sport)) return resumoDosValores(session, b, now);
  return formatDistanceForUnit(blockMetrics(session, b, now).distanceM);
}

/** O nome de um bloco na lista: o exercício registado, ou o desporto. */
function nomeDoBloco(session: Session, b: Block): string {
  return blockRecord(session.events, b.index).exercise ?? t(`sport.${b.sport}.label`);
}

/** Um bloco que aceita valores e ainda não tem nenhum. */
function porPreencher(session: Session, b: Block, now: number): boolean {
  return VALUE_FIELDS_BY_SPORT[b.sport].length > 0 && valorDoBloco(session, b, now) === null;
}

// ---------------------------------------------------------------------------
// 1. Início
// ---------------------------------------------------------------------------

export function EcraInicio(props: {
  tokens: Tokens;
  tema: Superficie;
  onIniciar: (s: Sport) => void;
  onDefinicoes: () => void;
  onHistorico: () => void;
  simEnabled: boolean;
  onSimEnabled: (v: boolean) => void;
  avisos: React.ReactNode;
}) {
  const { tokens, tema } = props;
  const grelha = (desportos: Sport[]) => (
    <View style={{ gap: E.e2 }}>
      {[desportos.slice(0, 2), desportos.slice(2, 4)].map((par, i) => (
        <View key={i} style={{ flexDirection: "row", gap: E.e2 }}>
          {par.map((s) => (
            <Tijolo
              key={s}
              tokens={tokens}
              testID={`start-sport-${s}`}
              rotulo={t(`sport.${s}.label`)}
              icone={s}
              corDoIcone={COR_DESPORTO[tema][s]}
              onPress={() => props.onIniciar(s)}
            />
          ))}
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1, paddingTop: TOPO }}>
      <Cabeca
        tokens={tokens}
        logotipo
        titulo={t("mobile.startTitle")}
        sub={t("mobile.startSubtitle")}
        direita={
          <Redondo
            tokens={tokens}
            icone="definicoes"
            rotulo={t("common.settings")}
            testID="btn-definicoes"
            onPress={props.onDefinicoes}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: E.e5, paddingBottom: E.e6 }}>
        {__DEV__ ? (
          <Seccao tokens={tokens} titulo={t("mobile.gpsSource")}>
            <View style={{ flexDirection: "row", gap: E.e2 }}>
              <Botao
                tokens={tokens}
                testID="gps-source-gps"
                rotulo={t("mobile.gpsReal")}
                tipo={props.simEnabled ? "normal" : "acento"}
                pequeno
                onPress={() => props.onSimEnabled(false)}
              />
              <Botao
                tokens={tokens}
                testID="gps-source-sim"
                rotulo={t("mobile.gpsSim")}
                tipo={props.simEnabled ? "acento" : "normal"}
                pequeno
                onPress={() => props.onSimEnabled(true)}
              />
            </View>
          </Seccao>
        ) : null}
        <Seccao tokens={tokens} titulo={t("mobile.gymGroup")}>
          {grelha(ORDEM_GINASIO)}
        </Seccao>
        <Seccao tokens={tokens} titulo={t("mobile.streetGroup")}>
          {grelha(ORDEM_RUA)}
        </Seccao>
        {props.avisos}
      </ScrollView>
      <Tabs
        tokens={tokens}
        ativo="inicio"
        rotuloInicio={t("mobile.tabHome")}
        rotuloHistorico={t("mobile.tabHistory")}
        onInicio={() => undefined}
        onHistorico={props.onHistorico}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. Gravação — o único ecrã de treino
// ---------------------------------------------------------------------------

export function EcraGravacao(props: {
  tokens: Tokens;
  tema: Superficie;
  session: Session;
  now: number;
  gpsLinha: string | null;
  avisos: React.ReactNode;
  onMarca: () => void;
  onNovaRonda: () => void;
  onRegistar: (block: Block, input: RecordInput) => void;
  onMudarPara: (s: Sport) => void;
  onParar: () => void;
}) {
  const { tokens, tema, session, now } = props;
  const [aEscolherDesporto, setAEscolherDesporto] = useState(false);
  const [aRegistar, setARegistar] = useState(false);
  const sport = currentSport(session.events) ?? "run";
  const blocos = blocksFromEvents(session.events);
  const fechados = blocos.filter((b) => b.endAt !== null);
  const atual = blocos[blocos.length - 1];
  const anterior = fechados[fechados.length - 1];
  const rondas = roundsFromEvents(session.events);
  const segmentos = segmentsFromEvents(session.events);
  const segmentoAtual = segmentos[segmentos.length - 1];
  const temGps = sportHasGps(sport);
  const mAtual = atual ? blockMetrics(session, atual, now) : null;
  const total = sessionMetrics(session, now);
  const mSegmento = segmentoAtual ? segmentMetrics(session, segmentoAtual, now) : null;
  const rAtual = segmentoAtual && temGps ? ritmo(sport, recentMetrics(session, segmentoAtual, now)) : null;

  return (
    <View style={{ flex: 1, paddingTop: TOPO }}>
      <View
        style={{
          paddingHorizontal: E.e5,
          paddingTop: E.e2,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: E.e2,
        }}
      >
        <Text style={texto(14.5, 700, tokens.tinta)}>{t(`sport.${sport}.label`)}</Text>
        <View style={{ flexDirection: "row", gap: E.e1 }}>
          {rondas.length > 0 ? <Pilula tokens={tokens} rotulo={t("mobile.roundN", { n: String(rondas.length) })} /> : null}
          <Pilula tokens={tokens} rotulo={t("mobile.currentBlock", { n: String(blocos.length) })} />
        </View>
      </View>

      <View style={{ paddingHorizontal: E.e5, paddingTop: E.e4 }}>
        <Text testID="chrono" style={numero(84, 800, tokens.tinta, { lineHeight: 84 * 0.92, letterSpacing: -2.94 })}>
          {formatDuration(durationMs(session, now))}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: E.e2 }}>
          <Icone nome="relogio" cor={tokens.tinta2} tamanho={18} />
          <Text style={texto(13, 500, tokens.tinta2)}>
            {t("mobile.since", { startedAt: formatClock(session.createdAt, locale) })} ·{" "}
            {plural(fechados.length, t("mobile.marksOne"), t("mobile.marksOther"))}
          </Text>
        </View>
        <Fiada blocos={trocos(session, fechados, now)} tema={tema} alta estilo={{ marginTop: E.e3 }} />
      </View>

      <Cartao tokens={tokens} estilo={{ marginHorizontal: E.e5, marginTop: E.e4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: E.e2 }}>
          <Icone nome={sport} cor={COR_DESPORTO[tema][sport]} tamanho={18} />
          <Text style={kicker(COR_DESPORTO[tema][sport])}>{t(`sport.${sport}.live`)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: E.e2 }}>
          <Text style={texto(28, 800, tokens.tinta, { letterSpacing: -0.56 })}>{t(`sport.${sport}.label`)}</Text>
          <Text style={numero(38, 700, tokens.tinta, { letterSpacing: -1.14 })}>
            {formatDuration(mAtual?.durationMs ?? 0)}
          </Text>
        </View>
        {temGps && mSegmento ? (
          <View style={{ flexDirection: "row", gap: E.e6, marginTop: E.e3 }}>
            <View>
              <Text style={{ ...texto(11.5, 600, tokens.tinta3), textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("common.distance")}
              </Text>
              <Text style={numero(22, 800, tokens.tinta, { letterSpacing: -0.44 })}>
                {formatDistanceForUnit(mSegmento.distanceM)}
              </Text>
            </View>
            {rAtual ? (
              <View>
                <Text style={{ ...texto(11.5, 600, tokens.tinta3), textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {SPORT_PACE_KIND[sport] === "pace" ? t("mobile.currentPace") : t("mobile.currentSpeed")}
                </Text>
                <Text style={numero(22, 800, tokens.tinta, { letterSpacing: -0.44 })}>{rAtual}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {props.gpsLinha ? (
          <Text testID="gps-line" style={numero(12, 600, tokens.tinta3)}>
            {props.gpsLinha}
          </Text>
        ) : null}
      </Cartao>

      <ScrollView contentContainerStyle={{ paddingHorizontal: E.e5, paddingTop: E.e3 }}>
        {hasGpsSegment(session.events) ? (
          <Text style={texto(13, 500, tokens.tinta2, { marginBottom: E.e2 })}>
            {t("mobile.totalDistanceLabel")} ·{" "}
            <Text style={numero(13, 700, tokens.tinta)}>{formatDistanceForUnit(total.distanceM)}</Text>
          </Text>
        ) : null}
        {fechados
          .slice(-3)
          .reverse()
          .map((b, i) => (
            <LinhaBloco
              key={b.index}
              tokens={tokens}
              primeira={i === 0}
              icone={b.sport}
              corDoIcone={COR_DESPORTO[tema][b.sport]}
              nome={nomeDoBloco(session, b)}
              valor={valorDoBloco(session, b, now)}
              tempo={formatDuration(blockMetrics(session, b, now).durationMs)}
            />
          ))}
        {props.avisos}
      </ScrollView>

      <View style={{ paddingHorizontal: E.e5, paddingTop: E.e3, paddingBottom: FUNDO, gap: E.e2 }}>
        <View style={{ flexDirection: "row", gap: E.e2 }}>
          <Botao
            tokens={tokens}
            testID="btn-round"
            rotulo={t("mobile.newRound")}
            estilo={{ flex: 1 }}
            onPress={props.onNovaRonda}
          />
          <Botao
            tokens={tokens}
            testID="btn-record"
            rotulo={t("mobile.record")}
            estilo={{ flex: 1 }}
            onPress={() => setARegistar(true)}
          />
        </View>
        <BotaoMarca tokens={tokens} rotulo={t("common.mark")} onMarca={props.onMarca} />
        <View style={{ flexDirection: "row", gap: E.e2 }}>
          <Botao
            tokens={tokens}
            testID="btn-change"
            rotulo={t("common.change")}
            icone="mudar"
            estilo={undefined}
            onPress={() => setAEscolherDesporto(true)}
          />
          <BotaoPremir
            tokens={tokens}
            testID="btn-stop"
            rotulo={t("common.stop")}
            icone="parar"
            ms={800}
            perigo
            estilo={{ flex: 1 }}
            onCompleto={props.onParar}
          />
        </View>
      </View>

      <EscolhaDesporto
        tokens={tokens}
        tema={tema}
        visivel={aEscolherDesporto}
        atual={sport}
        onEscolher={(s) => {
          setAEscolherDesporto(false);
          props.onMudarPara(s);
        }}
        onCancelar={() => setAEscolherDesporto(false)}
      />
      {atual ? (
        <FichaValores
          tokens={tokens}
          tema={tema}
          visivel={aRegistar}
          session={session}
          now={now}
          blocos={anterior ? [atual, anterior] : [atual]}
          onGuardar={(block, input) => {
            setARegistar(false);
            props.onRegistar(block, input);
          }}
          onCancelar={() => setARegistar(false)}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3. Retoma
// ---------------------------------------------------------------------------

export function EcraRetoma(props: {
  tokens: Tokens;
  tema: Superficie;
  session: Session;
  now: number;
  onContinuar: () => void;
  onDescartar: () => void;
}) {
  const { tokens, tema, session, now } = props;
  const blocos = blocksFromEvents(session.events);
  return (
    <View style={{ flex: 1, paddingTop: TOPO }}>
      <Cabeca tokens={tokens} logotipo titulo={t("mobile.resumeTitle")} sub={t("mobile.resumeCopy")} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: E.e5, paddingTop: E.e4, paddingBottom: E.e6 }}>
        <Text style={numero(72, 800, tokens.tinta, { lineHeight: 72 * 0.9, letterSpacing: -2.88 })}>
          {formatDuration(durationMs(session, now))}
        </Text>
        <Fiada blocos={trocos(session, blocos, now)} tema={tema} alta estilo={{ marginTop: E.e3 }} />
        <Seccao tokens={tokens} titulo={t("mobile.blocksSection")} lado={plural(blocos.length, t("mobile.blocksOne"), t("mobile.blocksOther"))}>
          <View style={{ backgroundColor: tokens.sup, borderWidth: 1, borderColor: tokens.linha, borderRadius: R.m }}>
            {blocos.map((b, i) => (
              <LinhaBloco
                key={b.index}
                tokens={tokens}
                primeira={i === 0}
                icone={b.sport}
                corDoIcone={COR_DESPORTO[tema][b.sport]}
                nome={nomeDoBloco(session, b)}
                valor={valorDoBloco(session, b, now)}
                tempo={formatDuration(blockMetrics(session, b, now).durationMs)}
              />
            ))}
          </View>
        </Seccao>
      </ScrollView>
      <View style={{ paddingHorizontal: E.e5, paddingBottom: FUNDO, gap: E.e2 }}>
        <Botao tokens={tokens} testID="btn-continue" rotulo={t("common.continue")} tipo="acento" largo onPress={props.onContinuar} />
        <Botao tokens={tokens} testID="btn-discard" rotulo={t("common.discard")} tipo="perigo" largo onPress={props.onDescartar} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 4. Resumo
// ---------------------------------------------------------------------------

export function EcraResumo(props: {
  tokens: Tokens;
  tema: Superficie;
  session: Session;
  voltar?: () => void;
  onConcluir?: () => void;
  /** A porta do fim (ADR 0011): escreve os valores de um bloco desta sessão. */
  onRegistar?: (block: Block, input: RecordInput) => void;
}) {
  const { tokens, tema, session } = props;
  const [blocoAEditar, setBlocoAEditar] = useState<Block | null>(null);
  const fim = Date.now();
  const blocos = blocksFromEvents(session.events);
  const segmentos = segmentsFromEvents(session.events);
  const rondas = roundsFromEvents(session.events);
  const total = sessionMetrics(session);
  const comGps = hasGpsSegment(session.events) && total.distanceM >= 1;
  const totais = distanceTotals(session, fim);
  const porDesporto = aggregateBySport(session, fim);
  const aPreencher = blocos.filter((b) => porPreencher(session, b, fim)).length;
  const editavel = (b: Block) => props.onRegistar !== undefined && VALUE_FIELDS_BY_SPORT[b.sport].length > 0;

  /** Uma linha por desporto: blocos, tempo, distância (medida ou declarada) e ritmo ou velocidade. */
  const linhaDesporto = (a: (typeof porDesporto)[number]): string => {
    const partes = [plural(a.blocks, t("mobile.blocksOne"), t("mobile.blocksOther")), formatDuration(a.durationMs)];
    if (a.measuredM >= 1) partes.push(formatDistanceForUnit(a.measuredM));
    if (a.declaredM >= 1) partes.push(`${formatDistanceForUnit(a.declaredM)} ${t("mobile.declaredDistance")}`);
    if (a.secPerKm !== null) {
      const metros = a.measuredM + a.declaredM;
      if (SPORT_PACE_KIND[a.sport] === "speed" || a.sport === "treadmill") partes.push(formatarCampo("speedKmh", (metros / (a.pacedMs / 1000)) * 3.6));
      else if (a.sport === "rowing_indoor") partes.push(`${formatDuration((a.pacedMs / 1000 / (metros / 500)) * 1000)}/500`);
      else partes.push(formatPace(metros, a.pacedMs));
    }
    return partes.join(" · ");
  };
  return (
    <View style={{ flex: 1, paddingTop: TOPO }}>
      <Cabeca
        tokens={tokens}
        rotulo={props.voltar ? undefined : t("common.summary")}
        voltar={props.voltar ? { rotulo: t("mobile.tabHistory"), onPress: props.voltar } : undefined}
        direita={<Pilula tokens={tokens} rotulo={formatClock(session.createdAt, locale)} />}
        titulo={nomeDaSessao(session)}
        sub={`${plural(blocos.length, t("mobile.blocksOne"), t("mobile.blocksOther"))}${
          segmentos.length > 1 ? ` · ${plural(segmentos.length, t("common.segments").toLowerCase(), t("common.segments").toLowerCase())}` : ""
        }`}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: E.e5, paddingTop: E.e3, paddingBottom: E.e6 }}>
        <Text style={numero(72, 800, tokens.tinta, { lineHeight: 72 * 0.9, letterSpacing: -2.88 })}>
          {formatDuration(durationMs(session))}
        </Text>
        {comGps ? (
          <Text style={texto(13, 500, tokens.tinta2, { marginTop: 6 })}>
            <Text style={numero(16, 800, tokens.tinta)}>{formatDistanceForUnit(total.distanceM)}</Text>{" "}
            {t("common.distance").toLowerCase()}
          </Text>
        ) : null}
        {totais.declaredM >= 1 ? (
          <Text testID="declared-distance" style={texto(13, 500, tokens.tinta2, { marginTop: 4 })}>
            <Text style={numero(16, 800, tokens.tinta)}>{formatDistanceForUnit(totais.declaredM)}</Text>{" "}
            {t("common.distance").toLowerCase()} · {t("mobile.declaredDistance")}
          </Text>
        ) : null}
        <Fiada blocos={trocos(session, blocos, fim)} tema={tema} alta estilo={{ marginTop: E.e3 }} />
        <Seccao
          tokens={tokens}
          titulo={t("mobile.blocksSection")}
          lado={`${plural(blocos.length, t("mobile.blocksOne"), t("mobile.blocksOther"))}${
            rondas.length > 0 ? ` · ${rondas.length} ${t("mobile.round").toLowerCase()}${rondas.length === 1 ? "" : "s"}` : ""
          }`}
        >
          {props.onRegistar && aPreencher > 0 ? (
            <Text style={texto(12.5, 400, tokens.tinta2)}>{t("mobile.tapToRecord")}</Text>
          ) : null}
          <View style={{ backgroundColor: tokens.sup, borderWidth: 1, borderColor: tokens.linha, borderRadius: R.m, overflow: "hidden" }}>
            {blocos.map((b, i) => {
              const abreRonda = rondas.length > 0 && (i === 0 || b.round !== blocos[i - 1]!.round);
              return (
                <View key={b.index}>
                  {abreRonda ? (
                    <LinhaRonda
                      tokens={tokens}
                      primeira={i === 0}
                      rotulo={b.round === null ? t("mobile.noRound") : t("mobile.roundN", { n: String(b.round + 1) })}
                    />
                  ) : null}
                  <LinhaBloco
                    tokens={tokens}
                    primeira={i === 0 || abreRonda}
                    icone={b.sport}
                    corDoIcone={COR_DESPORTO[tema][b.sport]}
                    nome={nomeDoBloco(session, b)}
                    valor={valorDoBloco(session, b, fim)}
                    porPreencher={editavel(b) && porPreencher(session, b, fim) ? t("mobile.record") : undefined}
                    tempo={formatDuration(blockMetrics(session, b, fim).durationMs)}
                    testID={`block-${b.index}`}
                    onPress={editavel(b) ? () => setBlocoAEditar(b) : undefined}
                  />
                </View>
              );
            })}
          </View>
        </Seccao>
        {porDesporto.length > 1 || porDesporto.some((a) => a.declaredM >= 1) ? (
          <Seccao tokens={tokens} titulo={t("mobile.perSport")}>
            <View style={{ backgroundColor: tokens.sup, borderWidth: 1, borderColor: tokens.linha, borderRadius: R.m }}>
              {porDesporto.map((a, i) => (
                <View
                  key={a.sport}
                  testID={`per-sport-${a.sport}`}
                  style={{ paddingVertical: 10, paddingHorizontal: E.e3, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: tokens.linha, gap: 2 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Icone nome={a.sport} cor={COR_DESPORTO[tema][a.sport]} tamanho={18} />
                    <Text style={texto(14, 600, tokens.tinta)}>{t(`sport.${a.sport}.label`)}</Text>
                  </View>
                  <Text style={numero(12.5, 600, tokens.tinta2)}>{linhaDesporto(a)}</Text>
                </View>
              ))}
            </View>
          </Seccao>
        ) : null}
        {props.onConcluir ? (
          <View style={{ marginTop: E.e6 }}>
            <Botao
              tokens={tokens}
              testID="btn-new-session"
              rotulo={t("common.done")}
              icone="certo"
              tipo="acento"
              largo
              onPress={props.onConcluir}
            />
          </View>
        ) : null}
      </ScrollView>
      {blocoAEditar && props.onRegistar ? (
        <FichaValores
          tokens={tokens}
          tema={tema}
          visivel
          session={session}
          now={fim}
          blocos={[blocoAEditar]}
          onGuardar={(block, input) => {
            setBlocoAEditar(null);
            props.onRegistar?.(block, input);
          }}
          onCancelar={() => setBlocoAEditar(null)}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. Histórico
// ---------------------------------------------------------------------------

export function EcraHistorico(props: {
  tokens: Tokens;
  tema: Superficie;
  sessoes: SessionSummary[];
  now: number;
  aConfirmar: string | null;
  onAbrir: (s: Session) => void;
  onPedirApagar: (id: string) => void;
  onCancelarApagar: () => void;
  onApagar: (id: string) => void;
  onDefinicoes: () => void;
  onInicio: () => void;
  rodape: React.ReactNode;
}) {
  const { tokens, tema } = props;
  const linhas = [...props.sessoes].reverse();
  return (
    <View style={{ flex: 1, paddingTop: TOPO }}>
      <Cabeca
        tokens={tokens}
        logotipo
        titulo={t("mobile.history")}
        sub={plural(linhas.length, t("mobile.sessionsOne"), t("mobile.sessionsOther"))}
        direita={
          <Redondo tokens={tokens} icone="definicoes" rotulo={t("common.settings")} onPress={props.onDefinicoes} />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: E.e5, paddingTop: E.e4, paddingBottom: E.e6, gap: E.e2 }}>
        {linhas.length === 0 ? (
          <Text style={texto(15, 400, tokens.tinta3, { textAlign: "center", paddingVertical: E.e7 })}>
            {t("mobile.noSessions")}
          </Text>
        ) : null}
        {linhas.map(({ session, discarded }) => {
          const blocos = blocksFromEvents(session.events);
          const fim = session.status === "live" ? props.now : undefined;
          const estado = discarded ? t("mobile.discarded") : session.status === "live" ? t("mobile.inProgress") : null;
          // Só distância a sério: uma sessão de rua sem fixes (GPS desligado,
          // permissão recusada) media 0 e escrevia "0 m", que é a mesma
          // poluição que a regra do ADR 0008 tira aos blocos de ginásio.
          const metros = hasGpsSegment(session.events) ? sessionMetrics(session, props.now).distanceM : 0;
          const distancia = metros >= 1 ? formatDistanceForUnit(metros) : null;
          const meta = [plural(blocos.length, t("mobile.blocksOne"), t("mobile.blocksOther")), distancia, estado]
            .filter(Boolean)
            .join(" · ");
          const confirmar = props.aConfirmar === session.id;
          return (
            <View
              key={session.id}
              style={{
                backgroundColor: tokens.sup,
                borderWidth: 1,
                borderColor: tokens.linha,
                borderRadius: R.g,
                paddingHorizontal: E.e4,
                paddingVertical: E.e3,
              }}
            >
              <Text
                accessibilityRole="button"
                onPress={() => props.onAbrir(session)}
                style={{ ...kicker(tokens.tinta3), fontSize: 11 }}
              >
                {`${formatDay(session.createdAt, locale)} · ${formatClock(session.createdAt, locale)}`}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: E.e2 }}>
                <Text
                  accessibilityRole="button"
                  onPress={() => props.onAbrir(session)}
                  numberOfLines={1}
                  style={texto(17, 800, tokens.tinta, { flex: 1, letterSpacing: -0.26, marginTop: 2 })}
                >
                  {nomeDaSessao(session)}
                </Text>
                <Text style={numero(19, 800, tokens.tinta, { letterSpacing: -0.38 })}>
                  {formatDuration(durationMs(session, fim ?? props.now))}
                </Text>
              </View>
              <Text style={texto(13, 400, tokens.tinta2)}>{meta}</Text>
              <Fiada blocos={trocos(session, blocos, props.now)} tema={tema} estilo={{ marginTop: E.e3 }} />
              {confirmar ? (
                <View
                  style={{
                    marginTop: E.e3,
                    paddingTop: E.e3,
                    borderTopWidth: 1,
                    borderTopColor: tokens.acento,
                    borderStyle: "dashed",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: E.e2,
                  }}
                >
                  <Text style={texto(13, 700, tokens.acentoTinta, { flex: 1 })}>{t("mobile.deleteAsk")}</Text>
                  <Botao tokens={tokens} rotulo={t("common.keep")} pequeno onPress={props.onCancelarApagar} />
                  <Botao
                    tokens={tokens}
                    testID="btn-delete-confirm"
                    rotulo={t("common.delete")}
                    icone="apagar"
                    tipo="acento"
                    pequeno
                    onPress={() => props.onApagar(session.id)}
                  />
                </View>
              ) : (
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: E.e2 }}>
                  <Botao
                    tokens={tokens}
                    rotulo={t("common.delete")}
                    icone="apagar"
                    tipo="fantasma"
                    pequeno
                    onPress={() => props.onPedirApagar(session.id)}
                  />
                </View>
              )}
            </View>
          );
        })}
        {props.rodape}
      </ScrollView>
      <Tabs
        tokens={tokens}
        ativo="historico"
        rotuloInicio={t("mobile.tabHome")}
        rotuloHistorico={t("mobile.tabHistory")}
        onInicio={props.onInicio}
        onHistorico={() => undefined}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 6. Definições — o seletor de tema
// ---------------------------------------------------------------------------

const AMOSTRAS: Record<Preset, [Superficie, Superficie]> = {
  claro: ["claro", "claro"],
  escuro: ["escuro", "escuro"],
  hibrido: ["escuro", "claro"],
  sistema: ["escuro", "claro"],
};

/** Nome e explicação de cada preset, com as chaves escritas por extenso. */
function textoDoPreset(p: Preset): { nome: string; exp: string } {
  if (p === "claro") return { nome: t("mobile.themeLight"), exp: t("mobile.themeLightCopy") };
  if (p === "escuro") return { nome: t("mobile.themeDark"), exp: t("mobile.themeDarkCopy") };
  if (p === "hibrido") return { nome: t("mobile.themeHybrid"), exp: t("mobile.themeHybridCopy") };
  return { nome: t("mobile.themeSystem"), exp: t("mobile.themeSystemCopy") };
}

export function EcraDefinicoes(props: { tokens: Tokens; preset: Preset; onPreset: (p: Preset) => void; onVoltar: () => void }) {
  const { tokens } = props;
  const amostra = (s: Superficie) => (
    <View
      style={{
        width: 17,
        height: 34,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: "rgba(128,118,108,0.45)",
        backgroundColor: s === "escuro" ? "#17140F" : "#FBF8F4",
      }}
    />
  );
  return (
    <View style={{ flex: 1, paddingTop: TOPO }}>
      <Cabeca
        tokens={tokens}
        voltar={{ rotulo: t("common.home"), onPress: props.onVoltar }}
        titulo={t("common.settings")}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: E.e5, paddingBottom: FUNDO }}>
        <Seccao tokens={tokens} titulo={t("mobile.themeTitle")}>
          <View style={{ gap: E.e2 }}>
            {PRESETS.map((p) => {
              const ativa = props.preset === p;
              const { nome, exp } = textoDoPreset(p);
              return (
                <Text
                  key={p}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativa }}
                  accessibilityLabel={nome}
                  onPress={() => props.onPreset(p)}
                  suppressHighlighting
                  style={{ borderRadius: R.g }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: E.e3,
                      backgroundColor: ativa ? tokens.acentoFundo : tokens.sup,
                      borderWidth: 1.5,
                      borderColor: ativa ? tokens.acento : tokens.linha,
                      borderRadius: R.g,
                      paddingHorizontal: E.e4,
                      paddingVertical: E.e3,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
                      {amostra(AMOSTRAS[p][0])}
                      <View style={{ width: 7, height: 22, borderRadius: 2, backgroundColor: tokens.acento }} />
                      {amostra(AMOSTRAS[p][1])}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={texto(16, 800, tokens.tinta)}>
                        {nome}
                        {p === "hibrido" ? (
                          <Text style={{ ...kicker(tokens.acentoTinta), fontSize: 11 }}> {t("mobile.themeDefault")}</Text>
                        ) : null}
                      </Text>
                      <Text style={texto(12.5, 400, tokens.tinta2, { marginTop: 2 })}>
                        {exp}
                      </Text>
                    </View>
                    <Icone nome="certo" cor={ativa ? tokens.acentoTinta : tokens.linha} tamanho={18} />
                  </View>
                </Text>
              );
            })}
          </View>
          <Text style={texto(12, 400, tokens.tinta3, { marginTop: E.e2, lineHeight: 17 })}>{t("mobile.themeNote")}</Text>
        </Seccao>

        <Seccao tokens={tokens} titulo={t("mobile.unitsTitle")}>
          <Cartao tokens={tokens} estilo={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={texto(15, 700, tokens.tinta)}>{t("mobile.unitsMetric")}</Text>
            <Text style={texto(13, 400, tokens.tinta3)}>{t("mobile.unitsMetricDetail")}</Text>
          </Cartao>
        </Seccao>

        <Seccao tokens={tokens} titulo={t("mobile.aboutTitle")}>
          <Cartao tokens={tokens}>
            <Text style={texto(14, 400, tokens.tinta2, { lineHeight: 21 })}>{t("mobile.aboutCopy")}</Text>
          </Cartao>
        </Seccao>
      </ScrollView>
    </View>
  );
}
