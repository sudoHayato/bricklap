import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  VALUE_FIELDS_BY_SPORT,
  blockFigures,
  blockMetrics,
  blockRecord,
  exerciseKey,
  exercisesUsed,
  formatDuration,
  type Block,
  type RecordInput,
  type RecordedValues,
  type Session,
  type ValueField,
} from "@bricklap/engine";
import { formatDistanceForUnit, formatSpeedForUnit } from "@bricklap/i18n";
import { t } from "../i18n";
import { Icone } from "./icones";
import { numero, texto } from "./tipografia";
import { COR_DESPORTO, E, R, TOQUE, type Superficie, type Tokens } from "./tokens";

/**
 * A ficha de valores — as duas portas do ADR 0011 num só ecrã (DESIGN.md §6,
 * "Ficha rápida"). Abre sobre a gravação, para este bloco ou para o anterior
 * (o número da máquina ainda está no mostrador), e abre no resumo, sobre
 * qualquer bloco, para completar ou corrigir. Escreve sempre da mesma
 * maneira: um `recorded` acrescentado ao registo, só com os campos que
 * mudaram face ao que já lá estava — a correção é um evento novo, nunca uma
 * reescrita, e guardar sem mudar nada não escreve nada.
 *
 * Campos por desporto (`VALUE_FIELDS_BY_SPORT`): remo, metros e o split da
 * máquina; passadeira, km/h ou distância, o outro calculado com o tempo do
 * bloco; exercícios, o nome, repetições e carga. Cada campo é rótulo à
 * esquerda e −/+ de 56 px com o valor à direita; o valor também se escreve
 * à mão. Um campo calculado mostra o valor sem controlo e diz de onde vem.
 */

/** Um rascunho por campo: um número, `null` para limpar, ou nada. */
type Rascunho = Partial<Record<ValueField, number | null>>;

const PASSO: Record<ValueField, number> = { meters: 50, splitS: 1, speedKmh: 0.5, reps: 1, loadKg: 2.5 };
const MINIMO: Record<ValueField, number> = { meters: 0, splitS: 60, speedKmh: 0, reps: 0, loadKg: 0 };

