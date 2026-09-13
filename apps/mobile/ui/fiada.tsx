import { useId, useState } from "react";
import { View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import type { Sport } from "@bricklap/engine";
import { COR_FIADA, R, type Superficie, TOKENS } from "./tokens";

/**
 * A FIADA — a assinatura do Bricklap (DESIGN.md §7). Uma barra fina contínua
 * de cantos arredondados, um troço por bloco, largura proporcional ao tempo,
 * com a cor do desporto a 84 % sobre o fundo do tema.
 *
 * É contexto e não protagonista, mas primeiro é DADO: a versão da sessão 13b,
 * mais discreta por opacidade, ficou ilegível e foi revertida. Os números
 * abaixo são os validados na 13c, e passam o critério de aceitação escrito no
 * DESIGN.md §7 — numa fiada de 25 blocos tem de conseguir contar-se quantos
 * troços há de cada desporto.
 *
 * Três regras, e nenhuma é gosto:
 * 1. **São as cores que separam**, não a argamassa: entre dois troços de cor
 *    diferente há uma transição curta, no máximo 0,9 pontos percentuais da
 *    largura e nunca mais de 18 % do troço mais curto que lhe toca. Com os
 *    45 % que vigoraram até à 13c, o troço mais estreito de uma sessão de 25
 *    blocos ficava com 0,9 px de cor cheia; com 18 % ficam 5,8 px.
 * 2. **A junta** — 1 px do token `junta`, um vinco da cor do fundo e não um
 *    corte — aparece só onde a cor NÃO muda, que é o único sítio onde sem ela
 *    se perdia um bloco (força a seguir a força).
 * 3. **Piso de largura**: 82 % proporção ao tempo + 18 % repartido por igual,
 *    para um bloco de 50 s não desaparecer ao lado de um de 10 min.
 */
export type TrocoFiada = { sport: Sport; ms: number };

const ALTURA = 6;
const ALTURA_ALTA = 9;

export function Fiada(props: {
  blocos: readonly TrocoFiada[];
  tema: Superficie;
  /** 9 px em vez de 6: só sob o cronómetro, onde a fiada é o total da sessão. */
  alta?: boolean;
  estilo?: ViewStyle;
}) {
  const [largura, setLargura] = useState(0);
  const id = useId().replace(/[^A-Za-z0-9]/g, "");
  const h = props.alta ? ALTURA_ALTA : ALTURA;
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  if (props.blocos.length === 0) return null;

  const cor = (b: TrocoFiada) => COR_FIADA[props.tema][b.sport];
  const durs = props.blocos.map((b) => Math.max(1, b.ms));
  const total = durs.reduce((a, d) => a + d, 0);
  const igual = 100 / props.blocos.length;
  const ws = durs.map((d) => 0.82 * ((d / total) * 100) + 0.18 * igual);

  const paradas: { offset: number; cor: string }[] = [{ offset: 0, cor: cor(props.blocos[0]!) }];
  const vincos: number[] = [];
  let cum = 0;
  for (let j = 0; j < props.blocos.length - 1; j++) {
    cum += ws[j]!;
    const m = Math.min(0.9, 0.18 * Math.min(ws[j]!, ws[j + 1]!));
    paradas.push({ offset: cum - m, cor: cor(props.blocos[j]!) });
    paradas.push({ offset: cum + m, cor: cor(props.blocos[j + 1]!) });
    if (cor(props.blocos[j]!) === cor(props.blocos[j + 1]!)) vincos.push(cum);
  }
  paradas.push({ offset: 100, cor: cor(props.blocos[props.blocos.length - 1]!) });

  return (
    <View onLayout={medir} style={[{ height: h, borderRadius: R.pill, overflow: "hidden" }, props.estilo]}>
      {largura > 0 ? (
        <Svg width={largura} height={h}>
          <Defs>
            <LinearGradient id={`f${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              {paradas.map((p, i) => (
                <Stop key={i} offset={`${p.offset.toFixed(2)}%`} stopColor={p.cor} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={largura} height={h} rx={h / 2} fill={`url(#f${id})`} />
          {vincos.map((v, i) => (
            <Rect
              key={i}
              x={Math.max(0, (v / 100) * largura - 0.5)}
              y={0}
              width={1}
              height={h}
              fill={TOKENS[props.tema].junta}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
