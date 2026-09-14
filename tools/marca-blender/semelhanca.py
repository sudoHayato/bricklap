"""
Semelhança de silhueta entre as variantes da sessão 19 e um logótipo de fora.

    python3 -B tools/marca-blender/semelhanca.py <logotipo.png> [parametros-sessao-19.json]

O logótipo não vive no repositório: passa-se o caminho de um PNG descarregado
(na sessão 19, o favicon público de replit.com). A medida:

  1. cada silhueta a uma cor — as juntas e os furos contam como fundo;
  2. recortada à caixa da tinta e encaixada, pela maior dimensão e centrada,
     num quadrado de 96 × 96 (desenhada a 4× e reduzida pela média da área);
  3. a interseção sobre a união (IoU) com a do logótipo, na melhor das oito
     rotações e simetrias da variante.

1 é a mesma silhueta; duas formas sem nada em comum ficam perto de 0.
"""

import json
import os
import statistics
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sementes  # noqa: E402

LADO = 96
SUPER = 4


def encaixar(tinta):
    """Máscara booleana -> 96 × 96, recortada à tinta, pela maior dimensão, centrada."""
    ys, xs = np.nonzero(tinta)
    tinta = tinta[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    alto, largo = tinta.shape
    escala = LADO / max(alto, largo)
    novo = (max(1, round(largo * escala)), max(1, round(alto * escala)))
    reduzida = Image.fromarray((tinta * 255).astype(np.uint8)).resize(novo, Image.BOX)
    tela = Image.new("L", (LADO, LADO), 0)
    tela.paste(reduzida, ((LADO - novo[0]) // 2, (LADO - novo[1]) // 2))
    return np.asarray(tela) >= 128


def silhueta_do_logotipo(caminho):
    imagem = Image.open(caminho).convert("RGBA")
    rgba = np.asarray(imagem).astype(int)
    fundo_claro = (rgba[:, :, :3].min(axis=2) > 200) | (rgba[:, :, 3] < 128)
    return encaixar(~fundo_claro)


def silhueta_da_variante(v):
    n = 100 * SUPER
    tela = Image.new("L", (n, n), 0)
    desenho = ImageDraw.Draw(tela)
    escala = n / 100
    for peca in v["pecas"]:
        pontos = lambda c: [(x * escala, (100 - y) * escala) for x, y in c]  # noqa: E731
        desenho.polygon(pontos(peca["contornos"][0]), fill=255)
        for furo in peca["contornos"][1:]:
            desenho.polygon(pontos(furo), fill=0)
    return encaixar(np.asarray(tela) >= 128)


def iou(a, b):
    return np.logical_and(a, b).sum() / np.logical_or(a, b).sum()


def melhor_iou(silhueta, alvo):
    melhor = 0.0
    for espelho in (False, True):
        s = np.fliplr(silhueta) if espelho else silhueta
        for k in range(4):
            melhor = max(melhor, iou(encaixar(np.rot90(s, k)), alvo))
    return melhor


def main():
    logotipo = sys.argv[1]
    parametros = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "parametros-sessao-19.json")
    with open(parametros, encoding="utf-8") as f:
        p = json.load(f)
    alvo = silhueta_do_logotipo(logotipo)
    refs = sementes.referencias(p["recorte"]["raio_na_grelha"])
    todas = sementes.variantes(p)
    print("referências (melhor IoU com o logótipo):")
    for v in refs:
        print(f"  {v['id']:4} {v['nome']:18} {melhor_iou(silhueta_da_variante(v), alvo):.3f}")
    print("famílias: semente (1111), mediana, mínimo, máximo")
    for fam in p["familias"]:
        valores = {v["id"]: melhor_iou(silhueta_da_variante(v), alvo) for v in todas if v["familia"] == fam["letra"]}
        topo = max(valores, key=valores.get)
        print(
            f"  {fam['letra']} ({fam['semente']}) {valores[fam['letra'] + '1111']:.3f}  "
            f"{statistics.median(valores.values()):.3f}  {min(valores.values()):.3f}  "
            f"{valores[topo]:.3f} ({topo})"
        )


if __name__ == "__main__":
    main()
