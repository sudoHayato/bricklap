"""
Sessão 25: afinar duas famílias da 24 — GI (volta torcida) e AR (arco de tijolos) —
variando só o que as matava, com a LZ11 e a LZ12 (a P2122 inclinada) para comparar.

    python3 -B tools/marca-blender/sessao25_formas.py <pasta>

Grava <pasta>/formas.json (o formato que o sessao24.py lê) e <pasta>/mascaras/.
Usa, sem alterar, a construção do sessao24_formas.py: a tela de 1200 × 1200, o
encaixe em 18 unidades, a máscara sem ligações só em diagonal, os contornos.

O que matava cada família na 24, e o que se varia:

  GI — a fita de Möbius era uma superfície sem espessura: onde fica de perfil, a
  silhueta desce a zero e o anel parte-se a 24 px. Aqui a fita é um sólido de
  secção retangular (largura b, espessura e): de perfil, a silhueta nunca desce
  abaixo de e. Varia-se o grau de torção (meia volta, 180°, e volta inteira,
  360°), a largura b, a espessura e e a câmara (a da 24, guinada 30° e arfagem
  25°, e uma mais alta, 30° e 40°, que abre a volta).

  AR — as juntas eram de 0,9 unidades, escolha minha, e colavam; e o semicírculo
  aos segmentos lia-se indicador de carregamento. Aqui as juntas têm 2 ou 2,5
  unidades (a 19 mediu que 2 cai em píxeis inteiros a 24 px), e o arco tem 3 ou 5
  aduelas, com o traço (a espessura do anel) tão grosso quanto deixa a aduela
  mais estreita manter 2 unidades por dentro, até 4,5. Varia-se ainda o fecho
  (liso ou saliente — a pedra de fecho é o que faz de um arco um arco de
  alvenaria) e os pés-direitos (sem, ou um tijolo de cada lado, que tiram o
  semicírculo do mostrador e o põem de pé).

As medidas de construção, em unidades da grelha de 24, na forma já encaixada:
  - traço mínimo: o menor diâmetro de um disco cuja abertura morfológica muda a
    topologia (parte uma peça ou abre um furo) — a parte mais fina da tinta;
  - vão mínimo: o menor diâmetro cujo fecho muda a topologia (cola duas peças ou
    fecha um furo) — a junta ou a contraforma mais estreita;
  - na GI, o índice de torção: a largura mínima da fita sobre a máxima, medida em
    raios a partir do centro do furo (1 = anel regular, sem torção à vista;
    perto de 0 = a fita fica de perfil, a torção vê-se).
"""

import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import sessao24_formas as F  # noqa: E402

R = F.R

# ---------------------------------------------------------------------------
# GI — a fita sólida
# ---------------------------------------------------------------------------

TROCA = np.array([[1, 0, 0], [0, 0, 1], [0, 1, 0]])  # a volta deitada, como na 24


