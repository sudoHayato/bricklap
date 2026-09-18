"""
Sessão 25: a régua de semelhança relativa, calibrada só com marcas, e aplicada às variantes.

    python3 -B tools/marca-blender/sessao25_semelhanca.py calibrar <pasta-dos-simbolos> <saida.json>
    python3 -B tools/marca-blender/sessao25_semelhanca.py medir <pasta-das-formas> <pasta-dos-simbolos> <calibracao.json>

Porque existe. Na sessão 24, a régua absoluta (IoU da silhueta encaixada numa
caixa, corte a 0,40) eliminava a P2122 (0,475), um disco cheio (0,686) e seis
pares de marcas reais umas contra as outras (Garmin contra Zwift, 0,659): media o
enchimento da silhueta, não a cópia. O CTO suspendeu o corte (brief da 25).

A régua nova. Para uma silhueta X e uma marca M, com a medida da sessão 19
(semelhanca.py, sem alterar) na melhor de 48 poses (a da 24):

    controlo(X) = max(sem(X, disco cheio), sem(X, quadrado cheio))
    excesso(X, M) = sem(X, M) - controlo(X)

Sinaliza-se X quando o excesso sobre alguma marca passa a margem. Uma variante que
se parece tanto com um disco como com o Garmin não é cópia do Garmin.

A margem calibra-se sem ver nenhuma variante ("calibrar"):
  - negativos: cada marca contra cada marca de outra empresa — formas que toda a
    gente aceita como diferentes; o excesso delas é a coincidência;
  - positivos: cópias adaptadas de cada marca — rodada 20°, engrossada e afinada
    (2 % do lado), esticada 20 % na horizontal, arredondada (desfoque e corte),
    e as três primeiras juntas; é o que "adaptar uma marca" quer dizer e o que a
    régua tem de apanhar.
A margem escolhida é **0,20**, e a regra que a dá está em `margem_da_calibracao`:
o maior excesso entre marcas diferentes, arredondado para cima à centésima,
**tirando os pares que são a mesma forma primitiva** — só um par, o triângulo
cheio da Garmin e o da Vercel (0,319 e 0,301), que são a mesma silhueta e que a
régua deve apanhar. O maior negativo que sobra é a palavra da Garmin contra o
swoosh da Nike, 0,195 → margem 0,20. Com ela, das cópias adaptadas de marcas
não compactas apanham-se 92 de 115 (80 %); com 0,15 seriam 98, mas passavam a ser
sinalizados cinco pares de marcas diferentes, e com 0,10 dez.

O limite que nenhuma margem resolve: nas marcas **compactas** (controlo ≥ 0,6 —
Apple, Beats, Linear, Mastercard, Pinterest, Reddit, Slack, Spotify, Target,
Telegram, Zwift), uma cópia parece-se tanto com um disco como com a marca, e a
régua apanha no máximo 40 de 66 cópias (com 0,08) e 13 com 0,20. **Para essas,
o crivo é a leitura humana.** Uma cópia adaptada que já não se sobrepõe à marca
em metade (semelhança < 0,5) não conta como cópia (a palavra da Garmin afinada
desaparece).

"medir" grava <pasta-das-formas>/semelhanca-relativa.json. A leitura humana
continua a ser o crivo que decide: foi ela, não a métrica, que apanhou a Beats by
Dre na sessão 24 (o b num círculo só aparece no campo do ícone).
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import semelhanca  # noqa: E402
import sessao24_semelhanca as s24  # noqa: E402

LISTA = "marcas-sessao-25.json"


def carregar_marcas(pasta):
    with open(os.path.join(AQUI, LISTA), encoding="utf-8") as f:
        marcas = {m["id"]: m for m in json.load(f)["marcas"]}
    return marcas, {i: semelhanca.silhueta_do_logotipo(os.path.join(pasta, f"{i}.png")) for i in marcas}


def controlos():
    lado = 400
    c = (np.arange(lado) + 0.5) - lado / 2
    x, y = np.meshgrid(c, c)
    return {"disco": semelhanca.encaixar(x**2 + y**2 <= (lado / 2) ** 2), "quadrado": semelhanca.encaixar(np.ones((lado, lado), dtype=bool))}


def mascara_grande(silhueta, lado=384):
    """A silhueta de 96 × 96 da marca volta a uma tela maior, para as adaptações terem resolução."""
    im = Image.fromarray((silhueta * 255).astype(np.uint8)).resize((lado, lado), Image.BILINEAR)
    return np.asarray(im) >= 128


def adaptacoes(m):
    """As cópias adaptadas de uma marca (máscara booleana quadrada)."""
    lado = m.shape[0]
    im = Image.fromarray((np.pad(m, lado // 8) * 255).astype(np.uint8))
    r = max(1, round(0.02 * lado))

    def binaria(i):
        return np.asarray(i) >= 128

    rodada = binaria(im.rotate(20, resample=Image.BILINEAR, expand=True))
    grossa = binaria(im.filter(ImageFilter.MaxFilter(2 * r + 1)))
    fina = binaria(im.filter(ImageFilter.MinFilter(2 * r + 1)))
    esticada = binaria(im.resize((round(im.width * 1.2), im.height), Image.BILINEAR))
    redonda = binaria(im.filter(ImageFilter.GaussianBlur(0.04 * lado)))
    junta = Image.fromarray((grossa * 255).astype(np.uint8)).rotate(20, resample=Image.BILINEAR, expand=True)
    junta = binaria(junta.resize((round(junta.width * 1.2), junta.height), Image.BILINEAR))
    saida = {"rodada 20°": rodada, "engrossada": grossa, "afinada": fina, "esticada 20 %": esticada, "arredondada": redonda, "engrossada, rodada e esticada": junta}
    return {k: v for k, v in saida.items() if v.any()}


def excesso_maximo(silhueta, alvos, ctrl_alvos, excluir=()):
    r = s24.comparar(silhueta, {k: v for k, v in alvos.items() if k not in excluir})
    controlo = max(v[1] for v in s24.comparar(silhueta, ctrl_alvos).values())
    por_marca = {k: (v[1], v[1] - controlo) for k, v in r.items()}
    topo = max(por_marca, key=lambda k: por_marca[k][1])
    return controlo, por_marca, topo


MESMA_PRIMITIVA = {frozenset(("garmin-triangulo", "vercel"))}
COMPACTA = 0.6


def margem_da_calibracao(negativos):
    fora = [n["excesso"] for n in negativos if frozenset((n["marca"], n["mais_proxima"])) not in MESMA_PRIMITIVA]
    return math.ceil(round(max(fora), 3) * 100) / 100


def calibrar(simbolos, destino):
    marcas, alvos = carregar_marcas(simbolos)
    ctrl = controlos()
    negativos, positivos = [], []
    for a, sil in alvos.items():
        outras = [b for b in alvos if marcas[b]["marca"] == marcas[a]["marca"]]
        controlo, por_marca, topo = excesso_maximo(mascara_grande(sil), alvos, ctrl, excluir=outras)
        negativos.append({"marca": a, "controlo": round(controlo, 3), "mais_proxima": topo, "semelhanca": round(por_marca[topo][0], 3), "excesso": round(por_marca[topo][1], 3)})
        for nome, copia in adaptacoes(mascara_grande(sil)).items():
            c2, pm2, _ = excesso_maximo(copia, {a: sil}, ctrl)
            positivos.append({"marca": a, "adaptacao": nome, "controlo": round(c2, 3), "semelhanca": round(pm2[a][0], 3), "excesso": round(pm2[a][1], 3)})
        print(f"{a:18} controlo {controlo:.3f}  mais próxima {topo:18} sem {por_marca[topo][0]:.3f} excesso {por_marca[topo][1]:+.3f}  | cópias: " + " ".join(f"{p['excesso']:+.2f}" for p in positivos if p["marca"] == a))
    margem = margem_da_calibracao(negativos)
    controlo_da_marca = {n["marca"]: n["controlo"] for n in negativos}
    validos = [p for p in positivos if p["semelhanca"] >= 0.5]
    tabela = []
    for m in (0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25):
        linha = {
            "margem": m,
            "pares_de_marcas_diferentes_sinalizados": [f"{n['marca']}~{n['mais_proxima']}" for n in negativos if n["excesso"] > m],
            "copias_apanhadas_nao_compactas": [sum(p["excesso"] > m for p in validos if controlo_da_marca[p["marca"]] < COMPACTA), sum(controlo_da_marca[p["marca"]] < COMPACTA for p in validos)],
            "copias_apanhadas_compactas": [sum(p["excesso"] > m for p in validos if controlo_da_marca[p["marca"]] >= COMPACTA), sum(controlo_da_marca[p["marca"]] >= COMPACTA for p in validos)],
        }
        tabela.append(linha)
        print(f"margem {m:.2f}: pares sinalizados {len(linha['pares_de_marcas_diferentes_sinalizados'])}; cópias não compactas {linha['copias_apanhadas_nao_compactas']}; compactas {linha['copias_apanhadas_compactas']}")
    resultado = {
        "margem": margem,
        "mesma_primitiva": [sorted(p) for p in MESMA_PRIMITIVA],
        "marcas_compactas": sorted(k for k, v in controlo_da_marca.items() if v >= COMPACTA),
        "margens_comparadas": tabela,
        "negativos": sorted(negativos, key=lambda n: -n["excesso"]),
        "positivos": sorted(positivos, key=lambda p: p["excesso"]),
    }
    print(f"margem escolhida: {margem:.2f}")
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=1)


def medir(formas, simbolos, calibracao):
    marcas, alvos = carregar_marcas(simbolos)
    ctrl = controlos()
    with open(calibracao, encoding="utf-8") as f:
        margem = json.load(f)["margem"]
    with open(os.path.join(formas, "formas.json"), encoding="utf-8") as f:
        ids = [v["id"] for v in json.load(f)["variantes"]]
    resultado = {"margem": margem}
    for ident in ids:
        m = np.asarray(Image.open(os.path.join(formas, "mascaras", f"{ident}.png")).convert("L")) >= 128
        controlo, por_marca, topo = excesso_maximo(m, alvos, ctrl)
        absoluta = max(por_marca, key=lambda k: por_marca[k][0])
        resultado[ident] = {
            "controlo": round(controlo, 3),
            "marca_do_excesso": topo,
            "nome_da_marca": marcas[topo]["marca"],
            "semelhanca": round(por_marca[topo][0], 3),
            "excesso": round(por_marca[topo][1], 3),
            "sinalizada": por_marca[topo][1] > margem,
            "absoluta_maxima": round(por_marca[absoluta][0], 3),
            "absoluta_marca": marcas[absoluta]["marca"],
            "por_marca": {k: {"semelhanca": round(a, 3), "excesso": round(b, 3)} for k, (a, b) in por_marca.items()},
        }
        r = resultado[ident]
        print(f"{ident:6} controlo {r['controlo']:.3f}  excesso {r['excesso']:+.3f} ({r['nome_da_marca']}, sem {r['semelhanca']:.3f})  {'SINALIZADA' if r['sinalizada'] else ''}  | absoluta {r['absoluta_maxima']:.3f} {r['absoluta_marca']}")
    with open(os.path.join(formas, "semelhanca-relativa.json"), "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    if sys.argv[1] == "calibrar":
        calibrar(sys.argv[2], sys.argv[3])
    else:
        medir(sys.argv[2], sys.argv[3], sys.argv[4])
