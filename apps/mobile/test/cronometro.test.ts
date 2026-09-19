import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLiveSession, durationMs, formatDuration } from "@bricklap/engine";
import { CRONOMETRO, MINIMO_DO_CRONOMETRO, larguraUtil } from "../ui/cronometro";
import { ESCALA_MAX } from "../ui/tipografia";

/**
 * O cronómetro largo NÃO transborda (sessão 28).
 *
 * Provar isto esperando uma hora num telemóvel é uma espera, não uma
 * verificação. O tempo entra por parâmetro no motor (`durationMs(session,
 * at)`), a largura sai da fonte REAL embebida na app, e o ecrã tem uma regra
 * de encolhimento (`TextoJusto`: `adjustsFontSizeToFit`, com um mínimo).
 * Este teste junta as três: para cada duração de um treino a sério, a
 * largura natural do cronómetro, a letra do sistema a 1,0 e a 1,3 (e a 2,0,
 * que a app limita a 1,3), e a conta de quanto ele tem de encolher para
 * caber — e exige que fique dentro do que o ecrã permite.
 *
 * O que ele NÃO prova: que o React Native encolhe mesmo o texto no telemóvel.
 * Isso é do ecrã e vê-se numa captura; aqui prova-se que a conta fecha.
 */

/** Um leitor mínimo de TrueType: só `head`, `hhea`, `hmtx` e o `cmap` de formato 4. */
function lerFonte(caminho: string) {
  const b = readFileSync(caminho);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tabelas = new Map<string, number>();
  const n = v.getUint16(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    tabelas.set(b.toString("ascii", o, o + 4), v.getUint32(o + 8));
  }
  const t = (nome: string) => {
    const o = tabelas.get(nome);
    if (o === undefined) throw new Error(`a fonte não tem a tabela ${nome}`);
    return o;
  };
  const unidades = v.getUint16(t("head") + 18);
  const nMetricas = v.getUint16(t("hhea") + 34);
  const hmtx = t("hmtx");
  const cmap = t("cmap");
  // O subconjunto de formato 4 (Unicode BMP).
  let sub = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const o = cmap + v.getUint32(cmap + 4 + i * 8 + 4);
    if (v.getUint16(o) === 4) sub = o;
  }
  if (sub < 0) throw new Error("a fonte não tem um cmap de formato 4");
  const nSeg = v.getUint16(sub + 6) / 2;
  const fins = sub + 14, inicios = fins + nSeg * 2 + 2, deltas = inicios + nSeg * 2, desvios = deltas + nSeg * 2;
  const glifo = (cp: number): number => {
    for (let i = 0; i < nSeg; i++) {
      if (cp > v.getUint16(fins + i * 2)) continue;
      const ini = v.getUint16(inicios + i * 2);
      if (cp < ini) return 0;
      const d = v.getUint16(desvios + i * 2);
      if (d === 0) return (cp + v.getInt16(deltas + i * 2)) & 0xffff;
      const g = v.getUint16(desvios + i * 2 + d + (cp - ini) * 2);
      return g === 0 ? 0 : (g + v.getInt16(deltas + i * 2)) & 0xffff;
    }
    return 0;
  };
  const avanco = (c: string): number => {
    const g = glifo(c.codePointAt(0)!);
    return v.getUint16(hmtx + Math.min(g, nMetricas - 1) * 4);
  };
  return { unidades, avanco };
}

const fonte = lerFonte(new URL("../assets/fontes/ArchivoExpanded-ExtraBold.ttf", import.meta.url).pathname);

/**
 * A largura de uma corrida de texto a `tamanho` px. Os dígitos são todos o
 * mais largo dos dez: a app usa dígitos tabulares (`tnum`, 782 unidades cada,
 * medidos com o fontTools), que são MAIS estreitos do que qualquer dígito
 * proporcional — por isso é um limite superior, do lado seguro. O
 * espaçamento entre letras (negativo) não se escala com a letra do sistema:
 * escalado só estreitava mais.
 */
function largura(texto: string, tamanho: number, espacamento: number, digitosProporcionais = false): number {
  const maisLargo = Math.max(..."0123456789".split("").map(fonte.avanco));
  const soma = [...texto].reduce((s, c) => s + (/\d/.test(c) && !digitosProporcionais ? maisLargo : fonte.avanco(c)), 0);
  return (soma * tamanho) / fonte.unidades + espacamento * texto.length;
}

