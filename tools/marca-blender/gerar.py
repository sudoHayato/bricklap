"""
Fábrica de silhuetas da marca Bricklap (sessão 18): o render e as medidas.

Corre dentro do Blender, sem interface e sem passos manuais:

    blender -b --factory-startup -noaudio --python-exit-code 1 \\
        -P gerar.py -- --parametros parametros.json --saida <pasta>

Na WSL, com o Blender instalado no Windows, usa-se `gerar.sh`, que encontra o
executável e converte os caminhos. O que faz, de ponta a ponta:

  1. gera as variantes do varrimento de parametros.json (familias.py);
  2. monta a folha de contacto — cada variante a 512, 96, 48 e 24 px lado a
     lado, à escala real, duas tonalidades em cima e uma cor em baixo — e
     renderiza-a numa imagem só;
  3. monta e renderiza a folha só com os 24 px;
  4. mede, nas próprias imagens renderizadas, quantas peças continuam
     separadas a 24, 48 e 96 px, e escreve medidas.json e medidas.md.

É um desenho plano, não uma cena: câmara ortográfica de topo, só materiais de
emissão (sem luzes, sombras, reflexos nem gradientes) e 1 px de imagem = 1
unidade do mundo. A vista é "Raw" e as cores entram já em sRGB: assim o
antisserrilhado das arestas mistura as cores em sRGB, como o Android e os
browsers desenham um vetor, e não em luz linear como um render físico. A 24 px
isto decide se uma junta de 1 px se vê: um píxel meio coberto de preto sobre
branco sai a 128 em sRGB e a 188 em luz linear.
"""

import argparse
import json
import math
import os
import sys
import time
import warnings

import bpy
import numpy as np
from mathutils import geometry

sys.dont_write_bytecode = True  # nada de __pycache__ dentro do repositório
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import familias  # noqa: E402

NOMES = {
    "pecas": "peças",
    "proporcao": "proporção",
    "desencontro": "desencontro",
    "espacamento": "vão",
    "rotacao": "rotação",
    "vazio": "vazio",
    "moldura": "moldura",
    "tom_claro": "claro",
}


# ---------------------------------------------------------------------------
# Blender: cena, materiais, geometria, texto, render
# ---------------------------------------------------------------------------


def hexa_para_srgb(hexa):
    h = hexa.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def _com_nos(datablock):
    if datablock.node_tree is None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            datablock.use_nodes = True
    return datablock.node_tree


def material_de_emissao(nome, hexa):
    material = bpy.data.materials.new(nome)
    arvore = _com_nos(material)
    for no in list(arvore.nodes):
        arvore.nodes.remove(no)
    saida = arvore.nodes.new("ShaderNodeOutputMaterial")
    emissao = arvore.nodes.new("ShaderNodeEmission")
    emissao.inputs["Color"].default_value = (*hexa_para_srgb(hexa), 1.0)
    emissao.inputs["Strength"].default_value = 1.0
    arvore.links.new(emissao.outputs["Emission"], saida.inputs["Surface"])
    return material


def preparar_cena(cores):
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    ciclos = cena.cycles
    ciclos.device = "CPU"
    ciclos.use_adaptive_sampling = False
    ciclos.use_denoising = False
    ciclos.pixel_filter_type = "BOX"  # cobertura exata do píxel, como um rasterizador de vetores
    ciclos.filter_width = 1.0
    ciclos.max_bounces = 0  # só o que a câmara vê diretamente: emissão plana
    ciclos.seed = 0
    cena.render.resolution_percentage = 100
    cena.render.pixel_aspect_x = cena.render.pixel_aspect_y = 1.0
    cena.render.dither_intensity = 0.0  # sem ruído nas cores de 8 bits
    cena.render.film_transparent = False
    cena.render.use_compositing = False
    cena.render.use_sequencer = False
    cena.view_settings.view_transform = "Raw"
    cena.view_settings.look = "None"
    cena.view_settings.exposure = 0.0
    cena.view_settings.gamma = 1.0
    formato = cena.render.image_settings
    formato.file_format = "PNG"
    formato.color_mode = "RGB"
    formato.color_depth = "8"
    formato.compression = 60

    mundo = bpy.data.worlds.new("fundo")
    fundo = next(n for n in _com_nos(mundo).nodes if n.bl_idname == "ShaderNodeBackground")
    fundo.inputs["Color"].default_value = (*hexa_para_srgb(cores["fundo"]), 1.0)
    fundo.inputs["Strength"].default_value = 1.0
    cena.world = mundo

    return {
        "B": material_de_emissao("B", cores["B"]),
        "L": material_de_emissao("L", cores["L"]),
        "K": material_de_emissao("uma_cor", cores["uma_cor"]),
        "texto": material_de_emissao("texto", cores["texto"]),
        "texto2": material_de_emissao("texto2", cores["texto2"]),
    }


