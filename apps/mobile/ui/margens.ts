import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * As margens do SISTEMA, lidas e não supostas (sessão 28). Edge-to-edge é
 * obrigatório no Android 16: a app desenha por baixo da barra de estado e
 * da barra de navegação, e tudo o que se toca tem de ficar livre delas.
 *
 * Até à sessão 27 o fundo era uma constante (48 + 8, a barra de três
 * botões) e o topo vinha de `StatusBar.currentHeight`. Falhava de duas
 * maneiras: as folhas ignoravam-na (o Guardar ficava meio tapado pela
 * barra), e num telemóvel com navegação por gestos sobravam 30 px de
 * nada. Agora vêm de `react-native-safe-area-context`, que lê os insets
 * reais da janela — barra de três botões, gestos, entalhe.
 *
 * `topo` e `fundo` já trazem os 8 px de folga do desenho; `sistemaFundo`
 * é o inset cru, para quem assenta em cima do teclado.
 */
export const FOLGA = 8;

export function useMargens(): { topo: number; fundo: number; sistemaFundo: number } {
  const i = useSafeAreaInsets();
  return { topo: i.top + FOLGA, fundo: i.bottom + FOLGA, sistemaFundo: i.bottom };
}

/**
 * A altura do teclado, em px de desenho, ou 0 com ele fechado. Em
 * edge-to-edge o `adjustResize` do manifesto já não encolhe a janela: quem
 * tem de se desviar do teclado é a app. O React Native mede-a pelos insets
 * do IME e desconta a barra de navegação (`ReactRootView`), por isso o que
 * tapa o ecrã é esta altura MAIS o inset de baixo.
 */
export function useTeclado(): number {
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    const abre = Keyboard.addListener("keyboardDidShow", (e) => setAltura(e.endCoordinates.height));
    const fecha = Keyboard.addListener("keyboardDidHide", () => setAltura(0));
    return () => {
      abre.remove();
      fecha.remove();
    };
  }, []);
  return altura;
}
