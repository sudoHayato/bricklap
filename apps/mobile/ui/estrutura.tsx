import { useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, View, type ViewStyle } from "react-native";
import { useMargens } from "./margens";
import { Texto, TextoJusto } from "./texto";
import { Icone, type NomeIcone } from "./icones";
import { LogotipoComPalavra } from "./logotipoComPalavra";
import { kicker, numero, texto } from "./tipografia";
import { E, R, TOQUE, TOQUE_CONSULTA, type Tokens } from "./tokens";

/**
 * A estrutura dos ecrãs: cabeçalho, separadores de fundo, a linha de um
 * bloco e o botão que só dispara ao fim de um premir.
 *
 * Edge-to-edge é obrigatório no Android 16. As margens do sistema vêm de
 * `useMargens` (`ui/margens.ts`), lidas da janela e não supostas — até à
 * sessão 27 eram duas constantes aqui, e as folhas nem essas usavam.
 */

/** Botão redondo de 40 px do canto do ecrã (definições, voltar). */
export function Redondo(props: { tokens: Tokens; icone: NomeIcone; rotulo: string; testID?: string; onPress: () => void }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: TOQUE_CONSULTA,
        height: TOQUE_CONSULTA,
        borderRadius: R.pill,
        borderWidth: 1.5,
        borderColor: props.tokens.linha,
        backgroundColor: pressed ? props.tokens.sup2 : props.tokens.sup,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Icone nome={props.icone} cor={props.tokens.tinta2} tamanho={18} />
    </Pressable>
  );
}

/** O cabeçalho de um ecrã de consulta: rótulo ou "voltar", título e subtítulo. */
export function Cabeca(props: {
  tokens: Tokens;
  /** O logótipo (com a palavra ao lado, sessão 17) no lugar do rótulo. */
  logotipo?: boolean;
  rotulo?: string;
  voltar?: { rotulo: string; onPress: () => void };
  direita?: ReactNode;
  titulo?: string;
  sub?: string;
}) {
  return (
    <View style={{ paddingHorizontal: E.e5, paddingTop: E.e3, gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: TOQUE_CONSULTA }}>
        {props.voltar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.voltar.rotulo}
            onPress={props.voltar.onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              minHeight: TOQUE_CONSULTA,
              paddingVertical: 6,
              paddingRight: E.e3,
            }}
          >
            <Icone nome="voltar" cor={props.tokens.acentoTinta} tamanho={18} />
            <Texto style={texto(15, 700, props.tokens.acentoTinta)}>{props.voltar.rotulo}</Texto>
          </Pressable>
        ) : props.logotipo ? (
          <LogotipoComPalavra tokens={props.tokens} />
        ) : (
          <Texto style={kicker(props.tokens.tinta3)}>{props.rotulo ?? ""}</Texto>
        )}
        {props.direita ?? null}
      </View>
      {props.titulo ? (
        <Texto style={texto(27, 800, props.tokens.tinta, { letterSpacing: -0.6 })}>
          {props.titulo}
        </Texto>
      ) : null}
      {props.sub ? <Texto style={texto(13.5, 400, props.tokens.tinta2)}>{props.sub}</Texto> : null}
    </View>
  );
}

/**
 * Separadores de fundo. Dois, não três: Modelos é o ecrã dos planos de treino
 * e esses são a sessão seguinte — um separador a abrir um ecrã vazio prometia
 * o que a app ainda não faz. Definições entram pelo canto do ecrã inicial,
 * como no protótipo.
 */
export function Tabs(props: {
  tokens: Tokens;
  ativo: "inicio" | "historico";
  rotuloInicio: string;
  rotuloHistorico: string;
  onInicio: () => void;
  onHistorico: () => void;
}) {
  const tab = (id: "inicio" | "historico", rotulo: string, icone: NomeIcone, onPress: () => void) => {
    const ativo = props.ativo === id;
    const cor = ativo ? props.tokens.acentoTinta : props.tokens.tinta3;
    return (
      <Pressable
        key={id}
        testID={`tab-${id}`}
        accessibilityRole="tab"
        accessibilityLabel={rotulo}
        accessibilityState={{ selected: ativo }}
        onPress={onPress}
        style={{
          flex: 1,
          minHeight: TOQUE_CONSULTA,
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          paddingTop: E.e2,
          paddingBottom: E.e1,
        }}
      >
        <Icone nome={icone} cor={cor} tamanho={22} />
        <Texto style={texto(11.5, 700, cor)}>{rotulo}</Texto>
      </Pressable>
    );
  };
  const { fundo } = useMargens();
  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: props.tokens.linha,
        backgroundColor: props.tokens.sup,
        paddingTop: 6,
        paddingBottom: fundo,
        paddingHorizontal: E.e2,
      }}
    >
      {tab("inicio", props.rotuloInicio, "inicio", props.onInicio)}
      {tab("historico", props.rotuloHistorico, "historico", props.onHistorico)}
    </View>
  );
}

/**
 * A marca de um valor DECLARADO (ADR 0011 §3a, DESIGN.md §6): "decl.", em
 * Inter, maiúsculas pequenas, `tinta2`, colada ao número. Tudo o que o
 * atleta escreveu — e tudo o que a app calculou a partir disso, o ritmo
 * incluído — leva-a; um número medido nunca. É uma palavra e não uma cor
 * ou um peso de letra porque tem de se ler ao sol, nos dois temas e a uma
 * cor, e porque um leitor de ecrã lê palavras.
 */