def limpar_cena():
    for colecao in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.cameras):
        for item in list(colecao):
            colecao.remove(item)


def malha_plana(nome, poligonos, material, z=0.0):
    """Uma malha com todos os polígonos de um material; cada um é [exterior, *furos].

    `z` separa camadas: fundos por baixo das peças, máscaras por cima. A
    câmara é ortográfica, por isso a altura não muda o tamanho de nada.
    """
    vertices, faces = [], []
    for contornos in poligonos:
        base = len(vertices)
        pontos = [[(x, y, z) for x, y in c] for c in contornos]
        for c in pontos:
            vertices.extend(c)
        faces.extend((base + a, base + b, base + c) for a, b, c in geometry.tessellate_polygon(pontos))
    malha = bpy.data.meshes.new(nome)
    malha.from_pydata(vertices, [], faces)
    malha.materials.append(material)
    objeto = bpy.data.objects.new(nome, malha)
    bpy.context.scene.collection.objects.link(objeto)


def texto(corpo, x, y, tamanho, material, alinhar, z=0.0):
    curva = bpy.data.curves.new("texto", type="FONT")
    curva.body = corpo
    curva.size = tamanho
    curva.align_x = alinhar
    curva.align_y = "TOP"
    curva.materials.append(material)
    objeto = bpy.data.objects.new("texto", curva)
    bpy.context.scene.collection.objects.link(objeto)
    objeto.location = (x, y, z)


def camara(largura, altura):
    dados = bpy.data.cameras.new("camara")
    dados.type = "ORTHO"
    dados.sensor_fit = "HORIZONTAL"
    dados.ortho_scale = largura  # 1 px = 1 unidade
    dados.clip_start = 0.01
    dados.clip_end = 100.0
    objeto = bpy.data.objects.new("camara", dados)
    bpy.context.scene.collection.objects.link(objeto)
    objeto.location = (largura / 2, altura / 2, 10.0)
    bpy.context.scene.camera = objeto


class Folha:
    """Uma imagem: o que se pousa nela, em píxeis com a origem no canto superior esquerdo."""

    def __init__(self, largura, altura):
        self.largura, self.altura = largura, altura
        # (material, z) -> polígonos; a ordem de criação é a de inserção
        self.poligonos = {("B", 0.0): [], ("L", 0.0): [], ("K", 0.0): []}
        self.textos = []
        self.caixas = []

    def pousar(self, v, x, y, n, uma_cor, tons=None, **marcas):
        """A variante `v` numa caixa n × n com o canto em (x, y), centrada, sem ampliar nada.

        `tons` troca o material de cada tom (por omissão B -> "B", L -> "L", e
        tudo -> "K" a uma cor); `marcas` fica na caixa, para as medidas.
        """
        tons = tons or ({"B": "K", "L": "K"} if uma_cor else {"B": "B", "L": "L"})
        escala = n / 100
        dx = math.floor((100 - v["largura"]) / 2 * escala + 0.5)
        dy = math.floor((100 - v["altura"]) / 2 * escala + 0.5)
        for peca in v["pecas"]:
            self.poligonos.setdefault((tons[peca["tom"]], 0.0), []).append(
                [
                    [(x + dx + px * escala, self.altura - (y + dy + (v["altura"] - py) * escala)) for px, py in c]
                    for c in peca["contornos"]
                ]
            )
        self.caixas.append({"id": v["id"], "tamanho": n, "uma_cor": uma_cor, "x": x, "y": y, **marcas})

    def poligono(self, contornos, material, z):
        """Um polígono em píxeis da folha (origem em cima à esquerda): [exterior, *furos]."""
        self.poligonos.setdefault((material, z), []).append(
            [[(px, self.altura - py) for px, py in c] for c in contornos]
        )

    def retangulo(self, x, y, largura, altura, material, z):
        self.poligono([[(x, y), (x + largura, y), (x + largura, y + altura), (x, y + altura)]], material, z)

    def escrever(self, corpo, x, y, tamanho, cor="texto", alinhar="LEFT"):
        self.textos.append((corpo, x, y, tamanho, cor, alinhar))

    def renderizar(self, caminho, amostras, materiais):
        limpar_cena()
        for (tom, z), poligonos in self.poligonos.items():
            if poligonos:
                malha_plana(f"pecas_{tom}_{z}", poligonos, materiais[tom], z)
        for corpo, x, y, tamanho, cor, alinhar in self.textos:
            texto(corpo, x, self.altura - y, tamanho, materiais[cor], alinhar, z=0.2)
        camara(self.largura, self.altura)
        cena = bpy.context.scene
        cena.render.resolution_x = self.largura
        cena.render.resolution_y = self.altura
        cena.cycles.samples = amostras
        cena.render.filepath = caminho
        inicio = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"[marca] {os.path.basename(caminho)}: {self.largura} × {self.altura} px, "
              f"{amostras} amostras, {time.time() - inicio:.1f} s")


