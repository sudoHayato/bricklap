/**
 * As cores do logótipo, fora do componente para se poderem testar em Node.
 *
 * **A distinção entre o B (`#C0402C`) e o L (`#E89478`) é a alma da marca** e
 * mantém-se em tudo o que é visível — ícone da app, arranque, cabeçalho,
 * documentos (decisão do fundador, `docs/marca/README.md`). Por isso, sem
 * nenhuma cor pedida, o logótipo sai SEMPRE a duas tonalidades.
 *
 * A uma cor só existe quando quem chama a pede, passando `corB` sem `corL`:
 * é o caso dos constrangimentos técnicos (monocromático, < 24 px).
 *
 * Na sessão 15 a regra estava invertida por um `corL ?? corB`: sem cores
 * pedidas, o L caía no B e o cabeçalho saiu a uma cor sem ninguém o pedir.
 */
export const MARCA_B = "#C0402C";
export const MARCA_L = "#E89478";

export function coresDoLogotipo(corB?: string, corL?: string): { b: string; l: string } {
  if (corB === undefined) return { b: MARCA_B, l: corL ?? MARCA_L };
  return { b: corB, l: corL ?? corB };
}
