import { Pressable, View } from "react-native";
import { Texto } from "./texto";
import type { Sport } from "@bricklap/engine";
import { t } from "../i18n";
import { Folha } from "./folha";
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
 * voltar do Android, que a `Folha` trata — não toca na sessão.
 *
 * Sessão 28: deixou de ser um `Modal` (ver `ui/folha.tsx`) e o Cancelar
 * passou para o rodapé fixo, livre da barra de navegação.
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
        {/* O nome tem a coluna toda e pode ir a duas linhas; o "Atual" fica por baixo.
            Ao lado do nome, "Remo indoor" e "Natação (piscina)" ficavam cortados
            ("Remo i…") — e o nome é o que se escolhe. */}
        <View style={{ flex: 1, minWidth: 0, paddingVertical: E.e1 }}>
          <Texto
            numberOfLines={2}
            style={texto(15, 700, ativo ? tokens.acentoTinta : tokens.tinta)}
          >
            {t(`sport.${s}.label`)}
          </Texto>
          {ativo ? (
            <Texto style={{ ...kicker(tokens.acentoTinta), fontSize: 10 }}>
              {t("mobile.currentSportTag")}
            </Texto>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const grelha = (desportos: Sport[], rotuloSeccao: string) => (
    <View style={{ gap: E.e2, marginTop: E.e4 }}>
      <Texto style={{ ...kicker(tokens.tinta3), fontSize: 11.5 }}>{rotuloSeccao}</Texto>
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
    <Folha
      tokens={tokens}
      visivel={props.visivel}
      onCancelar={props.onCancelar}
      testIDVeu="change-sport-backdrop"
      rotuloCancelar={t("common.cancel")}
      alturaMax={0.88}
      cabeca={
        <Texto style={texto(17, 800, tokens.tinta, { marginTop: E.e3 })}>
          {t("mobile.changeTo")}
        </Texto>
      }
      rodape={
        <Pressable
          testID="change-sport-cancel"
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={props.onCancelar}
          style={({ pressed }) => ({
            minHeight: TOQUE,
            borderRadius: R.m,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? tokens.sup2 : "transparent",
          })}
        >
          <Texto style={texto(15.5, 700, tokens.tinta2)}>{t("common.cancel")}</Texto>
        </Pressable>
      }
    >
      {grelha(ORDEM_GINASIO, t("mobile.indoorGroup"))}
      {grelha(ORDEM_RUA, t("mobile.streetGroup"))}
      <View style={{ height: E.e3 }} />
    </Folha>
  );
}
