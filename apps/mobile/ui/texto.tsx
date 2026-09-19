import { forwardRef } from "react";
import { Text, TextInput, type TextInputProps, type TextProps } from "react-native";

/**
 * O texto da app, com a letra grande do sistema tratada (sessão 28).
 *
 * O Android deixa o atleta aumentar a letra do sistema até 2×. Os ecrãs do
 * Bricklap já são desenhados para se lerem de relance — o cronómetro tem 84
 * px — e a 2× nada cabe: o cronómetro sai do ecrã e os rótulos partem-se a
 * meio da palavra. A regra (DESIGN.md §3): **todo o texto acompanha a letra
 * do sistema até 1,3×, e não mais**; e nenhum desenho pode depender de uma
 * palavra caber numa coluna estreita — um rótulo tem a linha só para ele,
 * ou tem `numberOfLines={1}` e encolhe (`adjustsFontSizeToFit`).
 *
 * Nenhum ecrã importa `Text` ou `TextInput` do react-native diretamente.
 */
export const ESCALA_MAX = 1.3;

export function Texto(props: TextProps) {
  return <Text maxFontSizeMultiplier={ESCALA_MAX} {...props} />;
}

/** Uma linha só, que encolhe em vez de se partir ou de sair da caixa: botões, títulos, números grandes. */
export function TextoJusto(props: TextProps & { minimo?: number }) {
  const { minimo, ...resto } = props;
  return (
    <Text
      maxFontSizeMultiplier={ESCALA_MAX}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={minimo ?? 0.6}
      {...resto}
    />
  );
}

export const Escrita = forwardRef<TextInput, TextInputProps>(function Escrita(props, ref) {
  return <TextInput ref={ref} maxFontSizeMultiplier={ESCALA_MAX} {...props} />;
});