export function SeloDeclarado(props: { tokens: Tokens; rotulo: string; descricao: string }) {
  return (
    <Texto
      testID="selo-declarado"
      accessibilityLabel={props.descricao}
      style={texto(10.5, 700, props.tokens.tinta2, { letterSpacing: 0.6, textTransform: "uppercase" })}
    >
      {props.rotulo}
    </Texto>
  );
}

/**
 * Uma linha da lista de blocos: ícone + nome | valor | tempo. Com `onPress`
 * a linha é um botão — no resumo abre a ficha de valores desse bloco
 * (ADR 0011, a porta do fim). `porPreencher` marca, em acento, um bloco
 * que aceita valores e ainda não tem nenhum.
 */
export function LinhaBloco(props: {
  tokens: Tokens;
  icone: NomeIcone;
  corDoIcone: string;
  nome: string;
  valor?: string | null;
  /** O valor é declarado, ou derivado de um declarado: leva a marca (`SeloDeclarado`). */
  declarado?: { rotulo: string; descricao: string };
  tempo: string;
  primeira?: boolean;
  porPreencher?: string;
  testID?: string;
  onPress?: () => void;
}) {
  // Duas linhas desde a sessão 28: nome e tempo em cima, o valor por baixo
  // do nome. Numa linha só, "500 m · 1:10/500 DECL." deixava o nome em "Re…"
  // no telemóvel real — e o nome é o que diz que bloco é.
  const conteudo = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: E.e2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
          <Icone nome={props.icone} cor={props.corDoIcone} tamanho={18} />
          <Texto numberOfLines={1} style={texto(14, 600, props.tokens.tinta, { flexShrink: 1 })}>
            {props.nome}
          </Texto>
        </View>
        {!props.valor && props.porPreencher ? (
          <Texto style={texto(12.5, 700, props.tokens.acentoTinta)}>{props.porPreencher}</Texto>
        ) : null}
        <Texto style={numero(13, 600, props.tokens.tinta2, { minWidth: 52, textAlign: "right" })}>
          {props.tempo}
        </Texto>
      </View>
      {props.valor ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 5,
            paddingLeft: 25,
          }}
        >
          <Texto style={numero(14.5, 800, props.tokens.tinta)}>{props.valor}</Texto>
          {props.declarado ? <SeloDeclarado tokens={props.tokens} {...props.declarado} /> : null}
        </View>
      ) : null}
    </>
  );
  const estilo = {
    gap: 2,
    justifyContent: "center" as const,
    paddingVertical: 10,
    paddingHorizontal: E.e3,
    borderTopWidth: props.primeira ? 0 : 1,
    borderTopColor: props.tokens.linha,
  };
  if (!props.onPress) return <View style={estilo}>{conteudo}</View>;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.nome}
      onPress={props.onPress}
      style={({ pressed }) => ({ ...estilo, minHeight: TOQUE_CONSULTA, backgroundColor: pressed ? props.tokens.sup2 : "transparent" })}
    >
      {conteudo}
    </Pressable>
  );
}

/** A linha que abre uma ronda na lista de blocos do resumo. */
export function LinhaRonda(props: { tokens: Tokens; rotulo: string; lado?: string; primeira?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        paddingTop: props.primeira ? 8 : 12,
        paddingBottom: 4,
        paddingHorizontal: E.e3,
        borderTopWidth: props.primeira ? 0 : 1,
        borderTopColor: props.tokens.linha,
        backgroundColor: props.tokens.sup2,
      }}
    >
      <Texto style={{ ...kicker(props.tokens.tinta2), fontSize: 11.5 }}>{props.rotulo}</Texto>
      {props.lado ? <Texto style={texto(12, 500, props.tokens.tinta3)}>{props.lado}</Texto> : null}
    </View>
  );
}

/**
 * Um botão que só dispara ao fim de `ms` a premir, com uma barra a encher
 * por baixo do rótulo. É o que protege Parar de um toque acidental a meio de
 * um treino — e a barra é o que ensina o gesto sem uma linha de instruções.
 */
export function BotaoPremir(props: {
  tokens: Tokens;
  rotulo: string;
  icone: NomeIcone;
  ms: number;
  perigo?: boolean;
  estilo?: ViewStyle;
  testID?: string;
  onCompleto: () => void;
}) {
  const enche = useRef(new Animated.Value(0)).current;
  const disparado = useRef(false);
  const cor = props.perigo ? props.tokens.acentoTinta : props.tokens.tinta;

  const comecar = () => {
    disparado.current = false;
    enche.setValue(0);
    Animated.timing(enche, { toValue: 1, duration: props.ms, easing: Easing.linear, useNativeDriver: false }).start(
      ({ finished }) => {
        if (!finished || disparado.current) return;
        disparado.current = true;
        enche.setValue(0);
        props.onCompleto();
      },
    );
  };
  const largar = () => {
    if (disparado.current) return;
    enche.stopAnimation(() => {
      Animated.timing(enche, { toValue: 0, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    });
  };

  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      onPressIn={comecar}
      onPressOut={largar}
      style={[
        {
          minHeight: TOQUE,
          borderRadius: R.m,
          borderWidth: 1.5,
          borderColor: props.tokens.linha,
          backgroundColor: props.tokens.sup,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: E.e2,
          overflow: "hidden",
        },
        props.estilo,
      ]}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: enche.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          backgroundColor: props.perigo ? "rgba(176,58,42,0.16)" : "rgba(128,128,128,0.16)",
        }}
        pointerEvents="none"
      />
      <Icone nome={props.icone} cor={cor} tamanho={22} />
      <TextoJusto style={texto(17, 700, cor, { flexShrink: 1 })}>{props.rotulo}</TextoJusto>
    </Pressable>
  );
}