# ---------------------------------------------------------------------------
# Folhas
# ---------------------------------------------------------------------------


def _valor(nome, valor):
    if isinstance(valor, bool):
        return "sim" if valor else "não"
    if nome == "rotacao":
        return f"{valor}°"
    if isinstance(valor, float):
        return f"{valor:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return str(valor)


def descricao(v):
    g = v["parametros"]["espacamento"]
    linhas = [f"{NOMES[n]} {_valor(n, valor)}" for n, valor in v["variacao"].items() if n != "espacamento"]
    linhas.append(f"vão {_valor('espacamento', g)} · {_valor('', g * 24 / 100)} px a 24")
    return linhas


def grupos(parametros, todas):
    """[(titulo, [variantes])]: a referência e depois uma linha por família."""
    saida = [("REF · o símbolo atual (docs/marca), para comparar — não é uma variante", [familias.referencia()])]
    for fam in parametros["familias"]:
        saida.append((f"{fam['letra']} · {fam['titulo']}", [v for v in todas if v["familia"] == fam["letra"]]))
    return saida


def folha_de_contacto(linhas, n_variantes):
    """Uma célula por variante: 512 à esquerda; 96, 48 e 24 à direita, duas tonalidades por cima da uma cor."""
    margem, celula_l, cabeca, linha_a = 48, 848, 190, 660
    colunas = max(len(vs) for _, vs in linhas)
    folha = Folha(margem * 2 + (colunas - 1) * celula_l + 792, cabeca + len(linhas) * linha_a + margem)
    folha.escrever("Bricklap — fábrica de silhuetas (sessão 18)", margem, 40, 46)
    folha.escrever(
        f"{n_variantes} variantes e a referência. Cada linha é uma família; cada coluna, a mesma combinação "
        "dos três eixos da família (111 a 222).",
        margem,
        104,
        24,
        "texto2",
    )
    folha.escrever(
        "Em cada variante: 512 px à esquerda; à direita 96, 48 e 24 px, em cima a duas tonalidades e em "
        "baixo a uma cor. Tudo à escala real, nada ampliado.",
        margem,
        140,
        24,
        "texto2",
    )
    for r, (titulo, vs) in enumerate(linhas):
        y0 = cabeca + r * linha_a
        folha.escrever(titulo, margem, y0 + 12, 28)
        for c, v in enumerate(vs):
            x, y = margem + c * celula_l, y0 + 56
            folha.pousar(v, x + 24, y + 16, 512, False)
            dx = x + 24 + 512 + 40
            for fila, uma_cor in ((y + 16, False), (y + 140, True)):
                folha.pousar(v, dx, fila, 96, uma_cor)
                folha.pousar(v, dx + 120, fila + 24, 48, uma_cor)
                folha.pousar(v, dx + 192, fila + 36, 24, uma_cor)
            folha.escrever(v["id"], x + 24, y + 16 + 512 + 14, 36)
            folha.escrever("\n".join(descricao(v)), dx, y + 272, 19, "texto2")
    return folha


def folha_24(parametros, linhas, n_variantes):
    """Só os 24 px, pequena de propósito: cabe num ecrã a 100 %, e é assim que se tem de ver."""
    margem, rotulo, celula_l, cabeca, linha_a = 16, 104, 84, 62, 64
    colunas = max(len(vs) for _, vs in linhas)
    folha = Folha(margem * 2 + rotulo + colunas * celula_l, cabeca + len(linhas) * linha_a + 8)
    folha.escrever(f"Bricklap · {n_variantes} variantes a 24 px, à escala real — ver a 100 %, sem ampliar", margem, 12, 16)
    folha.escrever("Em cada par: duas tonalidades à esquerda, uma cor à direita.", margem, 36, 13, "texto2")
    nomes = {fam["letra"]: fam["titulo"].split(" — ")[0] for fam in parametros["familias"]}
    for r, (_, vs) in enumerate(linhas):
        y0 = cabeca + r * linha_a
        letra = vs[0]["familia"]
        folha.escrever("REF atual" if letra == "REF" else f"{letra}  {nomes[letra]}", margem, y0 + 16, 13)
        for c, v in enumerate(vs):
            x = margem + rotulo + c * celula_l
            folha.pousar(v, x, y0 + 8, 24, False)
            folha.pousar(v, x + 32, y0 + 8, 24, True)
            folha.escrever(v["id"], x + 28, y0 + 8 + 24 + 7, 12, alinhar="CENTER")
    return folha


