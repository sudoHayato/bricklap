"""
Sessão 24: os símbolos das marcas do mesmo espaço, prontos para a semelhança.

    python3 -B tools/marca-blender/sessao24_marcas.py <pasta-fora-do-git>

Lê marcas-sessao-24.json, descarrega cada ficheiro para <pasta>/fontes/ (se
ainda lá não estiver), desenha-o a preto sobre branco, recorta a caixa do
símbolo e grava <pasta>/<id>.png, que o semelhanca.silhueta_do_logotipo lê tal
como leu o favicon do Replit na sessão 19. Grava também <pasta>/marcas.png,
para confirmar a olho que cada recorte é o símbolo certo.

Os logótipos são de quem os registou: não entram no repositório.
Depende do cairosvg para os SVG (Python da WSL, não da app).
"""

import io
import json
import os
import sys
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
LADO = 1024


def fonte(url, pasta):
    nome = urllib.parse.unquote(url.rsplit("/", 1)[-1]).replace(" ", "_")
    caminho = os.path.join(pasta, "fontes", nome)
    if not os.path.exists(caminho):
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        pedido = urllib.request.Request(url, headers={"User-Agent": "bricklap-marca/1.0 (comparação de silhuetas)"})
        with urllib.request.urlopen(pedido) as r, open(caminho, "wb") as f:
            f.write(r.read())
    return caminho


def desenhar(caminho):
    """RGBA -> máscara de tinta (True onde há marca), com o critério do semelhanca.py."""
    if caminho.endswith(".svg"):
        import cairosvg

        imagem = Image.open(io.BytesIO(cairosvg.svg2png(url=caminho, output_width=LADO))).convert("RGBA")
    else:
        imagem = Image.open(caminho).convert("RGBA")
    rgba = np.asarray(imagem).astype(int)
    return ~((rgba[:, :, :3].min(axis=2) > 200) | (rgba[:, :, 3] < 128))


def main():
    pasta = sys.argv[1]
    with open(os.path.join(AQUI, "marcas-sessao-24.json"), encoding="utf-8") as f:
        marcas = json.load(f)["marcas"]
    fichas = []
    for m in marcas:
        tinta = desenhar(fonte(m["url"], pasta))
        if "caixa" in m:
            alto, largo = tinta.shape
            x0, y0, x1, y1 = m["caixa"]
            tinta = tinta[round(y0 * alto) : round(y1 * alto), round(x0 * largo) : round(x1 * largo)]
        ys, xs = np.nonzero(tinta)
        tinta = tinta[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
        tinta = np.pad(tinta, 8)
        Image.fromarray(np.where(tinta, 0, 255).astype(np.uint8)).save(os.path.join(pasta, f"{m['id']}.png"))
        fichas.append((m, tinta))
        print(f"{m['id']:18} {tinta.shape[1]:5} × {tinta.shape[0]:<5} {m['marca']} — {m['simbolo']}")

    texto = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    colunas, lado = 6, 200
    folha = Image.new("RGB", (colunas * (lado + 20) + 20, ((len(fichas) + colunas - 1) // colunas) * (lado + 50) + 20), (255, 255, 255))
    d = ImageDraw.Draw(folha)
    for i, (m, tinta) in enumerate(fichas):
        x, y = 20 + (i % colunas) * (lado + 20), 20 + (i // colunas) * (lado + 50)
        im = Image.fromarray(np.where(tinta, 0, 255).astype(np.uint8))
        im.thumbnail((lado, lado))
        folha.paste(im, (x, y))
        d.text((x, y + lado + 6), m["id"], font=texto, fill=(0, 0, 0))
    folha.save(os.path.join(pasta, "marcas.png"))


if __name__ == "__main__":
    main()
