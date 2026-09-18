"""Descarrega exportações do Canva (nome=url), confirma que são PNG, mede as cores e faz uma tira de pré-visualização.

    python3 tools/marca-blender/sessao23_baixar.py <pasta> <tira.png> nome=url [nome=url ...]

Os URL são os das exportações do Canva (export-design) e expiram; as imagens
ficam fora do git.
"""
import sys
import urllib.request
from collections import Counter

import numpy as np
from PIL import Image

pasta, tira = sys.argv[1], sys.argv[2]
imagens = []
for par in sys.argv[3:]:
    nome, url = par.split("=", 1)
    caminho = f"{pasta}/{nome}.png"
    urllib.request.urlretrieve(url, caminho)
    try:
        im = Image.open(caminho).convert("RGB")
    except Exception:
        print(nome, "FALHOU:", open(caminho, "rb").read(200))
        continue
    a = np.array(im).reshape(-1, 3)
    c = Counter(map(tuple, a))
    print(nome, im.size, [("#%02X%02X%02X" % k, v) for k, v in c.most_common(3)], "distintas", len(c))
    imagens.append((nome, im))

folha = Image.new("RGB", (len(imagens) * 522, 512), (128, 128, 128))
for k, (_, im) in enumerate(imagens):
    folha.paste(im.resize((512, 512)), (k * 522, 0))
folha.save(tira)