/** m:ss ↔ segundos, para o split. */
export function formatSplit(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
export function parseSplit(text: string): number | null {
  const m = /^\s*(\d{1,2})[:.](\d{1,2})\s*$/.exec(text);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && text.trim() !== "" ? n : null;
}

export function formatarCampo(field: ValueField, value: number): string {
  switch (field) {
    case "meters":
      return formatDistanceForUnit(value);
    case "speedKmh":
      return formatSpeedForUnit(value / 3.6);
    case "splitS":
      return `${formatSplit(value)} /500 m`;
    case "reps":
      return `${Math.round(value)}`;
    case "loadKg":
      return `${Number.isInteger(value) ? value : value.toFixed(1)} kg`;
  }
}

function rotuloDoCampo(field: ValueField): string {
  switch (field) {
    case "meters":
      return t("mobile.meters");
    case "speedKmh":
      return t("mobile.speed");
    case "splitS":
      return t("mobile.split");
    case "reps":
      return t("mobile.reps");
    case "loadKg":
      return t("mobile.load");
  }
}

/** O texto de edição de um valor: o split em m:ss, o resto em número. */
function textoDeEdicao(field: ValueField, value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (field === "splitS") return formatSplit(value);
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function lerTexto(field: ValueField, text: string): number | null {
  if (text.trim() === "") return null;
  if (field === "splitS") return parseSplit(text);
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Rótulo curto de um bloco, para o seletor e a cabeça. */
function nomeDoBloco(session: Session, block: Block): string {
  const exercicio = blockRecord(session.events, block.index).exercise;
  return exercicio ?? t(`sport.${block.sport}.label`);
}

export function FichaValores(props: {
  tokens: Tokens;
  tema: Superficie;
  visivel: boolean;
  session: Session;
  now: number;
  /** Os blocos a que a ficha pode escrever, do mais recente ao mais antigo. */
  blocos: Block[];
  onGuardar: (block: Block, input: RecordInput) => void;
  onCancelar: () => void;
}) {
  const { tokens, tema, session, now } = props;
  const [escolhido, setEscolhido] = useState(0);
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [exercicio, setExercicio] = useState("");
  const [aEditar, setAEditar] = useState<{ field: ValueField; text: string } | null>(null);
  /** Na passadeira: qual dos dois campos o atleta indica; o outro é calculado. */
  const [passadeiraPor, setPassadeiraPor] = useState<"speedKmh" | "meters">("speedKmh");

  const block = props.blocos[escolhido] ?? props.blocos[0];

  // Ao abrir (ou ao trocar de bloco), o rascunho parte do que já está registado.
  useEffect(() => {
    if (!props.visivel) return;
    setEscolhido(0);
  }, [props.visivel]);
  useEffect(() => {
    if (!props.visivel || !block) return;
    const record = blockRecord(session.events, block.index);
    const inicial: Rascunho = {};
    for (const field of VALUE_FIELDS_BY_SPORT[block.sport]) {
      const v = record.values[field];
      if (v) inicial[field] = v.value;
    }
    setRascunho(inicial);
    setExercicio(record.exercise ?? "");
    setAEditar(null);
    if (block.sport === "treadmill") setPassadeiraPor(record.values.meters && !record.values.speedKmh ? "meters" : "speedKmh");
    // Só o bloco escolhido interessa: a sessão muda a cada tick e não deve repor o rascunho.
  }, [props.visivel, block?.index]);

  if (!block) return null;

  const campos = VALUE_FIELDS_BY_SPORT[block.sport];
  const record = blockRecord(session.events, block.index);
  const segundos = blockMetrics(session, block, now).durationMs / 1000;
  /**
   * O valor de um campo, com o que está a ser escrito à mão já contado: no
   * Android tocar em Guardar não tira o foco ao campo de texto, e um número
   * ainda por confirmar tem de valer na mesma.
   */
  const valor = (field: ValueField): number | null => {
    if (aEditar?.field === field) return lerTexto(field, aEditar.text);
    const v = rascunho[field];
    return v === undefined ? null : v;
  };
  const rascunhoEfetivo = (): Rascunho => (aEditar ? { ...rascunho, [aEditar.field]: lerTexto(aEditar.field, aEditar.text) } : rascunho);

  const ajustar = (field: ValueField, delta: number) => {
    const atual = valor(field) ?? (field === "splitS" ? 120 : 0);
    const proximo = Math.max(MINIMO[field], Math.round((atual + delta) * 10) / 10);
    setRascunho({ ...rascunhoEfetivo(), [field]: proximo });
    setAEditar(null);
  };

  const guardar = () => {
    const values: RecordedValues = {};
    for (const field of campos) {
      const antes = record.values[field]?.value ?? null;
      const depois = valor(field);
      if (depois === antes) continue;
      if (depois === null && antes === null) continue;
      values[field] = depois;
    }
    const nomeAntes = exerciseKey(record.exercise);
    const nomeDepois = exerciseKey(exercicio);
    const input: RecordInput = { block: block.index, origin: "declared", values };
    if (nomeDepois !== null && nomeDepois !== nomeAntes) input.exercise = exercicio.trim();
    if (Object.keys(values).length === 0 && input.exercise === undefined) {
      props.onCancelar();
      return;
    }
    props.onGuardar(block, input);
  };

  /** Um campo com −/+ e o valor editável no meio. */
  const campo = (field: ValueField, sub?: string) => {
    const v = valor(field);
    const editando = aEditar?.field === field;
    return (
      <View
        key={field}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: E.e2,
          paddingVertical: E.e3,
          borderTopWidth: 1,
          borderTopColor: tokens.linha,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={texto(16, 800, tokens.tinta)}>{rotuloDoCampo(field)}</Text>
          {sub ? <Text style={texto(12.5, 400, tokens.tinta2)}>{sub}</Text> : null}
        </View>
        <Passo tokens={tokens} rotulo="−" testID={`ficha-${field}-menos`} onPress={() => ajustar(field, -PASSO[field])} />
        <TextInput
          testID={`ficha-${field}`}
          accessibilityLabel={rotuloDoCampo(field)}
          value={editando ? aEditar.text : textoDeEdicao(field, v)}
          placeholder="—"
          placeholderTextColor={tokens.tinta3}
          keyboardType={field === "splitS" ? "numbers-and-punctuation" : "decimal-pad"}
          selectTextOnFocus
          onFocus={() => setAEditar({ field, text: textoDeEdicao(field, v) })}
          onChangeText={(text) => setAEditar({ field, text })}
          onBlur={() => {
            if (!editando) return;
            setRascunho(rascunhoEfetivo());
            setAEditar(null);
          }}
          style={{
            ...numero(26, 800, tokens.tinta),
            minWidth: 96,
            textAlign: "center",
            paddingVertical: 4,
            paddingHorizontal: E.e2,
            borderBottomWidth: 1.5,
            borderBottomColor: editando ? tokens.acento : tokens.linha,
          }}
        />
        <Text style={texto(13, 600, tokens.tinta2, { width: 44 })}>{unidade(field)}</Text>
        <Passo tokens={tokens} rotulo="+" testID={`ficha-${field}-mais`} onPress={() => ajustar(field, PASSO[field])} />
      </View>
    );
  };

  /** Um campo calculado: valor sem controlo, e de onde vem. */
  const calculado = (field: ValueField, explicacao: string, value: number) => (
    <View key={`${field}-calc`} style={{ paddingVertical: E.e3, borderTopWidth: 1, borderTopColor: tokens.linha, gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: E.e2 }}>
        <Text style={texto(16, 800, tokens.tinta)}>{rotuloDoCampo(field)}</Text>
        <Text testID={`ficha-${field}-calculado`} style={numero(22, 800, tokens.tinta)}>
          {formatarCampo(field, value)}
        </Text>
      </View>
      <Text style={texto(12.5, 400, tokens.tinta2)}>{explicacao}</Text>
    </View>
  );

  const corpo = () => {
    if (campos.length === 0) return <Text style={texto(14, 400, tokens.tinta2, { marginTop: E.e4 })}>{t("mobile.nothingToRecord")}</Text>;
    if (block.sport === "treadmill") {
      const primario = passadeiraPor;
      const secundario: ValueField = primario === "speedKmh" ? "meters" : "speedKmh";
      const v = valor(primario);
      let calc: React.ReactNode = null;
      if (v !== null && segundos > 0) {
        if (primario === "speedKmh") {
          const m = (v / 3.6) * segundos;
          calc = calculado("meters", t("mobile.computedFromSpeed", { meters: formatDistanceForUnit(m), speed: formatarCampo("speedKmh", v) }), m);
        } else {
          const kmh = (v / segundos) * 3.6;
          calc = calculado("speedKmh", t("mobile.computedFromDistance", { speed: formatarCampo("speedKmh", kmh), meters: formatDistanceForUnit(v) }), kmh);
        }
      }
      return (
        <>
          {campo(primario)}
          {calc}
          <Chip
            tokens={tokens}
            rotulo={rotuloDoCampo(secundario)}
            ativo={false}
            testID={`ficha-por-${secundario}`}
            onPress={() => {
              // O campo que deixa de ser o indicado limpa-se: só um dos dois é declarado.
              setRascunho({ ...rascunhoEfetivo(), [primario]: null });
              setPassadeiraPor(secundario);
              setAEditar(null);
            }}
          />
        </>
      );
    }
    if (block.sport === "rowing_indoor") {
      const m = valor("meters");
      const split = valor("splitS");
      return (
        <>
          {campo("meters")}
          {campo("splitS", t("mobile.declaredTag"))}
          {split === null && m !== null && m > 0 && segundos > 0
            ? calculado("splitS", t("mobile.computedSplit", { split: formatSplit(segundos / (m / 500)), meters: formatDistanceForUnit(m) }), segundos / (m / 500))
            : null}
        </>
      );
    }
    // Exercícios: o nome, e depois repetições e carga.
    const usados = exercisesUsed(session.events);
    return (
      <>
        <View style={{ paddingTop: E.e3, gap: E.e2 }}>
          <Text style={texto(16, 800, tokens.tinta)}>{t("mobile.exercise")}</Text>
          <TextInput
            testID="ficha-exercicio"
            accessibilityLabel={t("mobile.exercise")}
            value={exercicio}
            onChangeText={setExercicio}
            placeholder={t("mobile.exercisePlaceholder")}
            placeholderTextColor={tokens.tinta3}
            autoCapitalize="none"
            style={{
              ...texto(17, 600, tokens.tinta),
              minHeight: TOQUE,
              paddingHorizontal: E.e3,
              borderRadius: R.m,
              borderWidth: 1.5,
              borderColor: tokens.linha,
              backgroundColor: tokens.sup,
            }}
          />
          {usados.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: E.e2 }}>
              {usados.map((nome) => (
                <Chip
                  key={nome}
                  tokens={tokens}
                  rotulo={nome}
                  ativo={exerciseKey(nome) === exerciseKey(exercicio)}
                  onPress={() => setExercicio(nome)}
                />
              ))}
            </View>
          ) : null}
        </View>
        {campo("reps")}
        {campo("loadKg")}
      </>
    );
  };

  return (
    <Modal visible={props.visivel} transparent animationType="fade" onRequestClose={props.onCancelar} statusBarTranslucent>
      <Pressable
        testID="ficha-backdrop"
        accessibilityLabel={t("common.cancel")}
        style={{ flex: 1, backgroundColor: tokens.veu, justifyContent: "flex-end" }}
        onPress={props.onCancelar}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: tokens.fundo,
            borderTopLeftRadius: R.folha,
            borderTopRightRadius: R.folha,
            paddingTop: E.e3,
            paddingHorizontal: E.e5,
            paddingBottom: E.e6,
            maxHeight: "93%",
          }}
        >
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.linha }} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", alignItems: "center", gap: E.e2, marginTop: E.e3 }}>
              <Icone nome={block.sport} cor={COR_DESPORTO[tema][block.sport]} tamanho={22} />
              <Text style={texto(22, 800, tokens.tinta, { flex: 1 })} numberOfLines={1}>
                {nomeDoBloco(session, block)}
              </Text>
            </View>
            <Text style={texto(13.5, 400, tokens.tinta2, { marginTop: 2 })}>
              {t("mobile.blockContext", { n: String(block.index + 1), time: formatDuration(segundos * 1000) })}
              {block.round !== null ? ` · ${t("mobile.roundN", { n: String(block.round + 1) })}` : ""}
            </Text>
            {props.blocos.length > 1 ? (
              <View style={{ flexDirection: "row", gap: E.e2, marginTop: E.e3 }}>
                {props.blocos.slice(0, 2).map((b, i) => (
                  <Chip
                    key={b.index}
                    tokens={tokens}
                    rotulo={`${i === 0 ? t("mobile.thisBlock") : t("mobile.previousBlock")} · ${nomeDoBloco(session, b)}`}
                    ativo={i === escolhido}
                    testID={`ficha-bloco-${i}`}
                    onPress={() => setEscolhido(i)}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ marginTop: E.e3 }}>{corpo()}</View>
            <View style={{ flexDirection: "row", gap: E.e2, marginTop: E.e5 }}>
              <Pressable
                testID="ficha-depois"
                accessibilityRole="button"
                accessibilityLabel={t("mobile.later")}
                onPress={props.onCancelar}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: TOQUE,
                  borderRadius: R.m,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? tokens.sup2 : "transparent",
                })}
              >
                <Text style={texto(17, 700, tokens.tinta2)}>{t("mobile.later")}</Text>
              </Pressable>
              <Pressable
                testID="ficha-guardar"
                accessibilityRole="button"
                accessibilityLabel={t("mobile.save")}
                disabled={campos.length === 0}
                onPress={guardar}
                style={({ pressed }) => ({
                  flex: 1.6,
                  minHeight: TOQUE,
                  borderRadius: R.m,
                  borderWidth: 1.5,
                  borderColor: tokens.acento,
                  backgroundColor: pressed ? tokens.acentoPremido : tokens.acento,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: E.e2,
                  opacity: campos.length === 0 ? 0.45 : 1,
                })}
              >
                <Icone nome="certo" cor={tokens.sobreAcento} tamanho={22} />
                <Text style={texto(17, 700, tokens.sobreAcento)}>{t("mobile.save")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function unidade(field: ValueField): string {
  switch (field) {
    case "meters":
      return "m";
    case "speedKmh":
      return "km/h";
    case "splitS":
      return "/500 m";
    case "reps":
      return "";
    case "loadKg":
      return "kg";
  }
}

/** O −/+ de 56 px. */
function Passo(props: { tokens: Tokens; rotulo: string; testID?: string; onPress: () => void }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: TOQUE,
        height: TOQUE,
        borderRadius: R.m,
        borderWidth: 1.5,
        borderColor: props.tokens.linha,
        backgroundColor: pressed ? props.tokens.sup2 : props.tokens.sup,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Text style={texto(24, 600, props.tokens.tinta)}>{props.rotulo}</Text>
    </Pressable>
  );
}

