import { Text, View } from "react-native";
import { Logotipo } from "./logotipo";
import type { Tokens } from "./tokens";

/**
 * O lockup do cabeçalho: o símbolo e a palavra "Bricklap" lado a lado —
 * sessão 17. Desde a sessão 15 o cabeçalho só tinha o símbolo (`Logotipo`);
 * a app ficou sem nome à vista, e o fundador pediu-o de volta.
 *
 * **A palavra vai em Archivo Expanded**, a mesma família dos números —
 * exceção deliberada à regra do DESIGN.md §3 ("palavras nunca em Archivo"),
 * documentada aqui e no §8b: é a mesma escolha que o lockup horizontal da
 * marca (`docs/marca/bricklap-horizontal.svg`) já fazia para "Bricklap" fora
 * da app, com o mesmo peso 700 — a família da marca, não a do texto corrido.
 * Já está embebida no APK (`ui/tipografia.ts`); nenhum ficheiro novo.
 *
 * **Não é um wordmark a sério.** Como o resto da marca (`docs/marca/README.md`,
 * "Marca de trabalho, congelada"), é provisório: alinhamento e proporções
 * escolhidos a olho, não desenhados por um tipógrafo. Fica registado para não
 * se ler como definitivo.
 */
export type TratamentoNome = {
  /** Tamanho do quadrado do símbolo. */
  simbolo: number;
  /** Tamanho da palavra, em Archivo Expanded. */
  texto: number;
  peso: 600 | 700 | 800;
  /** `letterSpacing` da palavra, em px (a Expanded é larga; costuma pedir negativo). */
  tracking: number;
  /** Vão entre o símbolo e a palavra. */
  vao: number;
  /**
   * Ajuste vertical fino da palavra, em px. Positivo desce. A Archivo
   * Expanded tem descendente no "p" de Bricklap; sem este ajuste a palavra
   * lê-se deslocada para baixo do centro ótico do símbolo, que não tem
   * descendente nenhum.
   */
  ajuste: number;
};

const FAMILIA: Record<TratamentoNome["peso"], string> = {
  600: "ArchivoExpanded-SemiBold",
  700: "ArchivoExpanded-Bold",
  800: "ArchivoExpanded-ExtraBold",
};

/**
 * Três tratamentos mostrados ao fundador no ecrã real (sessão 17, relatório
 * §3.2): variam escala e peso, como o brief pediu.
 *
 * **A: escolhido.** Bold 700, não ExtraBold 800 nem SemiBold 600 — a mesma
 * escolha que o lockup horizontal da marca já fazia (`docs/marca/README.md`,
 * "Qual variante"): o 800 compete com o símbolo, o 600 lê-se fino de mais ao
 * lado de uma forma cheia. Medido na captura do telemóvel: o centro ótico do
 * símbolo (bbox de tinta, sem o descendente que a marca não tem) ficava a
 * ~3,5 px do centro da caixa de tampa/x-height da palavra (que tem o
 * descendente do "p" a empurrar o centro para baixo) — daí o ajuste de -4.
 */
export const TRATAMENTOS_NOME: readonly TratamentoNome[] = [
  { simbolo: 26, texto: 19, peso: 700, tracking: -0.2, vao: 8, ajuste: -4 },
  { simbolo: 26, texto: 21, peso: 800, tracking: -0.3, vao: 7, ajuste: -1.5 },
  { simbolo: 26, texto: 17, peso: 600, tracking: 0, vao: 9, ajuste: -0.5 },
] as const;

export const TRATAMENTO_PREDEFINIDO = 0;

export function LogotipoComPalavra(props: { tokens: Tokens; tratamento?: TratamentoNome }) {
  const tr = props.tratamento ?? TRATAMENTOS_NOME[TRATAMENTO_PREDEFINIDO]!;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Bricklap"
      style={{ flexDirection: "row", alignItems: "center", gap: tr.vao }}
    >
      <Logotipo tamanho={tr.simbolo} />
      <Text
        style={{
          fontFamily: FAMILIA[tr.peso],
          fontSize: tr.texto,
          color: props.tokens.tinta,
          letterSpacing: tr.tracking,
          marginTop: tr.ajuste,
        }}
      >
        Bricklap
      </Text>
    </View>
  );
}
