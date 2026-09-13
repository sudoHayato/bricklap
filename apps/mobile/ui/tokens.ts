import type { Sport } from "@bricklap/engine";

/**
 * O sistema visual de `docs/DESIGN.md` em código. Em conflito entre este
 * ficheiro e o documento, manda o documento — os valores aqui são cópia dele,
 * não uma segunda fonte de verdade.
 *
 * Duas superfícies (clara e escura) e quatro presets que as combinam. O tema
 * decide-se POR ECRÃ e não pela app: `temaDoEcra` recebe o ecrã e devolve a
 * superfície, e nenhum componente sabe qual dos presets está ativo.
 */
export type Superficie = "claro" | "escuro";

/** A preferência do atleta. O híbrido é a predefinida (decisão do fundador). */
export type Preset = "claro" | "escuro" | "hibrido" | "sistema";

export const PRESETS: readonly Preset[] = ["claro", "escuro", "hibrido", "sistema"] as const;
export const PRESET_PREDEFINIDO: Preset = "hibrido";

/** Chave da preferência na tabela `settings` (esquema v3). */
export const CHAVE_TEMA = "tema";

export function presetValido(valor: string | null): Preset {
  return (PRESETS as readonly string[]).includes(valor ?? "") ? (valor as Preset) : PRESET_PREDEFINIDO;
}

/**
 * Os ecrãs de treino — hoje só a gravação. É a lista que o híbrido usa para
 * saber o que é treino e o que é consulta.
 */
export type Ecra = "inicio" | "gravacao" | "retoma" | "resumo" | "historico" | "definicoes";
const TREINO: ReadonlySet<Ecra> = new Set<Ecra>(["gravacao"]);

export function temaDoEcra(preset: Preset, ecra: Ecra, sistema: Superficie): Superficie {
  if (preset === "claro") return "claro";
  if (preset === "escuro") return "escuro";
  if (preset === "sistema") return sistema;
  return TREINO.has(ecra) ? "escuro" : "claro";
}

export type Tokens = {
  fundo: string;
  sup: string;
  sup2: string;
  linha: string;
  tinta: string;
  tinta2: string;
  tinta3: string;
  acento: string;
  acentoPremido: string;
  acentoTinta: string;
  acentoFundo: string;
  sobreAcento: string;
  veu: string;
  /** O vinco da fiada: a cor do fundo, não um corte. */
  junta: string;
};

export const TOKENS: Record<Superficie, Tokens> = {
  claro: {
    fundo: "#FBF8F4",
    sup: "#FFFFFF",
    sup2: "#F2ECE4",
    linha: "#E6DFD6",
    tinta: "#16120F",
    tinta2: "#5A524B",
    tinta3: "#948A81",
    acento: "#B03A2A",
    acentoPremido: "#96301E",
    acentoTinta: "#9A3122",
    acentoFundo: "#F9EBE9",
    sobreAcento: "#FFFFFF",
    veu: "rgba(22,18,15,0.55)",
    junta: "rgba(255,253,250,0.55)",
  },
  escuro: {
    fundo: "#121010",
    sup: "#1C1917",
    sup2: "#272220",
    linha: "#332D2A",
    tinta: "#F7F2EC",
    tinta2: "#B5ABA2",
    tinta3: "#7A716A",
    acento: "#D14F3D",
    acentoPremido: "#B03A2A",
    acentoTinta: "#E88073",
    acentoFundo: "#341714",
    sobreAcento: "#FFFFFF",
    veu: "rgba(0,0,0,0.62)",
    junta: "rgba(14,12,12,0.6)",
  },
};

/**
 * A cor do desporto vive em dois sítios e mais nenhum: o ÍCONE, com a cor
 * cheia, e o troço de FIADA, a 84 % sobre o fundo do tema. Nunca como fundo de
 * um bloco, nunca em texto e — desde a sessão 13b — nunca como barra vertical
 * na lateral de um cartão.
 */
export const COR_DESPORTO: Record<Superficie, Record<Sport, string>> = {
  claro: {
    strength: "#6B4E3D",
    treadmill: "#2F6A94",
    rowing_indoor: "#1F8079",
    swimming_pool: "#1F8079",
    run: "#4E8A3C",
    walk: "#4E8A3C",
    bike: "#9A6A1E",
    transition: "#7C756B",
  },
  escuro: {
    strength: "#C49A82",
    treadmill: "#7FB2D9",
    rowing_indoor: "#5FBDB4",
    swimming_pool: "#5FBDB4",
    run: "#8AC176",
    walk: "#8AC176",
    bike: "#D9AE5E",
    transition: "#A9A199",
  },
};

/**
 * A mesma cor a 84 % misturada com o `fundo` do tema, já calculada porque em
 * React Native não há `color-mix`. São os hexes da tabela de `DESIGN.md` §7.
 * Mistura e NÃO opacidade: a opacidade apagava também o vinco, e foi o que
 * borrou a fiada na sessão 13b.
 */
export const COR_FIADA: Record<Superficie, Record<Sport, string>> = {
  claro: {
    strength: "#82695A",
    treadmill: "#5081A3",
    rowing_indoor: "#42938D",
    swimming_pool: "#42938D",
    run: "#6A9C59",
    walk: "#6A9C59",
    bike: "#AA8140",
    transition: "#908A81",
  },
  escuro: {
    strength: "#A88470",
    treadmill: "#6E98B9",
    rowing_indoor: "#53A19A",
    swimming_pool: "#53A19A",
    run: "#77A566",
    walk: "#77A566",
    bike: "#B99552",
    transition: "#918A83",
  },
};

/** Escala de espaçamento (DESIGN.md §4). Margem lateral dos ecrãs: E5. */
export const E = { e1: 4, e2: 8, e3: 12, e4: 16, e5: 20, e6: 24, e7: 32 } as const;

/** Raios: pequeno, botão / linha de tabela, cartão, botão largo, folha, pílula. */
export const R = { s: 8, m: 12, g: 16, xl: 20, folha: 24, pill: 999 } as const;

/** Alvo de toque em treino. Consulta: 44. O botão Marca tem 110. */
export const TOQUE = 56;
export const TOQUE_CONSULTA = 44;