/** A pílula de escolha (DESIGN.md §6): contorno `linha`; ativa = fundo `tinta`, texto `fundo`. */
export function Chip(props: { tokens: Tokens; rotulo: string; ativo: boolean; testID?: string; onPress: () => void }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      accessibilityState={{ selected: props.ativo }}
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: E.e4,
        borderRadius: R.pill,
        borderWidth: 1.5,
        borderColor: props.ativo ? props.tokens.tinta : props.tokens.linha,
        backgroundColor: props.ativo ? props.tokens.tinta : pressed ? props.tokens.sup2 : props.tokens.sup,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Text numberOfLines={1} style={texto(14.5, 700, props.ativo ? props.tokens.fundo : props.tokens.tinta)}>
        {props.rotulo}
      </Text>
    </Pressable>
  );
}

/** O que um bloco mostra na sua linha: os valores registados e derivados, numa frase curta. */
export function resumoDosValores(session: Session, block: Block, now: number): string | null {
  const f = blockFigures(session, block, now);
  const partes: string[] = [];
  if (block.sport === "rowing_indoor") {
    if (f.meters) partes.push(formatDistanceForUnit(f.meters.value));
    if (f.splitS) partes.push(`${formatSplit(f.splitS.value)}/500`);
  } else if (block.sport === "treadmill") {
    if (f.speedKmh) partes.push(formatarCampo("speedKmh", f.speedKmh.value));
    if (f.meters) partes.push(formatDistanceForUnit(f.meters.value));
  } else {
    if (f.reps) partes.push(`${Math.round(f.reps.value)}×`);
    if (f.loadKg) partes.push(formatarCampo("loadKg", f.loadKg.value));
  }
  return partes.length ? partes.join(" · ") : null;
}