# ---------------------------------------------------------------------------
# Medidas nas imagens renderizadas
# ---------------------------------------------------------------------------


def ler_png(caminho):
    imagem = bpy.data.images.load(caminho, check_existing=False)
    imagem.colorspace_settings.name = "Non-Color"  # os bytes do ficheiro, sem conversões
    largura, altura = imagem.size
    buffer = np.empty(largura * altura * 4, dtype=np.float32)
    imagem.pixels.foreach_get(buffer)
    bpy.data.images.remove(imagem)
    return np.rint(buffer.reshape(altura, largura, 4)[::-1, :, :3] * 255).astype(np.float64)


def componentes(rotulos):
    """Regiões 8-conexas de píxeis com o mesmo rótulo (0 = fundo)."""
    altura, largura = rotulos.shape
    visto = np.zeros(rotulos.shape, dtype=bool)
    n = 0
    for y in range(altura):
        for x in range(largura):
            if rotulos[y, x] and not visto[y, x]:
                n += 1
                pilha = [(y, x)]
                visto[y, x] = True
                while pilha:
                    cy, cx = pilha.pop()
                    for ny in (cy - 1, cy, cy + 1):
                        for nx in (cx - 1, cx, cx + 1):
                            if (
                                0 <= ny < altura
                                and 0 <= nx < largura
                                and not visto[ny, nx]
                                and rotulos[ny, nx] == rotulos[cy, cx]
                            ):
                                visto[ny, nx] = True
                                pilha.append((ny, nx))
    return n


# Uma junta conta como aberta quando algum píxel dela deixa ver o fundo pelo
# menos em metade ("vê-se") ou em três quartos ("limpa"). A metade é generosa:
# qualquer vão a partir de 1 px a cumpre, esteja a junta onde estiver na grelha
# de píxeis. Os três quartos só se cumprem sempre a partir de 1,5 px.
LIMIARES = {"ve_se": 0.5, "limpa": 0.25}  # cobertura de tinta a partir da qual o píxel fecha a junta


def medir_uma_cor(recorte):
    """Peças separadas a uma cor, com a junta a ver-se e com a junta limpa."""
    tinta = 1 - recorte[:, :, 0] / 255
    return {nome: componentes((tinta >= limiar).astype(np.int8)) for nome, limiar in LIMIARES.items()}


def medir_duas(recorte, cores):
    """Peças separadas a duas tonalidades, e os píxeis limpos de cada tom.

    Cada píxel decompõe-se em cobertura de B e de L sobre o fundo (a mistura é
    em sRGB, como no render) e fica com o tom que mais o cobre: duas peças de
    tons diferentes separam-se pela cor; duas do mesmo tom só por uma junta.
    """
    fundo = np.array(hexa_para_srgb(cores["fundo"])) * 255
    base = np.stack(
        [np.array(hexa_para_srgb(cores["B"])) * 255 - fundo, np.array(hexa_para_srgb(cores["L"])) * 255 - fundo],
        axis=1,
    )
    alvo = (recorte.reshape(-1, 3) - fundo).T
    cobertura = np.linalg.lstsq(base, alvo, rcond=None)[0]
    b = cobertura[0].reshape(recorte.shape[:2])
    l_ = cobertura[1].reshape(recorte.shape[:2])
    tom = np.where(b >= l_, 1, 2)
    medida = {nome: componentes(np.where(b + l_ >= limiar, tom, 0).astype(np.int8)) for nome, limiar in LIMIARES.items()}
    medida["L_limpo"] = int(np.sum(l_ >= 0.9))
    medida["B_limpo"] = int(np.sum(b >= 0.9))
    return medida


