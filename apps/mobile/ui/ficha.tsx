import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, View, type TextInput } from "react-native";
import { Escrita, Texto, TextoJusto } from "./texto";
import {
  EXERCISE_KINDS,
  VALUE_FIELDS_BY_SPORT,
  blockFigures,
  blockMetrics,
  blockRecord,
  exerciseIdentity,
  exerciseKey,
  fieldsOfKind,
  formatDuration,
  resolveExercise,
  type Block,
  type CatalogExercise,
  type ExerciseKind,
  type RecordInput,
  type RecordedValues,
  type Session,
  type ValueField,
} from "@bricklap/engine";
import { formatDistanceForUnit, formatSpeedForUnit } from "@bricklap/i18n";
import { t } from "../i18n";
import { SeloDeclarado } from "./estrutura";
import { Folha } from "./folha";
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
 * bloco. Num bloco de exercícios manda o TIPO (ADR 0012): peso livre mostra
 * repetições e carga, peso do corpo só repetições; o tipo vem do catálogo
 * pelo nome escrito, ou é o atleta que o escolhe — e é assim que um
 * exercício novo entra, sem programador. Um campo calculado mostra o valor
 * sem controlo e diz de onde vem.
 *
 * **Sessão 28 — a ficha para mãos suadas.** No telemóvel real a ficha da
 * sessão 26 falhava à vista (relatório da sessão 27, §11.4), e o desenho
 * mudou por causa disso:
 * - é uma `Folha` dentro do ecrã e não um `Modal`: assenta em cima do
 *   teclado, e o rodapé (Depois, Guardar) é FIXO — escreve-se um valor e
 *   guarda-se sem fechar o teclado;
 * - cada campo tem o rótulo numa linha só dele e, por baixo, − [valor] +
 *   com 56 px cada: "Repetições" já não se parte a meio, em nenhuma língua
 *   nem com a letra grande do sistema;
 * - as sugestões são UMA fila que desliza para o lado e o tipo são duas
 *   metades: num Android de 830 px de altura os campos de valor ficam à
 *   vista sem deslizar;
 * - o teclado numérico salta de campo em campo ("seguinte") e o último
 *   fecha-o;
 * - todos os chips da ficha têm 56 px (DESIGN.md §4), que eram 40.
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
  /** O catálogo de exercícios: a partida mais o que o registo deste atleta já nomeou (ADR 0012). */
  catalogo: readonly CatalogExercise[];
  onGuardar: (block: Block, input: RecordInput) => void;
  onCancelar: () => void;
}) {
  const { tokens, tema, session, now } = props;
  const [escolhido, setEscolhido] = useState(0);
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [exercicio, setExercicio] = useState("");
  /** O tipo que o atleta escolheu à mão nesta ficha; `null` deixa o catálogo decidir pelo nome. */
  const [tipo, setTipo] = useState<ExerciseKind | null>(null);
  const [aEditar, setAEditar] = useState<{ field: ValueField; text: string } | null>(null);
  /** Na passadeira: qual dos dois campos o atleta indica; o outro é calculado. */
  const [passadeiraPor, setPassadeiraPor] = useState<"speedKmh" | "meters">("speedKmh");
  /** Onde está, dentro do corpo da folha, cada zona em que se escreve: a folha desliza até à que tem o foco. */
  const posicoes = useRef<Record<string, number>>({});
  const [focoY, setFocoY] = useState<number | null>(null);
  const entradas = useRef<Partial<Record<ValueField, TextInput | null>>>({});
  const scroll = useRef<ScrollView | null>(null);

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
    setTipo(record.kind);
    setAEditar(null);
    setFocoY(null);
    if (block.sport === "treadmill")
      setPassadeiraPor(record.values.meters && !record.values.speedKmh ? "meters" : "speedKmh");
    // Só o bloco escolhido interessa: a sessão muda a cada tick e não deve repor o rascunho.
  }, [props.visivel, block?.index]);

  if (!block) return null;

  const record = blockRecord(session.events, block.index);
  /** O tipo em vigor: o escolhido à mão, senão o que o catálogo sabe do nome escrito. */
  const tipoDoNome = resolveExercise(exercicio, props.catalogo)?.kind ?? null;
  const tipoEmVigor = block.sport === "strength" ? (tipo ?? tipoDoNome) : null;
  const campos = fieldsOfKind(block.sport, tipoEmVigor);
  const mudarExercicio = (nome: string) => {
    // O tipo escolhido pertence ao exercício para que foi escolhido: outro exercício, outra escolha.
    if (exerciseIdentity(nome, props.catalogo) !== exerciseIdentity(exercicio, props.catalogo)) setTipo(null);
    setExercicio(nome);
  };
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
    // Um campo que o tipo novo não tem e que já tinha valor limpa-se: o
    // bicep que passa a flexões não fica com 12,5 kg. O valor antigo
    // continua no registo; o que muda é o que o bloco mostra.
    for (const field of VALUE_FIELDS_BY_SPORT[block.sport]) {
      if (!campos.includes(field) && record.values[field]) values[field] = null;
    }
    const nomeAntes = exerciseKey(record.exercise);
    const nomeDepois = exerciseKey(exercicio);
    const input: RecordInput = { block: block.index, origin: "declared", values };
    if (nomeDepois !== null && nomeDepois !== nomeAntes) input.exercise = exercicio.trim();
    // O tipo vai no evento quando foi o atleta a dizê-lo: porque o escolheu
    // à mão e difere do que o catálogo diria, ou porque o exercício é dele
    // (não é de partida) e cada sessão tem de se ler sozinha.
    const mesmoExercicio = exerciseIdentity(exercicio, props.catalogo) === exerciseIdentity(record.exercise, props.catalogo);
    const tipoJaEscrito = mesmoExercicio ? record.kind : null;
    const dePartida = resolveExercise(exercicio, props.catalogo)?.seed === true;
    if (block.sport === "strength" && tipoEmVigor !== null && tipoEmVigor !== tipoJaEscrito) {
      const catalogoBasta = dePartida && tipoEmVigor === tipoDoNome;
      if (!catalogoBasta && (nomeDepois !== null || record.exercise !== null || tipo !== null)) input.kind = tipoEmVigor;
    }
    if (Object.keys(values).length === 0 && input.exercise === undefined && input.kind === undefined) {
      props.onCancelar();
      return;
    }
    props.onGuardar(block, input);
  };

  /** Os campos que se escrevem à mão, pela ordem em que aparecem: o teclado salta de um para o seguinte. */
  const editaveis: ValueField[] =
    block.sport === "treadmill"
      ? [passadeiraPor]
      : campos.filter((c) => VALUE_FIELDS_BY_SPORT[block.sport].includes(c));

  /** Um campo: o rótulo numa linha só dele; por baixo, − [valor] +, 56 px cada. */
  const campo = (field: ValueField, sub?: string) => {
    const v = valor(field);
    const editando = aEditar?.field === field;
    const seguinte = editaveis[editaveis.indexOf(field) + 1];
    return (
      <View
        key={field}
        onLayout={(e) => {
          posicoes.current[field] = e.nativeEvent.layout.y;
        }}
        style={{ paddingTop: E.e4, gap: E.e2 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            flexWrap: "wrap",
            columnGap: E.e2,
          }}
        >
          <Texto style={texto(16, 800, tokens.tinta)}>{rotuloDoCampo(field)}</Texto>
          {sub ? <Texto style={texto(12.5, 400, tokens.tinta2)}>{sub}</Texto> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: E.e2 }}>
          <Passo
            tokens={tokens}
            rotulo="−"
            testID={`ficha-${field}-menos`}
            onPress={() => ajustar(field, -PASSO[field])}
          />
          <Pressable
            accessible={false}
            onPress={() => entradas.current[field]?.focus()}
            style={{
              flex: 1,
              minHeight: TOQUE,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: R.m,
              borderWidth: editando ? 2 : 1.5,
              borderColor: editando ? tokens.acento : tokens.linha,
              backgroundColor: tokens.sup,
              paddingHorizontal: E.e2,
            }}
          >
            <Escrita
              ref={(r) => {
                entradas.current[field] = r;
              }}
              testID={`ficha-${field}`}
              accessibilityLabel={rotuloDoCampo(field)}
              value={editando ? aEditar.text : textoDeEdicao(field, v)}
              placeholder="—"
              placeholderTextColor={tokens.tinta3}
              keyboardType={field === "splitS" ? "numbers-and-punctuation" : "decimal-pad"}
              returnKeyType={seguinte ? "next" : "done"}
              submitBehavior={seguinte ? "submit" : "blurAndSubmit"}
              onSubmitEditing={() =>
                seguinte ? entradas.current[seguinte]?.focus() : Keyboard.dismiss()
              }
              selectTextOnFocus
              onFocus={() => {
                setAEditar({ field, text: textoDeEdicao(field, v) });
                setFocoY(posicoes.current[field] ?? null);
              }}
              onChangeText={(text) => setAEditar({ field, text })}
              onBlur={() => {
                if (!editando) return;
                setRascunho(rascunhoEfetivo());
                setAEditar(null);
              }}
              style={{
                ...numero(29, 800, tokens.tinta),
                minWidth: 64,
                minHeight: TOQUE,
                textAlign: "center",
                paddingVertical: 0,
                paddingHorizontal: 0,
              }}
            />
            {unidade(field) ? (
              <Texto style={numero(15, 700, tokens.tinta2)}>{unidade(field)}</Texto>
            ) : null}
          </Pressable>
          <Passo
            tokens={tokens}
            rotulo="+"
            testID={`ficha-${field}-mais`}
            onPress={() => ajustar(field, PASSO[field])}
          />
        </View>
      </View>
    );
  };

  /** Um campo calculado: valor sem controlo, e de onde vem. */
  const calculado = (field: ValueField, explicacao: string, value: number) => (
    <View key={`${field}-calc`} style={{ paddingTop: E.e4, gap: 2 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          columnGap: E.e2,
        }}
      >
        <Texto style={texto(16, 800, tokens.tinta)}>{rotuloDoCampo(field)}</Texto>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Texto testID={`ficha-${field}-calculado`} style={numero(22, 800, tokens.tinta)}>
            {formatarCampo(field, value)}
          </Texto>
          {/* Calculado a partir do que o atleta escreveu: declarado também (ADR 0011 §3a). */}
          <SeloDeclarado tokens={tokens} rotulo={t("mobile.declaredShort")} descricao={t("mobile.declaredTag")} />
        </View>
      </View>
      <Texto style={texto(12.5, 400, tokens.tinta2)}>{explicacao}</Texto>
    </View>
  );

  /** Duas pílulas a meias: a escolha entre dois. */
  const metades = (
    itens: { rotulo: string; ativo: boolean; testID: string; onPress: () => void }[],
  ) => (
    <View style={{ flexDirection: "row", gap: E.e2 }}>
      {itens.map((i) => (
        <Chip
          key={i.testID}
          tokens={tokens}
          rotulo={i.rotulo}
          ativo={i.ativo}
          testID={i.testID}
          onPress={i.onPress}
          metade
        />
      ))}
    </View>
  );

  const corpo = () => {
    if (campos.length === 0)
      return (
        <Texto style={texto(14, 400, tokens.tinta2, { marginTop: E.e4 })}>
          {t("mobile.nothingToRecord")}
        </Texto>
      );
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
      const indicar = (f: "speedKmh" | "meters") => {
        if (f === primario) return;
        // O campo que deixa de ser o indicado limpa-se: só um dos dois é declarado.
        setRascunho({ ...rascunhoEfetivo(), [primario]: null });
        setPassadeiraPor(f);
        setAEditar(null);
      };
      return (
        <>
          <View style={{ paddingTop: E.e4 }}>
            {metades([
              {
                rotulo: rotuloDoCampo("speedKmh"),
                ativo: primario === "speedKmh",
                testID: "ficha-por-speedKmh",
                onPress: () => indicar("speedKmh"),
              },
              {
                rotulo: rotuloDoCampo("meters"),
                ativo: primario === "meters",
                testID: "ficha-por-meters",
                onPress: () => indicar("meters"),
              },
            ])}
          </View>
          {campo(primario)}
          {calc}
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
    // Exercícios: o nome, o tipo, e os campos que o tipo tem.
    const sugestoes = props.catalogo.slice(0, 8);
    return (
      <>
        <View
          onLayout={(e) => {
            posicoes.current["exercicio"] = e.nativeEvent.layout.y;
          }}
          style={{ paddingTop: E.e4, gap: E.e2 }}
        >
          <Texto style={texto(16, 800, tokens.tinta)}>{t("mobile.exercise")}</Texto>
          <Escrita
            testID="ficha-exercicio"
            accessibilityLabel={t("mobile.exercise")}
            value={exercicio}
            onChangeText={mudarExercicio}
            onFocus={() => setFocoY(posicoes.current["exercicio"] ?? null)}
            placeholder={t("mobile.exercisePlaceholder")}
            placeholderTextColor={tokens.tinta3}
            autoCapitalize="none"
            returnKeyType="done"
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
          {sugestoes.length > 0 ? (
            // UMA fila que desliza para o lado: oito pílulas de 56 px em
            // grelha eram 250 px de altura, e empurravam os campos de valor
            // para fora do ecrã. Sangra até à margem da folha para se ver
            // que continua.
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginHorizontal: -E.e5 }}
              contentContainerStyle={{ paddingHorizontal: E.e5, gap: E.e2 }}
            >
              {sugestoes.map((entrada) => (
                <Chip
                  key={entrada.id}
                  tokens={tokens}
                  rotulo={entrada.name}
                  ativo={exerciseIdentity(entrada.name, props.catalogo) === exerciseIdentity(exercicio, props.catalogo)}
                  testID={`ficha-sugestao-${entrada.id}`}
                  onPress={() => mudarExercicio(entrada.name)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
        <View style={{ paddingTop: E.e4, gap: E.e2 }}>
          <Texto style={texto(16, 800, tokens.tinta)}>{t("mobile.exerciseKind")}</Texto>
          {metades(
            EXERCISE_KINDS.map((k) => ({
              rotulo: rotuloDoTipo(k),
              ativo: tipoEmVigor === k,
              testID: `ficha-tipo-${k}`,
              onPress: () => setTipo(k),
            })),
          )}
          {tipoEmVigor ? (
            <Texto
              style={texto(12.5, 400, tokens.tinta2)}
            >{`${rotuloDoTipo(tipoEmVigor)}: ${detalheDoTipo(tipoEmVigor)}`}</Texto>
          ) : null}
        </View>
        {campos.map((field) => campo(field))}
      </>
    );
  };

  return (
    <Folha
      tokens={tokens}
      visivel={props.visivel}
      onCancelar={props.onCancelar}
      testIDVeu="ficha-backdrop"
      rotuloCancelar={t("common.cancel")}
      scrollRef={scroll}
      focoY={focoY}
      cabeca={
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: E.e2, marginTop: E.e3 }}>
            <Icone nome={block.sport} cor={COR_DESPORTO[tema][block.sport]} tamanho={22} />
            <TextoJusto style={texto(22, 800, tokens.tinta, { flex: 1 })}>
              {nomeDoBloco(session, block)}
            </TextoJusto>
          </View>
          <Texto style={texto(13.5, 400, tokens.tinta2, { marginTop: 2, marginBottom: E.e2 })}>
            {t("mobile.blockContext", {
              n: String(block.index + 1),
              time: formatDuration(segundos * 1000),
            })}
            {block.round !== null ? ` · ${t("mobile.roundN", { n: String(block.round + 1) })}` : ""}
          </Texto>
        </>
      }
      rodape={
        <View style={{ flexDirection: "row", gap: E.e2 }}>
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
            <TextoJusto style={texto(17, 700, tokens.tinta2)}>{t("mobile.later")}</TextoJusto>
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
            <TextoJusto style={texto(17, 700, tokens.sobreAcento, { flexShrink: 1 })}>
              {t("mobile.save")}
            </TextoJusto>
          </Pressable>
        </View>
      }
    >
      {props.blocos.length > 1 ? (
        <View style={{ paddingTop: E.e2 }}>
          {metades(
            props.blocos.slice(0, 2).map((b, i) => ({
              rotulo: `${i === 0 ? t("mobile.thisBlock") : t("mobile.previousBlock")} · ${nomeDoBloco(session, b)}`,
              ativo: i === escolhido,
              testID: `ficha-bloco-${i}`,
              onPress: () => setEscolhido(i),
            })),
          )}
        </View>
      ) : null}
      {corpo()}
    </Folha>
  );
}

export function rotuloDoTipo(kind: ExerciseKind): string {
  return kind === "free_weight" ? t("mobile.kindFreeWeight") : t("mobile.kindBodyweight");
}

function detalheDoTipo(kind: ExerciseKind): string {
  return kind === "free_weight" ? t("mobile.kindFreeWeightDetail") : t("mobile.kindBodyweightDetail");
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
      <Texto style={texto(24, 600, props.tokens.tinta)}>{props.rotulo}</Texto>
    </Pressable>
  );
}

/** A pílula de escolha (DESIGN.md §6): contorno `linha`; ativa = fundo `tinta`, texto `fundo`. `metade` reparte a linha a meias. */
export function Chip(props: {
  tokens: Tokens;
  rotulo: string;
  ativo: boolean;
  testID?: string;
  metade?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      accessibilityState={{ selected: props.ativo }}
      onPress={props.onPress}
      style={({ pressed }) => ({
        // 56 px: os chips da ficha tocam-se durante o treino (DESIGN.md §4).
        minHeight: TOQUE,
        flex: props.metade ? 1 : undefined,
        minWidth: 0,
        paddingHorizontal: props.metade ? E.e3 : E.e4,
        borderRadius: R.pill,
        borderWidth: 1.5,
        borderColor: props.ativo ? props.tokens.tinta : props.tokens.linha,
        backgroundColor: props.ativo ? props.tokens.tinta : pressed ? props.tokens.sup2 : props.tokens.sup,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Texto
        numberOfLines={1}
        style={texto(14.5, 700, props.ativo ? props.tokens.fundo : props.tokens.tinta)}
      >
        {props.rotulo}
      </Texto>
    </Pressable>
  );
}

/**
 * Se o que o bloco mostra é declarado (ADR 0011 §3a): basta um número
 * declarado, ou derivado de um declarado, para a linha inteira levar a
 * marca. Um bloco com GPS nunca: a distância dele vem das amostras.
 */
export function valoresDeclarados(session: Session, block: Block, now: number): boolean {
  return Object.values(blockFigures(session, block, now)).some((f) => f.origin === "declared");
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
