import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { Icone, type NomeIcone } from "./icones";
import { kicker, texto } from "./tipografia";
import { E, R, TOQUE, TOQUE_CONSULTA, type Tokens } from "./tokens";

/**
 * Os componentes de `docs/DESIGN.md` §6. Nenhum usa um hex diretamente: os
 * tokens do tema do ecrã entram por parâmetro, porque o tema decide-se por
 * ecrã e um componente não tem de saber qual é.
 */

export type TipoBotao = "normal" | "acento" | "fantasma" | "perigo";

/**
 * Altura 56 em treino e 44 em consulta, raio 12, contorno de 1,5 px.
 * No máximo UM botão de acento por ecrã.
 */
export function Botao(props: {
  tokens: Tokens;
  rotulo: string;
  tipo?: TipoBotao;
  icone?: NomeIcone;
  pequeno?: boolean;
  largo?: boolean;
  desativado?: boolean;
  estilo?: ViewStyle;
  testID?: string;
  onPress: () => void;
}) {
  const { tokens } = props;
  const tipo = props.tipo ?? "normal";
  const acento = tipo === "acento";
  const corTexto = acento
    ? tokens.sobreAcento
    : tipo === "perigo"
      ? tokens.acentoTinta
      : tipo === "fantasma"
        ? tokens.tinta2
        : tokens.tinta;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      accessibilityState={{ disabled: props.desativado === true }}
      disabled={props.desativado}
      onPress={props.onPress}
      style={({ pressed }) => ({
        ...props.estilo,
        minHeight: props.pequeno ? TOQUE_CONSULTA : TOQUE,
        paddingHorizontal: props.pequeno ? E.e3 : E.e4,
        borderRadius: props.pequeno ? R.s : R.m,
        borderWidth: tipo === "fantasma" ? 0 : 1.5,
        borderColor: acento ? tokens.acento : tokens.linha,
        backgroundColor: acento
          ? pressed
            ? tokens.acentoPremido
            : tokens.acento
          : tipo === "fantasma"
            ? "transparent"
            : pressed
              ? tokens.sup2
              : tokens.sup,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: E.e2,
        alignSelf: props.largo ? "stretch" : undefined,
        opacity: props.desativado ? 0.45 : 1,
      })}
    >
      {props.icone ? <Icone nome={props.icone} cor={corTexto} tamanho={props.pequeno ? 18 : 22} /> : null}
      <Text style={texto(props.pequeno ? 15 : 17, tipo === "fantasma" ? 600 : 700, corTexto)}>{props.rotulo}</Text>
    </Pressable>
  );
}

/** Fundo `sup`, contorno `linha`, raio 16, folga interior de 16. Sem barra de cor na lateral. */
export function Cartao(props: { tokens: Tokens; estilo?: ViewStyle; children: ReactNode }) {
  return (
    <View
      style={[
        {
          backgroundColor: props.tokens.sup,
          borderColor: props.tokens.linha,
          borderWidth: 1,
          borderRadius: R.g,
          padding: E.e4,
          gap: E.e2,
        },
        props.estilo,
      ]}
    >
      {props.children}
    </View>
  );
}

/**
 * O tijolo do ecrã inicial: o botão por onde se escolhe o desporto. O ícone
 * leva a cor do desporto — é o único sítio, com a fiada, onde ela aparece.
 */
export function Tijolo(props: {
  tokens: Tokens;
  rotulo: string;
  icone: NomeIcone;
  corDoIcone: string;
  testID?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: TOQUE,
        borderRadius: R.m,
        borderWidth: 1.5,
        borderColor: props.tokens.linha,
        backgroundColor: pressed ? props.tokens.sup2 : props.tokens.sup,
        flexDirection: "row",
        alignItems: "center",
        gap: E.e2,
        paddingHorizontal: E.e3,
      })}
    >
      <Icone nome={props.icone} cor={props.corDoIcone} tamanho={18} />
      <Text style={texto(15.5, 700, props.tokens.tinta, { flexShrink: 1 })}>{props.rotulo}</Text>
    </Pressable>
  );
}

export function Pilula(props: { tokens: Tokens; rotulo: string }) {
  return (
    <View
      style={{
        paddingVertical: 6,
        paddingHorizontal: 11,
        borderRadius: R.pill,
        backgroundColor: props.tokens.sup2,
      }}
    >
      <Text style={texto(12, 700, props.tokens.tinta2)}>{props.rotulo}</Text>
    </View>
  );
}

export function Kicker(props: { tokens: Tokens; children: string }) {
  return <Text style={kicker(props.tokens.tinta3)}>{props.children}</Text>;
}

/** Título de secção: 11,5/700 em maiúsculas, com um contador opcional à direita. */
export function Seccao(props: { tokens: Tokens; titulo: string; lado?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: E.e6, gap: E.e2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ ...kicker(props.tokens.tinta3), fontSize: 11.5 }}>{props.titulo}</Text>
        {props.lado ? <Text style={texto(12.5, 500, props.tokens.tinta3)}>{props.lado}</Text> : null}
      </View>
      {props.children}
    </View>
  );
}
