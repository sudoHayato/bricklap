import { useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { Icone } from "./icones";
import { numero } from "./tipografia";
import type { Tokens } from "./tokens";

/**
 * O BOTÃO MARCA — o gesto central da app (DESIGN.md §6), o tratamento 3
 * escolhido na sessão 13c. Tocado com a mão a tremer e a suar, de relance.
 *
 * **Nada de instruções lá dentro**: um botão que se tem de explicar por
 * escrito já falhou. Quem explica o gesto é o ANEL, que se desenha da
 * esquerda para a direita ao longo dos 500 ms exatos do premir e, ao fechar,
 * é a confirmação de que a marca foi feita.
 *
 * - **Silhueta própria**, e não um retângulo de cantos iguais: 80 px de
 *   altura, raios de 8 px à esquerda e 20 px à direita. A aresta cortada
 *   encosta ao que já está construído; a aberta é por onde entra o bloco
 *   seguinte.
 * - **Profundidade a sério**: o casco é `acento-premido` e a face é `acento`,
 *   assente 4 px acima do fundo do casco. Ao premir, a face desce 3 px e o
 *   leito encolhe para 1, em 90 ms. O que muda é GEOMETRIA e não cor: duas
 *   terracotas vizinhas são a mesma cor ao sol, e o dedo tapa o centro do
 *   botão mas não a aresta de baixo.
 * - **Rótulo à esquerda**, com 22 px de recuo: o polegar direito cai no terço
 *   direito e a palavra nunca fica debaixo do dedo.
 *
 * **Sessão 16: de 110 para 80 px.** No telemóvel real o botão era grande de
 * mais (fundador). O piso do CTO é 72 px de altura e 90 % da largura; ficou
 * a toda a largura útil e a 80 — 43 % acima dos 56 px de qualquer alvo de
 * treino, porque o dedo que o procura está a suar e a tremer. Desceram na
 * mesma proporção o rótulo (29 → 22, o tamanho das distâncias no cartão), o
 * ícone (28 → 22, o dos botões), o leito (6 → 4) e a sombra, que era metade
 * do peso visual e não servia o gesto.
 *
 * **Porquê premir e não tocar** (decisão desta sessão, para o CTO rever):
 * uma marca não se desfaz nesta versão — não há edição do histórico de
 * blocos. Um toque acidental no telemóvel pousado no banco partia um bloco em
 * dois sem ninguém dar por isso; um premir que não chega ao fim não faz nada
 * e vê-se logo, porque o anel recua. A ficha rápida, que na sessão 4.5 vai
 * distinguir o toque do premir, ainda não existe: até lá, o premir é o único
 * gesto, e o anel ensina-o à primeira tentativa.
 */
export const MS_DO_PREMIR = 500;

const ALTURA = 80;
const LEITO = 4;
const RECUO_ANEL = 8;

export function BotaoMarca(props: { tokens: Tokens; rotulo: string; onMarca: () => void }) {
  const { tokens } = props;
  const [largura, setLargura] = useState(0);
  const anel = useRef(new Animated.Value(0)).current;
  const face = useRef(new Animated.Value(0)).current;
  const disparado = useRef(false);

  const larguraDoAnel = Math.max(0, largura - RECUO_ANEL * 2);

  const moverFace = (para: number, ms: number) => {
    Animated.timing(face, { toValue: para, duration: ms, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  };

  const comecar = () => {
    disparado.current = false;
    moverFace(1, 90);
    anel.setValue(0);
    // O fim da animação É o momento da marca: o anel fechado e o evento
    // gravado são a mesma coisa, e não duas que possam ficar dessincronizadas.
    Animated.timing(anel, { toValue: 1, duration: MS_DO_PREMIR, easing: Easing.linear, useNativeDriver: false }).start(
      ({ finished }) => {
        if (!finished || disparado.current) return;
        disparado.current = true;
        moverFace(0, 90);
        Animated.timing(anel, { toValue: 0, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
        props.onMarca();
      },
    );
  };

  const largar = () => {
    if (disparado.current) return;
    // Largar antes do fim recua o anel à vista: é assim que o botão ensina
    // que o gesto é premir, sem uma linha de instruções.
    anel.stopAnimation(() => {
      Animated.timing(anel, { toValue: 0, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    });
    moverFace(0, 90);
  };

  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  const raios = { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderTopRightRadius: 20, borderBottomRightRadius: 20 };

  return (
    <Pressable
      testID="btn-marca"
      accessibilityRole="button"
      accessibilityLabel={props.rotulo}
      accessibilityHint={undefined}
      onLayout={medir}
      onPressIn={comecar}
      onPressOut={largar}
      style={{
        height: ALTURA,
        backgroundColor: tokens.acentoPremido,
        ...raios,
        shadowColor: tokens.acento,
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: face.interpolate({ inputRange: [0, 1], outputRange: [0, LEITO - 1] }),
          bottom: face.interpolate({ inputRange: [0, 1], outputRange: [LEITO, 1] }),
          backgroundColor: tokens.acento,
          ...raios,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 22,
          gap: 10,
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            left: RECUO_ANEL,
            top: RECUO_ANEL,
            bottom: RECUO_ANEL,
            width: anel.interpolate({ inputRange: [0, 1], outputRange: [0, larguraDoAnel] }),
            overflow: "hidden",
          }}
          pointerEvents="none"
        >
          <View
            style={{
              width: larguraDoAnel,
              height: "100%",
              borderWidth: 2.5,
              borderColor: "rgba(255,255,255,0.92)",
              borderTopLeftRadius: 2,
              borderBottomLeftRadius: 2,
              borderTopRightRadius: 20 - RECUO_ANEL,
              borderBottomRightRadius: 20 - RECUO_ANEL,
            }}
          />
        </Animated.View>
        <Icone nome="marca" cor={tokens.sobreAcento} tamanho={22} />
        <Text style={numero(22, 800, tokens.sobreAcento, { letterSpacing: -0.22 })}>{props.rotulo}</Text>
      </Animated.View>
    </Pressable>
  );
}