def fita(meias_voltas, b, e, raio=10.0, n=240):
    pontos = []
    for k in range(n + 1):
        u = 2 * math.pi * k / n
        radial = np.array([math.cos(u), math.sin(u), 0.0])
        cima = np.array([0.0, 0.0, 1.0])
        a = meias_voltas * u / 2
        largura = math.cos(a) * radial + math.sin(a) * cima
        normal = -math.sin(a) * radial + math.cos(a) * cima
        centro = raio * radial
        pontos.append([centro + s * b / 2 * largura + t * e / 2 * normal for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    v = np.array([p for quatro in pontos for p in quatro])
    faces = [(4 * k + j, 4 * k + (j + 1) % 4, 4 * k + (j + 1) % 4 + 4, 4 * k + j + 4) for k in range(n) for j in range(4)]
    return v, faces


def gi(variacao):
    torcao, b, e, camara = variacao
    return F.projetar([fita(torcao // 180, b, e)], F.matriz(*camara, 0) @ TROCA)


# ---------------------------------------------------------------------------
# AR — o arco de tijolos com juntas de verdade
# ---------------------------------------------------------------------------

RAIO_FORA = 9.0
FECHO = 1.5
PE_DIREITO = 3.0
TRACO_MAX = 4.5


def traco_do_arco(aduelas, junta):
    """O anel mais grosso em que a aduela mais estreita ainda tem 2 unidades no intradorso."""
    raio_dentro = ((aduelas - 1) * junta + 2 * aduelas) / math.pi
    return min(TRACO_MAX, RAIO_FORA - raio_dentro)


def ar(variacao):
    aduelas, pes, fecho, junta = variacao
    traco = traco_do_arco(aduelas, junta)
    r0, r1 = RAIO_FORA - traco, RAIO_FORA
    ops = []
    for k in range(aduelas):
        a0, a1 = 180 * k / aduelas, 180 * (k + 1) / aduelas
        fora = r1 + (FECHO if fecho == "saliente" and k == aduelas // 2 else 0)
        ops.append(F.tinta(F.setor(0, 0, r0, fora, a0, a1)))
    for k in range(1, aduelas):
        a = math.radians(180 * k / aduelas)
        ops.append(F.traco([(0, 0), (1.5 * r1 * math.cos(a), -1.5 * r1 * math.sin(a))], junta, "retas", cor=False))
    if pes:
        for x in (-r1, r0):
            ops.append(F.tinta([(x, junta), (x + traco, junta), (x + traco, junta + PE_DIREITO), (x, junta + PE_DIREITO)]))
    # o arco assenta na linha y = 0 (a linha das impostas)
    ops.append(F.fundo([(-r1 - 2, 0.0001), (r1 + 2, 0.0001), (r1 + 2, junta - 0.0001), (-r1 - 2, junta - 0.0001)]))
    return ops


# ---------------------------------------------------------------------------
# Medidas de construção
# ---------------------------------------------------------------------------


def topologia(m):
    n_tinta, _ = cv2.connectedComponents(m.astype(np.uint8), connectivity=8)
    n_fundo, _ = cv2.connectedComponents((~m).astype(np.uint8), connectivity=4)
    return n_tinta - 1, n_fundo - 2


def _dist(m):
    return cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)


def abertura(m, raio_px):
    nucleo = _dist(m) >= raio_px
    return _dist(~nucleo) < raio_px


def fecho(m, raio_px):
    return ~abertura(~m, raio_px)


def primeiro_diametro(m, operacao, passo=0.05, maximo=8.0):
    base = topologia(m)
    d = passo
    while d <= maximo:
        if topologia(operacao(m, d * R / 2)) != base:
            return round(d, 2)
        d += passo
    return None


def indice_de_torcao(m):
    """Largura da tinta ao longo de raios a partir do centro do maior furo: mínima sobre máxima."""
    fundo = (~m).astype(np.uint8)
    n, rotulos, estat, centros = cv2.connectedComponentsWithStats(fundo, connectivity=4)
    furos = [i for i in range(1, n) if not (estat[i, cv2.CC_STAT_LEFT] == 0 or estat[i, cv2.CC_STAT_TOP] == 0 or estat[i, cv2.CC_STAT_LEFT] + estat[i, cv2.CC_STAT_WIDTH] == m.shape[1] or estat[i, cv2.CC_STAT_TOP] + estat[i, cv2.CC_STAT_HEIGHT] == m.shape[0])]
    if not furos:
        return None
    maior = max(furos, key=lambda i: estat[i, cv2.CC_STAT_AREA])
    cx, cy = centros[maior]
    larguras = []
    for ang in np.linspace(0, 2 * math.pi, 360, endpoint=False):
        dx, dy = math.cos(ang), math.sin(ang)
        tinta = 0
        for t in np.arange(0, m.shape[0], 1.0):
            x, y = int(cx + dx * t), int(cy + dy * t)
            if not (0 <= x < m.shape[1] and 0 <= y < m.shape[0]):
                break
            tinta += m[y, x]
        larguras.append(tinta / R)
    return {"minima": round(min(larguras), 2), "maxima": round(max(larguras), 2), "indice": round(min(larguras) / max(larguras), 2)}


# ---------------------------------------------------------------------------

FAMILIAS = [
    # GI: 2 × 2 × 2 × 2 = 16
    ("GI", "volta torcida", "geométrica abstrata", "silhueta de 3D, curva, peça única", gi,
     [("torção", [180, 360]), ("largura", [5.0, 7.0]), ("espessura", [2.4, 3.2]), ("câmara", [(30, 25), (30, 40)])]),
    # AR: 2 × 2 × 2 × 2 = 16
    ("AR", "arco de tijolos", "espaço negativo / dupla leitura", "curva", ar,
     [("aduelas", [3, 5]), ("pés-direitos", [False, True]), ("fecho", ["liso", "saliente"]), ("junta", [2.0, 2.5])]),
]


def variantes():
    saida = []
    for codigo, nome, categoria, novas, funcao, eixos in FAMILIAS:
        valores = [[]]
        for _, vs in eixos:
            valores = [v + [i] for v in valores for i in range(len(vs))]
        for indices in valores:
            variacao = tuple(eixos[k][1][i] for k, i in enumerate(indices))
            ident = codigo + "".join(str(i + 1) for i in indices)
            mascara = F.bem_composta(F.encaixar(funcao(variacao)))
            pecas, furos = F.contar(mascara)
            descricao = " · ".join(f"{eixos[k][0]} {F_valor(eixos[k][1][i])}" for k, i in enumerate(indices))
            v = {"id": ident, "familia": codigo, "nome": f"{nome} · {descricao}", "conceito": nome, "categoria": categoria, "novas": novas, "ronda": 1, "pecas_n": pecas, "furos_n": furos, "mascara": mascara}
            if codigo == "AR":
                v["traco_do_arco"] = round(traco_do_arco(variacao[0], variacao[3]), 2)
            saida.append(v)
    # a comparação: a P2122 inclinada, tal como na 24
    for ident, junta, graus in (("LZ11", "reta", 8), ("LZ12", "reta", 16)):
        mascara = F.bem_composta(F.encaixar(F.lz((junta, graus))))
        pecas, furos = F.contar(mascara)
        saida.append({"id": ident, "familia": "LZ", "nome": f"a P2122 em itálico · junta {junta} · inclinação {graus}", "conceito": "a P2122 em itálico", "categoria": "letra + metáfora", "novas": "inclinação", "ronda": 1, "pecas_n": pecas, "furos_n": furos, "mascara": mascara})
    return saida


def F_valor(v):
    if isinstance(v, bool):
        return "sim" if v else "não"
    if isinstance(v, tuple):
        return f"{v[0]}°/{v[1]}°"
    if isinstance(v, float):
        return f"{v:g}".replace(".", ",")
    return str(v)


def main():
    pasta = sys.argv[1]
    os.makedirs(os.path.join(pasta, "mascaras"), exist_ok=True)
    lista = []
    for v in variantes():
        mascara = v.pop("mascara")
        Image.fromarray((mascara * 255).astype(np.uint8)).save(os.path.join(pasta, "mascaras", f"{v['id']}.png"), optimize=True)
        v["traco_minimo"] = primeiro_diametro(mascara, abertura)
        v["vao_minimo"] = primeiro_diametro(mascara, fecho)
        if v["familia"] == "GI":
            v["torcao"] = indice_de_torcao(mascara)
        v.update({"pecas": F.contornos(mascara), "largura": 100.0, "altura": 100.0, "contraformas": [], "traco": None, "recorte": {"perda": F.perda_no_circulo(mascara)}})
        lista.append(v)
        extra = f"  torção {v['torcao']}" if v.get("torcao") else ""
        print(f"{v['id']:7} peças {v['pecas_n']} furos {v['furos_n']}  traço mín {v['traco_minimo']}  vão mín {v['vao_minimo']}  recorte {v['recorte']['perda'] * 100:4.1f} %{extra}  {v['nome']}")
    _, ancora = F.p2122_mascara()
    Image.fromarray((ancora * 255).astype(np.uint8)).save(os.path.join(pasta, "mascaras", "P2122.png"), optimize=True)
    print(f"P2122 traço mín {primeiro_diametro(ancora, abertura)}  vão mín {primeiro_diametro(ancora, fecho)}")
    with open(os.path.join(pasta, "formas.json"), "w", encoding="utf-8") as f:
        json.dump({"p2122_perda_forma": F.perda_no_circulo(ancora), "variantes": lista}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
