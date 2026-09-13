import { useColorScheme } from "react-native";
import { TOKENS, temaDoEcra, type Ecra, type Preset, type Superficie, type Tokens } from "./tokens";

/**
 * O tema de UM ecrã. O preset é a preferência do atleta (guardada na base,
 * tabela `settings`); a superfície sai daqui, e nenhum componente abaixo
 * precisa de saber qual dos presets está ativo — recebe tokens e desenha.
 *
 * É esta indireção que faz o híbrido funcionar sem um `if` espalhado pelos
 * ecrãs: a gravação pede o seu tema e recebe o escuro, o histórico pede o
 * dele e recebe o claro, com o mesmo preset ativo.
 */
export function usarTema(preset: Preset, ecra: Ecra): { tema: Superficie; tokens: Tokens } {
  const sistema: Superficie = useColorScheme() === "dark" ? "escuro" : "claro";
  const tema = temaDoEcra(preset, ecra, sistema);
  return { tema, tokens: TOKENS[tema] };
}