/** O que o ecrã faz: a letra do sistema, limitada, e depois o encolhimento até caber. */
function encolhimento(texto: string, m: { tamanho: number; espacamento: number }, letraDoSistema: number, util: number) {
  const escala = Math.min(letraDoSistema, ESCALA_MAX);
  const natural = largura(texto, m.tamanho * escala, m.espacamento);
  const fator = Math.min(1, util / natural);
  return { escala, natural, fator, final: natural * fator, tamanhoFinal: m.tamanho * escala * fator };
}

const T0 = 1_789_000_000_000;
const sessao = createLiveSession("strength", T0, "longa");
const desenhado = (segundos: number) => formatDuration(durationMs(sessao, T0 + segundos * 1000));
/** As quatro durações do brief, lidas do motor com o relógio injetado: 59:59, 1:00:00, 1:03:19, 9:59:59. */
const DURACOES = [59 * 60 + 59, 3600, 3600 + 3 * 60 + 19, 9 * 3600 + 59 * 60 + 59].map(desenhado);

describe("o leitor da fonte reproduz o que o DESIGN.md mediu", () => {
  it("00:00 e 11:11 a 84/800, com dígitos proporcionais: 293,00 e 265,11 px", () => {
    // DESIGN.md §3: "sem tnum seriam 293,00 e 265,11".
    expect(largura("00:00", 84, 0, true)).toBeCloseTo(293.0, 1);
    expect(largura("11:11", 84, 0, true)).toBeCloseTo(265.11, 1);
  });
});

describe("as durações de um treino, tal como o ecrã as desenha", () => {
  it("são as quatro do brief, com a hora a dois dígitos", () => {
    expect(DURACOES).toEqual(["59:59", "01:00:00", "01:03:19", "09:59:59"]);
  });
});

describe.each([
  ["gravação (84 px)", CRONOMETRO.gravacao],
  ["total no resumo e na retoma (72 px)", CRONOMETRO.total],
])("o cronómetro de %s não transborda", (_nome, medida) => {
  // 384: o S24 Ultra (1080 px a 450 dpi). 360: o Android estreito mais comum.
  describe.each([384, 360])("num ecrã de %i dp", (largDoEcra) => {
    const util = larguraUtil(largDoEcra);
    describe.each([1.0, 1.3, 2.0])("com a letra do sistema a %f", (letra) => {
      it.each(DURACOES)("%s cabe: o encolhimento fica dentro do mínimo permitido", (texto) => {
        const e = encolhimento(texto, medida, letra, util);
        // Dentro da caixa...
        expect(e.final).toBeLessThanOrEqual(util + 1e-9);
        // ...sem encolher para lá do que o ecrã deixa (fração do tamanho já escalado).
        expect(e.fator).toBeGreaterThanOrEqual(MINIMO_DO_CRONOMETRO);
      });
    });
  });
});

describe("o que a conta diz, para não se perder", () => {
  const util = larguraUtil(384);
  it("a 1,0 o 59:59 cabe inteiro a 84 px; passada a hora, o cronómetro só cabe encolhendo", () => {
    expect(encolhimento("59:59", CRONOMETRO.gravacao, 1.0, util).fator).toBe(1);
    const hora = encolhimento("01:03:19", CRONOMETRO.gravacao, 1.0, util);
    expect(hora.fator).toBeLessThan(1);
    // A cerca de 80 %: uns 67 px em vez de 84. Legível de relance, mas não é o 84 do desenho.
    expect(hora.tamanhoFinal).toBeGreaterThan(60);
    expect(hora.tamanhoFinal).toBeLessThan(75);
  });

  it("a letra do sistema é limitada a 1,3: a 2,0 o cronómetro é o mesmo que a 1,3", () => {
    const a = encolhimento("01:03:19", CRONOMETRO.gravacao, 1.3, util);
    const b = encolhimento("01:03:19", CRONOMETRO.gravacao, 2.0, util);
    expect(b.escala).toBe(1.3);
    expect(b.tamanhoFinal).toBeCloseTo(a.tamanhoFinal, 6);
  });

  it("uma hora: a letra a 1,3× acaba com o mesmo tamanho que a 1,0, a menos de 2 %", () => {
    // O encolhimento ajusta à LARGURA: quanto maior a letra, mais encolhe. Não
    // fica exatamente igual porque o espaçamento entre letras (negativo) é fixo.
    const um = encolhimento("01:03:19", CRONOMETRO.gravacao, 1.0, util);
    const treze = encolhimento("01:03:19", CRONOMETRO.gravacao, 1.3, util);
    expect(Math.abs(treze.tamanhoFinal / um.tamanhoFinal - 1)).toBeLessThan(0.02);
  });
});
