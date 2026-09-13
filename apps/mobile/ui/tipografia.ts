import type { TextStyle } from "react-native";

/**
 * Duas famílias, ambas EMBEBIDAS no APK (DESIGN.md §3): sem CDN, sem rede, e
 * o ecrã de gravação nunca fica à espera de uma fonte a meio de um treino.
 *
 * - **Texto: Inter.** Tudo o que é palavra.
 * - **Números: Archivo Expanded** (eixo `wdth` 125, instâncias estáticas —
 *   em React Native não se depende de um eixo variável), com `tabular-nums`.
 *   Tudo o que é medida: cronómetro, tempo de bloco, totais, distâncias.
 *
 * No Android cada peso é um ficheiro e a família é o nome do ficheiro: um
 * `fontWeight` sobre uma fonte embebida é ignorado ou sintetizado a feio.
 * Por isso o peso escolhe a FAMÍLIA aqui, e nunca se escreve `fontWeight`
 * ao lado de uma destas.
 */
export type PesoTexto = 400 | 500 | 600 | 700 | 800;
export type PesoNumero = 600 | 700 | 800;

const TEXTO: Record<PesoTexto, string> = {
  400: "Inter-Regular",
  500: "Inter-Medium",
  600: "Inter-SemiBold",
  700: "Inter-Bold",
  800: "Inter-ExtraBold",
};

const NUMERO: Record<PesoNumero, string> = {
  600: "ArchivoExpanded-SemiBold",
  700: "ArchivoExpanded-Bold",
  800: "ArchivoExpanded-ExtraBold",
};

/** Os oito ficheiros a embeber, na ordem em que o plugin do Expo os lê. */
export const FICHEIROS_DE_FONTE = [
  "./assets/fontes/Inter-Regular.ttf",
  "./assets/fontes/Inter-Medium.ttf",
  "./assets/fontes/Inter-SemiBold.ttf",
  "./assets/fontes/Inter-Bold.ttf",
  "./assets/fontes/Inter-ExtraBold.ttf",
  "./assets/fontes/ArchivoExpanded-SemiBold.ttf",
  "./assets/fontes/ArchivoExpanded-Bold.ttf",
  "./assets/fontes/ArchivoExpanded-ExtraBold.ttf",
] as const;

/** Uma palavra. Nunca para um número. */
export function texto(tamanho: number, peso: PesoTexto, cor: string, extra?: TextStyle): TextStyle {
  return { fontFamily: TEXTO[peso], fontSize: tamanho, color: cor, ...extra };
}

/**
 * Uma medida. Tabular sempre: sem isso o cronómetro salta de largura a cada
 * segundo (medido na sessão 13a — `00:00`, `11:11` e `88:88` têm de medir os
 * mesmos 291,66 px a 84/800).
 */
export function numero(tamanho: number, peso: PesoNumero, cor: string, extra?: TextStyle): TextStyle {
  return {
    fontFamily: NUMERO[peso],
    fontSize: tamanho,
    color: cor,
    fontVariant: ["tabular-nums"],
    ...extra,
  };
}

/** Rótulo em maiúsculas pequenas (DESIGN.md §3): 11/700, `letter-spacing .1em`. */
export function kicker(cor: string): TextStyle {
  return { ...texto(11, 700, cor), letterSpacing: 1.1, textTransform: "uppercase" };
}
