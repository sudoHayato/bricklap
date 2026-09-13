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
 * - **Silhueta própria**, e não um retângulo de cantos iguais: 110 px de
 *   altura, raios de 8 px à esquerda e 30 px à direita. A aresta cortada
 *   encosta ao que já está construído; a aberta é por onde entra o bloco
 *   seguinte.
 * - **Profundidade a sério**: o casco é `acento-premido` e a face é `acento`,
 *   assente 6 px acima do fundo do casco. Ao premir, a face desce para 4 px e
 *   o leito encolhe para 2, em 90 ms. O que muda é GEOMETRIA e não cor: duas
 *   terracotas vizinhas são a mesma cor ao sol, e o dedo tapa o centro do
 *   botão mas não a aresta de baixo.
 * - **Rótulo à esquerda**, com 26 px de recuo: o polegar direito cai no terço
 *   direito e a palavra nunca fica debaixo do dedo.
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

const ALTURA = 110;
const RECUO_ANEL = 10;

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
  const raios = { borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderTopRightRadius: 30, borderBottomRightRadius: 30 };

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
        shadowOpacity: 0.26,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: face.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }),
          bottom: face.interpolate({ inputRange: [0, 1], outputRange: [6, 2] }),
          backgroundColor: tokens.acento,
          ...raios,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 26,
          gap: 12,
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
              borderWidth: 3,
              borderColor: "rgba(255,255,255,0.92)",
              borderTopLeftRadius: 2,
              borderBottomLeftRadius: 2,
              borderTopRightRadius: 20,
              borderBottomRightRadius: 20,
            }}
          />
        </Animated.View>
        <Icone nome="marca" cor={tokens.sobreAcento} tamanho={28} />
        <Text style={numero(29, 800, tokens.sobreAcento, { letterSpacing: -0.29 })}>{props.rotulo}</Text>
      </Animated.View>
    </Pressable>
  );
}
