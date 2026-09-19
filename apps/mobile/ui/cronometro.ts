import type { TextStyle } from "react-native";
import { numero } from "./tipografia";
import { E } from "./tokens";

/**
 * As medidas dos cronómetros grandes, num sítio só e sem nada de React Native
 * dentro, para o ecrã e o teste de largura (`test/cronometro.test.ts`) lerem
 * os mesmos números (sessão 28).
 *
 * O cronómetro tem 8 caracteres a partir da primeira hora (`01:03:19`, o
 * `formatDuration` do motor põe a hora a dois dígitos) e a 84 px isso mede
 * cerca de 428 px, para 344 de largura útil: **acima de uma hora o cronómetro
 * só cabe encolhendo** (`TextoJusto`, `adjustsFontSizeToFit`), a cerca de 80 %.
 * O teste prova que o encolhimento necessário está sempre dentro do que o
 * ecrã permite, a 1,0 e a 1,3 da letra do sistema.
 */
export const CRONOMETRO = {
  /** O ecrã de gravação. */
  gravacao: { tamanho: 84, peso: 800, alturaDeLinha: 0.92, espacamento: -2.94 },
  /** O total de uma sessão: resumo e retoma. */
  total: { tamanho: 72, peso: 800, alturaDeLinha: 0.9, espacamento: -2.88 },
} as const;

/** O menos que o ecrã deixa o cronómetro encolher, em fração do tamanho pedido. */
export const MINIMO_DO_CRONOMETRO = 0.5;

export type MedidaDoCronometro = (typeof CRONOMETRO)[keyof typeof CRONOMETRO];

export function estiloDoCronometro(c: MedidaDoCronometro, cor: string): TextStyle {
  return numero(c.tamanho, c.peso, cor, {
    lineHeight: c.tamanho * c.alturaDeLinha,
    letterSpacing: c.espacamento,
  });
}

/** A largura útil de um ecrã: a largura, menos a margem lateral (20) dos dois lados. */
export function larguraUtil(larguraDaTela: number): number {
  return larguraDaTela - 2 * E.e5;
}
