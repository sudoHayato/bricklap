import { Circle, Path, Rect, Svg } from "react-native-svg";
import type { Sport } from "@bricklap/engine";

/**
 * Os ícones originais do Bricklap (DESIGN.md §5), os mesmos traçados do
 * protótipo `docs/prototipo/bricklap.html`: traço de 2 px, extremos e junções
 * redondos, grelha de 24×24, sem preenchimento, a herdar a cor de quem os usa.
 *
 * Os de desporto descrevem o APARELHO e não a pessoa — barra com dois discos,
 * tapete com consola, carril com banco e cabo —, e os de navegação repetem o
 * motivo do produto: o início é um tijolo, o histórico são três fiadas
 * desencontradas, as definições são três reguladores sobre linhas.
 */
export type NomeIcone =
  | Sport
  | "marca"
  | "mudar"
  | "parar"
  | "relogio"
  | "aviso"
  | "voltar"
  | "apagar"
  | "certo"
  | "inicio"
  | "historico"
  | "definicoes";

const D: Record<NomeIcone, string[]> = {
  strength: ["M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"],
  treadmill: ["M3 17h11l5-3M4 17l-1 3M14 17l1 3M18 14V5h2.5"],
  rowing_indoor: ["M3 19h18M9 19v-4h4.5v4M13.5 13.5L19 8M13.5 15.5L9.5 19"],
  swimming_pool: ["M3 10c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0M3 16c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0"],
  run: ["M4 19l5-5-2.5-3L13 6", "M13 6h4"],
  walk: ["M4 19c0-6 6-5 8-8s2-6 8-6"],
  bike: ["M5.5 16.5L11 7h3M11 7l4 9.5"],
  transition: ["M8 4v12M8 20v-1M16 20V8M16 4v1M4.5 12.5L8 16l3.5-3.5M12.5 11.5L16 8l3.5 3.5"],
  marca: ["M6 21V4M6 4h11l-2.5 4.5L17 13H6"],
  mudar: ["M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"],
  parar: [],
  relogio: ["M12 9.5V13l3 2M9.5 3h5"],
  aviso: ["M12 7.5v5.5M12 16.3v.4"],
  voltar: ["M14 5.5L7.5 12 14 18.5"],
  apagar: ["M5 7h14M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"],
  certo: ["M5 12.5l4.5 4.5L19 7.5"],
  inicio: ["M3 12h18M12 5.5V12M7.5 12v6.5M16.5 12v6.5"],
  historico: ["M3 6.5h7M12.5 6.5h8.5M3 12h11.5M17 12h4M3 17.5h6M11.5 17.5h9.5"],
  definicoes: ["M3 7h5M11 7h10M3 12h11M17 12h4M3 17h7M13 17h8"],
};

/** Os círculos e retângulos que alguns ícones têm além dos traçados. */
const CIRCULOS: Partial<Record<NomeIcone, [number, number, number][]>> = {
  run: [
    [4, 19, 1.7],
    [19, 6, 1.7],
  ],
  walk: [
    [4, 19, 1.7],
    [20, 5, 1.7],
  ],
  bike: [
    [5.5, 16.5, 3.5],
    [18.5, 16.5, 3.5],
  ],
  relogio: [[12, 13, 8]],
  aviso: [[12, 12, 9]],
};

/** x, y, largura, altura, raio. */
const RETANGULOS: Partial<Record<NomeIcone, [number, number, number, number, number][]>> = {
  parar: [[6, 6, 12, 12, 2.5]],
  inicio: [[3, 5.5, 18, 13, 2.5]],
  definicoes: [
    [8, 5, 3, 4, 1],
    [14, 10, 3, 4, 1],
    [10, 15, 3, 4, 1],
  ],
};

export function Icone(props: { nome: NomeIcone; cor: string; tamanho?: number }) {
  const t = props.tamanho ?? 22;
  return (
    <Svg
      width={t}
      height={t}
      viewBox="0 0 24 24"
      fill="none"
      stroke={props.cor}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(RETANGULOS[props.nome] ?? []).map(([x, y, w, h, r], i) => (
        <Rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={r} />
      ))}
      {(CIRCULOS[props.nome] ?? []).map(([cx, cy, r], i) => (
        <Circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
      {D[props.nome].map((d, i) => (
        <Path key={`p${i}`} d={d} />
      ))}
    </Svg>
  );
}
