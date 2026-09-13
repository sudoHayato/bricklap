import { describe, expect, it } from "vitest";
import { MARCA_B, MARCA_L, coresDoLogotipo } from "../ui/coresDoLogotipo";

describe("cores do logótipo (regra do fundador, sessão 15)", () => {
  it("sem cores pedidas sai a duas tonalidades: o B e o L, distintos", () => {
    // O defeito da sessão 15: o cabeçalho chamava <Logotipo tamanho={26} /> e
    // saía a uma cor, porque o L caía no B.
    expect(coresDoLogotipo()).toEqual({ b: "#C0402C", l: "#E89478" });
    expect(MARCA_B).not.toBe(MARCA_L);
  });

  it("a uma cor só quando quem chama a pede (constrangimento técnico)", () => {
    expect(coresDoLogotipo("#FFFFFF")).toEqual({ b: "#FFFFFF", l: "#FFFFFF" });
  });

  it("respeita as duas cores quando as duas são pedidas", () => {
    expect(coresDoLogotipo("#16120F", "#6B625B")).toEqual({ b: "#16120F", l: "#6B625B" });
    expect(coresDoLogotipo(undefined, "#6B625B")).toEqual({ b: MARCA_B, l: "#6B625B" });
  });
});
