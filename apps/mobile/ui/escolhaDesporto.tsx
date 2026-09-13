import { Modal, Pressable, Text, View } from "react-native";
import type { Sport } from "@bricklap/engine";
import { t } from "../i18n";
import { Icone } from "./icones";
import { kicker, texto } from "./tipografia";
import { COR_DESPORTO, E, ORDEM_GINASIO, ORDEM_RUA, R, TOQUE, type Superficie, type Tokens } from "./tokens";

/**
 * A escolha de desporto do Mudar — sessão 17, reversão de uma decisão de
 * âmbito da sessão 14 (o Mudar percorria os oito desportos em ciclo, sem o
 * brief o mandar). Duas razões do fundador para reverter: o protótipo da
 * sessão 10, cujo fluxo foi aprovado, conta **2 toques** para "Mudar de
 * desporto" — Mudar abre a escolha, o segundo toque escolhe — e o ciclo
 * escrevia um `changeSport` por toque, deixando segmentos de ~0 s na base
 * append-only (dano nos dados, não só um toque a mais).
 *
 * **Nenhum evento se escreve ao abrir esta escolha**: só `onEscolher`
 * dispara a mudança (`App.tsx`), e cancelar — toque fora, ou o gesto de
 * voltar do Android, que o `Modal` trata por `onRequestClose` — não toca na
 * sessão.
 */
export function EscolhaDesporto(props: {
  tokens: Tokens;
  tema: Superficie;
  visivel: boolean;
  atual: Sport;
  onEscolher: (s: Sport) => void;
  onCancelar: () => void;
}) {
  const { tokens, tema } = props;

  const tile = (s: Sport) => {
    const ativo = s === props.atual;
    return (
      <Pressable
        key={s}
        testID={`change-sport-${s}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: ativo, selected: ativo }}
        accessibilityLabel={ativo ? `${t(`sport.${s}.label`)} — ${t("mobile.currentSportTag")}` : t(`sport.${s}.label`)}
        disabled={ativo}
        onPress={() => props.onEscolher(s)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: TOQUE,
          borderRadius: R.m,
          borderWidth: 1.5,
          borderColor: ativo ? tokens.acento : tokens.linha,
          backgroundColor: ativo ? tokens.acentoFundo : pressed ? tokens.sup2 : tokens.sup,
          flexDirection: "row",
          alignItems: "center",
          gap: E.e2,
          paddingHorizontal: E.e3,
        })}
      >
        <Icone nome={s} cor={ativo ? tokens.acentoTinta : COR_DESPORTO[tema][s]} tamanho={18} />
        <Text numberOfLines={1} style={texto(15, 700, ativo ? tokens.acentoTinta : tokens.tinta, { flexShrink: 1, flex: 1 })}>
          {t(`sport.${s}.label`)}
        </Text>
        {ativo ? <Text style={{ ...kicker(tokens.acentoTinta), fontSize: 10 }}>{t("mobile.currentSportTag")}</Text> : null}
      </Pressable>
    );
  };

  const grelha = (desportos: Sport[], rotuloSeccao: string) => (
    <View style={{ gap: E.e2, marginTop: E.e4 }}>
      <Text style={{ ...kicker(tokens.tinta3), fontSize: 11.5 }}>{rotuloSeccao}</Text>
      <View style={{ gap: E.e2 }}>
        {[desportos.slice(0, 2), desportos.slice(2, 4)].map((par, i) => (
          <View key={i} style={{ flexDirection: "row", gap: E.e2 }}>
            {par.map(tile)}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Modal
      visible={props.visivel}
      transparent
      animationType="fade"
      onRequestClose={props.onCancelar}
      statusBarTranslucent
    >
      <Pressable
        testID="change-sport-backdrop"
        accessibilityLabel={t("common.cancel")}
        style={{ flex: 1, backgroundColor: tokens.veu, justifyContent: "flex-end" }}
        onPress={props.onCancelar}
      >
        {/* Um `Pressable` sem ação própria reclama o toque para si: sem ele, um
            toque dentro da folha, em espaço sem botão, cairia para o véu por
            baixo e fechava a escolha sozinho. */}
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: tokens.fundo,
            borderTopLeftRadius: R.folha,
            borderTopRightRadius: R.folha,
            paddingTop: E.e3,
            paddingHorizontal: E.e5,
            paddingBottom: E.e6,
            maxHeight: "88%",
          }}
        >
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.linha }} />
          <Text style={texto(17, 800, tokens.tinta, { marginTop: E.e3 })}>{t("mobile.changeTo")}</Text>
          {grelha(ORDEM_GINASIO, t("mobile.gymGroup"))}
          {grelha(ORDEM_RUA, t("mobile.streetGroup"))}
          <Pressable
            testID="change-sport-cancel"
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={props.onCancelar}
            style={({ pressed }) => ({
              marginTop: E.e5,
              minHeight: TOQUE,
              borderRadius: R.m,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? tokens.sup2 : "transparent",
            })}
          >
            <Text style={texto(15.5, 700, tokens.tinta2)}>{t("common.cancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
