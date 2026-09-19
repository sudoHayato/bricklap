import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Animated, BackHandler, Easing, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FOLGA, useTeclado } from "./margens";
import { E, R, type Tokens } from "./tokens";

/**
 * A FOLHA que sobe do fundo (DESIGN.md §6): a escolha de desporto e a ficha
 * de valores. Sessão 28: deixou de ser um `Modal`.
 *
 * Um `Modal` do React Native é outra janela do Android. Em edge-to-edge essa
 * janela não encolhe com o teclado, os eventos de teclado são medidos na
 * janela principal, e as margens do sistema não lhe chegam — foi assim que
 * o teclado numérico tapou a ficha inteira e que o Guardar ficou debaixo da
 * barra de navegação (relatório da sessão 27, §11.4). Aqui a folha é uma
 * vista absoluta DENTRO do ecrã: a mesma janela, as mesmas margens, o mesmo
 * teclado, e uma conta só:
 *
 * - teclado fechado: a folha assenta no fundo do ecrã e o seu rodapé leva o
 *   inset da barra de navegação por dentro;
 * - teclado aberto: a folha assenta EM CIMA do teclado (altura do teclado +
 *   inset de baixo) e pode crescer até à barra de estado.
 *
 * Três zonas: `cabeca` e `rodape` fixos, o corpo desliza entre eles. O
 * rodapé nunca desliza: o Guardar está sempre à vista, com ou sem teclado.
 * `focoY` é a posição, dentro do corpo, do campo em que se está a escrever:
 * quando o teclado abre, o corpo desliza até ele.
 *
 * O gesto de voltar do Android fecha a folha (o `Modal` fazia-o por
 * `onRequestClose`; aqui é o `BackHandler`). Quem está por baixo deve
 * esconder-se dos leitores de ecrã enquanto a folha está aberta
 * (`importantForAccessibility="no-hide-descendants"`).
 */
export function Folha(props: {
  tokens: Tokens;
  visivel: boolean;
  onCancelar: () => void;
  testIDVeu: string;
  rotuloCancelar: string;
  /** Fração do espaço livre que a folha pode ocupar com o teclado fechado. */
  alturaMax?: number;
  cabeca?: ReactNode;
  rodape?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  focoY?: number | null;
  children: ReactNode;
}) {
  const { tokens, visivel } = props;
  const insets = useSafeAreaInsets();
  const teclado = useTeclado();
  const [livre, setLivre] = useState(0);
  const entra = useRef(new Animated.Value(0)).current;
  const proprio = useRef<ScrollView | null>(null);
  const scroll = props.scrollRef ?? proprio;

  useEffect(() => {
    if (!visivel) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      props.onCancelar();
      return true;
    });
    return () => sub.remove();
  }, [visivel, props.onCancelar]);

  useEffect(() => {
    if (!visivel) return;
    entra.setValue(0);
    Animated.timing(entra, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visivel, entra]);

  // Com o teclado aberto, o campo em escrita vem para o cimo do corpo. Espera
  // um instante: a folha ainda está a encolher quando o evento chega.
  useEffect(() => {
    if (!visivel || teclado === 0 || props.focoY === null || props.focoY === undefined) return;
    const y = Math.max(0, props.focoY - E.e2);
    const id = setTimeout(() => scroll.current?.scrollTo({ y, animated: true }), 60);
    return () => clearTimeout(id);
  }, [visivel, teclado, props.focoY, scroll]);

  if (!visivel) return null;

  const aberto = teclado > 0;
  const fracao = aberto ? 1 : (props.alturaMax ?? 0.93);
  return (
    <View
      accessibilityViewIsModal
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        elevation: 24,
      }}
    >
      <Animated.View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: entra }}
      >
        <Pressable
          testID={props.testIDVeu}
          accessibilityLabel={props.rotuloCancelar}
          onPress={props.onCancelar}
          style={{ flex: 1, backgroundColor: tokens.veu }}
        />
      </Animated.View>
      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          paddingTop: insets.top + FOLGA,
          paddingBottom: aberto ? teclado + insets.bottom : 0,
        }}
      >
        <View
          pointerEvents="box-none"
          onLayout={(e) => setLivre(e.nativeEvent.layout.height)}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Animated.View
            style={{
              backgroundColor: tokens.fundo,
              borderTopLeftRadius: R.folha,
              borderTopRightRadius: R.folha,
              paddingTop: E.e3,
              maxHeight: livre > 0 ? livre * fracao : undefined,
              transform: [
                { translateY: entra.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: tokens.linha,
              }}
            />
            {props.cabeca ? <View style={{ paddingHorizontal: E.e5 }}>{props.cabeca}</View> : null}
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: E.e5, paddingBottom: E.e2 }}
            >
              {props.children}
            </ScrollView>
            <View
              style={{
                paddingHorizontal: E.e5,
                paddingTop: E.e3,
                paddingBottom: aberto ? E.e3 : insets.bottom + E.e3,
                borderTopWidth: 1,
                borderTopColor: tokens.linha,
              }}
            >
              {props.rodape}
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