def medir(folhas, variantes_por_id, cores):
    """`folhas` é [(imagem, folha, tamanhos)]: cada tamanho mede-se numa folha só."""
    medidas = {ident: {} for ident in variantes_por_id}
    for imagem, folha, tamanhos in folhas:
        for caixa in folha.caixas:
            n = caixa["tamanho"]
            if n not in tamanhos:
                continue
            recorte = imagem[caixa["y"] : caixa["y"] + n, caixa["x"] : caixa["x"] + n]
            m = medidas[caixa["id"]].setdefault(str(n), {})
            if caixa["uma_cor"]:
                m["uma_cor"] = medir_uma_cor(recorte)
            else:
                m["duas"] = medir_duas(recorte, cores)
    saida = []
    for ident, v in variantes_por_id.items():
        saida.append(
            {
                "id": ident,
                "familia": v["familia"],
                "nome": v["nome"],
                "variacao": v["variacao"],
                "pecas": len(v["pecas"]),
                "tons": "".join(p["tom"] for p in v["pecas"]),
                "espacamento": v["parametros"]["espacamento"],
                "vao_px_24": round(v["parametros"]["espacamento"] * 24 / 100, 2),
                "peca_mais_fina_px_24": round(min(p["espessura"] for p in v["pecas"]) * 24 / 100, 2),
                "medidas": medidas[ident],
            }
        )
    return saida


def tabela_md(medidas):
    """Uma linha por variante. "k/n": k peças separadas das n que a variante tem."""
    linhas = [
        "| id | variação | peças | vão a 24 | peça mais fina a 24 | a 24, duas tons (vê-se · limpa) "
        "| a 24, uma cor (vê-se · limpa) | a 48, uma cor limpa | L limpo a 24 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for m in medidas:
        variacao = ", ".join(f"{NOMES[n]} {_valor(n, v)}" for n, v in m["variacao"].items()) or "—"
        me, n = m["medidas"], m["pecas"]
        linhas.append(
            f"| {m['id']} | {variacao} | {n} | {_valor('', m['vao_px_24'])} px "
            f"| {_valor('', m['peca_mais_fina_px_24'])} px "
            f"| {me['24']['duas']['ve_se']}/{n} · {me['24']['duas']['limpa']}/{n} "
            f"| {me['24']['uma_cor']['ve_se']}/{n} · {me['24']['uma_cor']['limpa']}/{n} "
            f"| {me['48']['uma_cor']['limpa']}/{n} | {me['24']['duas']['L_limpo']} |"
        )
    return "\n".join(linhas) + "\n"


# ---------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = argparse.ArgumentParser(prog="gerar.py")
    args.add_argument("--parametros", required=True)
    args.add_argument("--saida", required=True)
    opcoes = args.parse_args(argv)

    with open(opcoes.parametros, encoding="utf-8") as f:
        parametros = json.load(f)
    os.makedirs(opcoes.saida, exist_ok=True)
    cores = parametros["cores"]

    inicio = time.time()
    todas = familias.variantes(parametros)
    linhas = grupos(parametros, todas)
    print(f"[marca] {len(todas)} variantes geradas em {time.time() - inicio:.2f} s")

    materiais = preparar_cena(cores)
    contacto = folha_de_contacto(linhas, len(todas))
    vinte_e_quatro = folha_24(parametros, linhas, len(todas))

    caminho_contacto = os.path.join(opcoes.saida, "folha-de-contacto.png")
    caminho_24 = os.path.join(opcoes.saida, "folha-24px.png")
    vinte_e_quatro.renderizar(caminho_24, parametros["amostras"]["folha_24"], materiais)
    contacto.renderizar(caminho_contacto, parametros["amostras"]["folha"], materiais)

    # a 24 px mede-se na folha dos 24, que leva mais amostras; a 48 e 96 na de contacto
    por_id = {v["id"]: v for _, vs in linhas for v in vs}
    medidas = medir(
        [(ler_png(caminho_24), vinte_e_quatro, {24}), (ler_png(caminho_contacto), contacto, {48, 96})],
        por_id,
        cores,
    )
    with open(os.path.join(opcoes.saida, "medidas.json"), "w", encoding="utf-8") as f:
        json.dump(medidas, f, ensure_ascii=False, indent=1)
    with open(os.path.join(opcoes.saida, "medidas.md"), "w", encoding="utf-8") as f:
        f.write(tabela_md(medidas))
    print(f"[marca] pronto em {time.time() - inicio:.1f} s: {opcoes.saida}")


# O Blender corre um script com -P como "__main__"; a sessão 19 importa este
# ficheiro para lhe reutilizar a cena, a folha e as medidas, sem o correr.
if __name__ == "__main__":
    main()
