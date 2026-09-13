import { Path, Rect, Svg } from "react-native-svg";
import { coresDoLogotipo } from "./coresDoLogotipo";

/**
 * O logótipo do Bricklap, na app.
 *
 * É o mesmo desenho de `docs/marca/bricklap-logo.svg`, com a mesma geometria:
 * grelha de 100, moldura de traço 13 e raio 20 (raio interior 7), interior
 * vazado, e três peças — o pilar à esquerda e dois retângulos à direita,
 * alinhados com ele. Não é um ficheiro importado porque um SVG de duas cores
 * chapadas em quinze linhas de JSX pesa menos do que o carregador que seria
 * preciso para o ler, e assim herda a cor quando tem de ser monocromático.
 *
 * **A distinção entre o B (`#C0402C`) e o L (`#E89478`) é a alma da marca** e
 * mantém-se em tudo o que é visível (decisão do fundador): sem cores pedidas,
 * sai a duas tonalidades. `corB` sozinha existe só para os constrangimentos
 * técnicos onde duas não cabem — ver `coresDoLogotipo.ts` e
 * `docs/marca/README.md`.
 */

const TRACO = 13;
const RAIO = 20;
const RAIO_INT = RAIO - TRACO;
const FOLGA = 6;
const X0 = TRACO + FOLGA;
const X1 = 100 - TRACO - FOLGA;
const CAMPO = X1 - X0;
const PILAR = 13;
const VAO = 5;
const DIR_X = X0 + PILAR + VAO;
const DIR_W = X1 - DIR_X;
const PECA_H = (CAMPO - VAO) / 2;
const R_PECA = 3;

function rr(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} ` +
    `V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} ` +
    `H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} ` +
    `V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
  );
}

/** A moldura vazada: fora menos dentro, com evenodd — buraco a sério. */
const MOLDURA = `${rr(0, 0, 100, 100, RAIO)} ${rr(TRACO, TRACO, 100 - 2 * TRACO, 100 - 2 * TRACO, RAIO_INT)}`;

export function Logotipo(props: { tamanho: number; corB?: string; corL?: string }) {
  const { b, l } = coresDoLogotipo(props.corB, props.corL);
  return (
    <Svg width={props.tamanho} height={props.tamanho} viewBox="0 0 100 100">
      <Path d={MOLDURA} fill={b} fillRule="evenodd" />
      <Rect x={X0} y={X0} width={PILAR} height={CAMPO} rx={R_PECA} fill={b} />
      <Rect x={DIR_X} y={X0} width={DIR_W} height={PECA_H} rx={R_PECA} fill={b} />
      <Rect x={DIR_X} y={X0 + PECA_H + VAO} width={DIR_W} height={PECA_H} rx={R_PECA} fill={l} />
    </Svg>
  );
}
