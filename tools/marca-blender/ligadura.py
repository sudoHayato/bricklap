"""
Sessão 23: a ligadura BL, na grelha de 24 da cadeia do Blender, e a reconstrução do "antes".

Python puro. Usa, sem alterar, o contorno de familias.py e a régua do recorte
de sementes.py. Na sessão 23 viveu fora do repositório; entrou na cadeia na
sessão 24, por decisão do CTO (uma medição que não se reproduz não é uma
medição). `python3 -B tools/marca-blender/ligadura.py` lista as dez.

A ligadura, como está no BACKLOG: o B partilha a haste e o pé do L, a uma cor.
Uma peça só: haste (x 3..3+t, y 3..21), pé (x 3..21, y 21-t..21), a barra de
cima, a do meio e os dois bojos à direita até x = 15, com uma cintura de k na
junção dos bojos. O pé corre 6 unidades para lá dos bojos — é essa ponta que
faz o L. Todos os traços com a mesma espessura t. As contraformas: a de cima
(18 - 3t) // 2 de alto, a de baixo o resto; 12 - 2t de largo.

O "antes" (reconstrução, porque o desenho do CTO não está no repositório): a
P2122 tal como é (haste 5 x 11, pé 17 x 5, junta 2), com um B de traço 2 acima
do pé e com a haste da P como haste do B. Contraformas de 2 e 3 — a conta de
"~2 px" da entrada 4.
"""

import json
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import familias  # noqa: E402
import sementes  # noqa: E402

GRELHA = 24
XB = 15


def arredondar(contorno, raio_de, segmentos=12):
    """O arredondamento do repertorio.py (só cantos convexos), com o raio escolhido canto a canto."""
    n = len(contorno)
    pontos = []
    for k in range(n):
        ax, ay = contorno[k - 1]
        bx, by = contorno[k]
        cx, cy = contorno[(k + 1) % n]
        if (bx - ax) * (cy - by) - (by - ay) * (cx - bx) <= 0:
            pontos.append((bx, by))
            continue
        l1 = math.hypot(bx - ax, by - ay)
        l2 = math.hypot(cx - bx, cy - by)
        r = min(raio_de(bx, by), l1 / 2, l2 / 2)
        d1 = ((bx - ax) / l1, (by - ay) / l1)
        d2 = ((cx - bx) / l2, (cy - by) / l2)
        p1 = (bx - d1[0] * r, by - d1[1] * r)
        p2 = (bx + d2[0] * r, by + d2[1] * r)
        centro = (p1[0] + d2[0] * r, p1[1] + d2[1] * r)
        a1 = math.atan2(p1[1] - centro[1], p1[0] - centro[0])
        a2 = math.atan2(p2[1] - centro[1], p2[0] - centro[0])
        delta = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for s in range(segmentos + 1):
            a = a1 + delta * s / segmentos
            pontos.append((centro[0] + r * math.cos(a), centro[1] + r * math.sin(a)))
    return pontos


def ligadura(t, bojo):
    h = 18 - 3 * t
    h1 = h // 2
    ym = 3 + t + h1
    k = max(1, t // 2)
    somar = [
        (3, 3, 3 + t, 21),
        (3, 21 - t, 21, 21),
        (3, 3, XB, 3 + t),
        (3, ym, XB, ym + t),
        (XB - t, 3, XB, ym + t),
        (XB - t, ym, XB, 21 - t),
    ]
    cortar = [(XB - k, ym, XB, ym + t)]
    contraformas = [(3 + t, 3 + t, XB - t, ym), (3 + t, ym + t, XB - t, 21 - t)]
    grande = 99 if bojo == "redondo" else 1

    def raio_de(x, y):
        return grande if abs(x - XB) < 1e-9 else 1

    return {
        "id": f"BL{t}{'r' if bojo == 'redondo' else 'q'}",
        "familia": "BL",
        "nome": f"ligadura BL · traço {t} · bojo {bojo}",
        "pecas_grelha": [{"nome": "BL", "tom": "B", "somar": somar, "cortar": cortar, "raio_de": raio_de}],
        "contraformas": contraformas,
        "traco": t,
    }


def antes():
    """A P2122 com um B de traço 2 acima do pé, a partilhar a haste."""
    ym = 3 + 2 + 2
    somar_b = [
        (4, 3, 9, 14),  # a haste da P2122
        (9, 3, 17, 5),
        (9, ym, 17, ym + 2),
        (9, 12, 17, 14),
        (15, 3, 17, ym + 2),
        (15, ym, 17, 14),
    ]
    cortar = [(16, ym, 17, ym + 2)]
    return {
        "id": "ANTES",
        "familia": "ANTES",
        "nome": "reconstrução do antes: P2122 com um B de traço 2 acima do pé",
        "pecas_grelha": [
            {"nome": "haste e B", "tom": "B", "somar": somar_b, "cortar": cortar, "raio_de": lambda x, y: 1},
            {"nome": "pé", "tom": "B", "somar": [(4, 16, 21, 21)], "cortar": [], "raio_de": lambda x, y: 1},
        ],
        "contraformas": [(9, 5, 15, ym), (9, ym + 2, 15, 12)],
        "traco": 2,
    }


def construir(v):
    escala = 100 / GRELHA
    finais = []
    for peca in v["pecas_grelha"]:
        contornos = familias.contornar(peca["somar"], peca["cortar"])
        redondos = [arredondar(c, peca["raio_de"]) for c in contornos]
        finais.append(
            {
                "tom": peca["tom"],
                "espessura": familias.espessura_minima(contornos) * escala,
                "contornos": [[(x * escala, (GRELHA - y) * escala) for x, y in c] for c in redondos],
            }
        )
    # o recorte mede-se nos retângulos (a régua de sementes.py), menos o que a cintura corta — que é pouco e só a favor
    perda, _ = sementes.perda_no_circulo([{"somar": p["somar"]} for p in v["pecas_grelha"]], 11)
    return {
        "id": v["id"],
        "familia": v["familia"],
        "nome": v["nome"],
        "pecas": finais,
        "largura": 100.0,
        "altura": 100.0,
        "contraformas": v["contraformas"],
        "traco": v["traco"],
        "recorte": {"perda": perda},
    }


def todas():
    saida = [construir(antes())]
    for t in (2, 3, 4, 5):
        for bojo in ("reto", "redondo"):
            saida.append(construir(ligadura(t, bojo)))
    return saida


def p2122():
    p = {"espessura": 5, "junta": 2, "desencontro": 1, "raio": 1}
    v = sementes._variante("P2122", "P", "L de duas peças", p, dict(p), sementes.pecas_em_l(p), 11)
    v["contraformas"] = []
    v["traco"] = 5
    return v


if __name__ == "__main__":
    for v in [p2122()] + todas():
        cf = " · ".join(f"{x1 - x0:g}×{y1 - y0:g}" for x0, y0, x1, y1 in v["contraformas"]) or "—"
        fina = min(p["espessura"] for p in v["pecas"]) * GRELHA / 100
        print(f"{v['id']:6} traço {v['traco']}  mais fina {fina:4.1f}  contraformas (l×a) {cf:12}  perna cortada {v['recorte']['perda'] * 100:4.1f} %")
