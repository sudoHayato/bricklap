"""
Sessão 24: semelhança de silhueta de cada variante com as marcas do mesmo espaço.

    python3 -B tools/marca-blender/sessao24_semelhanca.py <pasta-das-formas> <pasta-dos-simbolos>

A medida é a da sessão 19 (semelhanca.py, sem alterar): a silhueta a uma cor,
recortada à tinta, encaixada pela maior dimensão num quadrado de 96 × 96, e a
interseção sobre a união (IoU) com a do símbolo, na melhor das oito rotações e
simetrias. Com a inclinação agora legal, as oito poses deixam passar uma cópia
rodada 30°; por isso mede-se também a melhor de 48 poses (rotações de 15 em 15°,
com e sem espelho), que contém as oito. **Elimina-se pela maior das duas.**

Limiares do brief: acima de 0,40 elimina-se; entre 0,30 e 0,40 apresenta-se com
o número e o nome da marca.

Grava <pasta-das-formas>/semelhanca.json e imprime a tabela. Calibra a régua com
a P2122, um disco e um quadrado cheios, e as marcas umas contra as outras; e dá,
para cada variante, a mesma medida contra um disco e um quadrado cheios
("cheio") — um diagnóstico, que não elimina nem salva nada: quando a semelhança
com uma marca não passa da semelhança com uma forma cheia qualquer, o número
está a medir o enchimento da silhueta, não a parecença com essa marca.
"""

import json
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import semelhanca  # noqa: E402

ELIMINA, AVISA = 0.40, 0.30
AQUI = os.path.dirname(os.path.abspath(__file__))


def reduzir(mascara, lado=384):
    ys, xs = np.nonzero(mascara)
    m = mascara[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    escala = lado / max(m.shape)
    novo = (max(1, round(m.shape[1] * escala)), max(1, round(m.shape[0] * escala)))
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(novo, Image.BOX)) >= 128


def poses(mascara):
    """[(nome, silhueta 96 × 96)]: as 8 da sessão 19 primeiro, depois as rotações de 15°."""
    m = reduzir(mascara)
    saida = []
    for espelho in (False, True):
        s = np.fliplr(m) if espelho else m
        for k in range(4):
            saida.append((f"{'e' if espelho else ''}{90 * k}", semelhanca.encaixar(np.rot90(s, k)), True))
    for espelho in (False, True):
        s = np.fliplr(m) if espelho else m
        imagem = Image.fromarray((np.pad(s, 8) * 255).astype(np.uint8))
        for graus in range(15, 360, 15):
            if graus % 90 == 0:
                continue
            rodada = np.asarray(imagem.rotate(graus, resample=Image.BILINEAR, expand=True)) >= 128
            saida.append((f"{'e' if espelho else ''}{graus}", semelhanca.encaixar(rodada), False))
    return saida


def comparar(mascara, alvos):
    """{id da marca: (iou 8 poses, iou 48 poses, pose)}."""
    ps = poses(mascara)
    saida = {}
    for ident, alvo in alvos.items():
        melhor8, melhor48, pose = 0.0, 0.0, ""
        for nome, s, das_oito in ps:
            v = float(semelhanca.iou(s, alvo))
            if das_oito:
                melhor8 = max(melhor8, v)
            if v > melhor48:
                melhor48, pose = v, nome
        saida[ident] = (melhor8, melhor48, pose)
    return saida


def main():
    formas, simbolos = sys.argv[1], sys.argv[2]
    with open(os.path.join(AQUI, "marcas-sessao-24.json"), encoding="utf-8") as f:
        marcas = {m["id"]: m for m in json.load(f)["marcas"]}
    alvos = {i: semelhanca.silhueta_do_logotipo(os.path.join(simbolos, f"{i}.png")) for i in marcas}
    with open(os.path.join(formas, "formas-sessao-24.json"), encoding="utf-8") as f:
        ids = [v["id"] for v in json.load(f)["variantes"]]

    def mascara(ident):
        return np.asarray(Image.open(os.path.join(formas, "mascaras", f"{ident}.png")).convert("L")) >= 128

    lado = 400
    c = (np.arange(lado) + 0.5) - lado / 2
    x, y = np.meshgrid(c, c)
    calibra = {"disco cheio": x**2 + y**2 <= (lado / 2) ** 2, "quadrado cheio": np.ones((lado, lado), dtype=bool)}
    cheios = {nome: semelhanca.encaixar(m) for nome, m in calibra.items()}

    resultado = {}
    for ident in ["P2122"] + ids:
        r = comparar(mascara(ident), alvos)
        cheio = max(v[1] for v in comparar(mascara(ident), cheios).values())
        topo = max(r, key=lambda k: max(r[k][0], r[k][1]))
        valor = max(r[topo][0], r[topo][1])
        estado = "elimina" if valor > ELIMINA else ("apresenta com o número" if valor >= AVISA else "passa")
        resultado[ident] = {
            "por_marca": {k: {"iou_8": round(a, 3), "iou_48": round(b, 3), "pose": p} for k, (a, b, p) in r.items()},
            "maxima": round(valor, 3),
            "marca": marcas[topo]["marca"],
            "simbolo": marcas[topo]["simbolo"],
            "estado": estado,
            "cheio": round(cheio, 3),
        }
        print(f"{ident:6} {valor:.3f}  {marcas[topo]['marca']:13} ({topo}, 8 poses {r[topo][0]:.3f}, pose {r[topo][2]})  {estado}")

    # calibração da régua
    for nome, m in calibra.items():
        r = comparar(m, alvos)
        topo = max(r, key=lambda k: r[k][1])
        resultado[f"calibração: {nome}"] = {"maxima": round(r[topo][1], 3), "marca": marcas[topo]["marca"], "simbolo": marcas[topo]["simbolo"]}
        print(f"calibração {nome:15} {r[topo][1]:.3f} {topo}")
    entre = []
    for a in alvos:
        r = comparar(alvos[a], {b: alvos[b] for b in alvos if marcas[b]["marca"] != marcas[a]["marca"]})
        topo = max(r, key=lambda k: r[k][1])
        entre.append((r[topo][1], a, topo))
    entre.sort(reverse=True)
    resultado["calibração: marcas entre si"] = [{"a": a, "b": b, "iou_48": round(v, 3)} for v, a, b in entre]
    for v, a, b in entre[:5]:
        print(f"entre marcas  {a:18} ~ {b:18} {v:.3f}")
    with open(os.path.join(formas, "semelhanca.json"), "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
