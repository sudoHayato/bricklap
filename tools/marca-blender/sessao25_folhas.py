"""
Sessão 25: as folhas de contacto e a tabela das duas famílias afinadas.

    python3 -B tools/marca-blender/sessao25_folhas.py <pasta-das-formas>

Lê formas.json, semelhanca-relativa.json, mascaras/ e medicao/ (a saída do
sessao25.sh), e as leituras humanas de leituras-sessao-25.json, ao lado deste
script. Reutiliza o sessao24_folhas.py para os recortes dos renders e para a
verificação de fidelidade; nada é redesenhado aqui.

Os critérios, por ordem:
  1. semelhança **relativa** (sessao25_semelhanca.py): sinaliza-se quando o
     excesso sobre uma marca passa a margem calibrada (0,20). O corte absoluto de
     0,40 da sessão 24 está suspenso por decisão do CTO;
  2. legível a 24 px: nenhuma junta cola e nenhuma contraforma fecha, nos dois
     temas, e a leitura não se perde;
  3. recorte circular: perda da forma ≤ 25 %, e a leitura sobrevive;
  4. uma cor;
  5. lista negra, **alargada por decisão do CTO na sessão 25** com o visto, o
     cadeado e o sinal de wi-fi;
  6. as duas perguntas: que forma é? que letra ou ideia é?
  Reportado, não elimina: o desfoque (±25 % da P2122), o traço e o vão mínimos, e
  na GI o índice de torção.
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import sessao24_folhas as F  # noqa: E402

TEMAS = F.TEMAS
f, num, pct = F.f, F.num, F.pct


def carregar(pasta):
    med = os.path.join(pasta, "medicao")
    ler = lambda c: json.load(open(c, encoding="utf-8"))  # noqa: E731
    formas = {v["id"]: v for v in ler(os.path.join(pasta, "formas.json"))["variantes"]}
    semelhanca = ler(os.path.join(pasta, "semelhanca-relativa.json"))
    medidas = ler(os.path.join(med, "medidas.json"))
    caixas = ler(os.path.join(med, "caixas.json"))
    caminho = os.path.join(AQUI, "leituras-sessao-25.json")
    leituras = ler(caminho)["leituras"] if os.path.exists(caminho) else {}
    imagens = {n: Image.open(os.path.join(med, f"{n}.png")).convert("RGB") for n in ("folha-24px", "folha-medicao", "folha-recorte", "folha-desfoque")}
    cores = ler(os.path.join(AQUI, "parametros-sessao-19b.json"))["cores"]
    return formas, semelhanca, medidas, caixas, leituras, imagens, cores


def veredicto(ident, semelhanca, medidas, leituras):
    m = medidas[ident]
    lei = leituras.get(ident, {})
    motivos = []
    s = semelhanca.get(ident)
    if s and s["sinalizada"]:
        motivos.append(f"semelhança: excesso {num(s['excesso'], 3)} sobre {s['nome_da_marca']}")
    perdas = m["perdas"]["24"]
    coladas = any(perdas[t]["pecas_coladas"] for t in TEMAS)
    fechadas = max(perdas[t]["furos_fechados"] for t in TEMAS)
    if coladas or fechadas:
        partes = (["junta colada"] if coladas else []) + ([f"{fechadas} contraforma fechada" + ("s" if fechadas > 1 else "")] if fechadas else [])
        motivos.append("24 px: " + " e ".join(partes))
    if lei.get("lembra"):
        motivos.append(f"lembra {lei['lembra']}")
    if lei.get("perde_24"):
        motivos.append("24 px: " + lei["perde_24"])
    if m["recorte"]["perda"] > 0.25 or lei.get("perde_recorte"):
        motivos.append("recorte" + (f": {lei['perde_recorte']}" if lei.get("perde_recorte") else ""))
    if lei.get("lista_negra"):
        motivos.append(f"lista negra: {lei['lista_negra']}")
    if lei and not lei.get("passa_leitura", False):
        motivos.append("leitura")
    if not lei and ident != "P2122":
        motivos.append("leitura por fazer")
    return motivos


def linha_de_numeros(fo, me, s):
    partes = []
    if fo:
        partes.append(f"traço mín {num(fo['traco_minimo'], 2) if fo.get('traco_minimo') else '—'} · vão mín {num(fo['vao_minimo'], 2) if fo.get('vao_minimo') else '—'}")
        if fo.get("torcao"):
            partes.append(f"torção {num(fo['torcao']['indice'], 2)} ({num(fo['torcao']['minima'], 2)}–{num(fo['torcao']['maxima'], 2)})")
    if s:
        partes.append(f"excesso {num(s['excesso'], 3)} sobre {s['nome_da_marca']} (sem {num(s['semelhanca'], 3)}, controlo {num(s['controlo'], 3)})")
    return " · ".join(partes)


def folha_contacto(ids, formas, semelhanca, medidas, leituras, imagens, caixas, destino):
    colunas, cw, ch, m, cab = 5, 300, 200, 24, 96
    linhas = math.ceil(len(ids) / colunas)
    folha = Image.new("RGB", (m * 2 + colunas * cw, cab + linhas * ch + m), (255, 255, 255))
    d = ImageDraw.Draw(folha)
    d.text((m, 18), "Bricklap · sessão 25 · duas famílias afinadas · 73 e 24 px, uma cor, sobre o creme e o escuro", font=f(18, True), fill=(22, 18, 15))
    d.text((m, 48), "GI: a fita com espessura, para não partir a 24 px. AR: juntas de 2 ou 2,5 unidades, fecho e pés-direitos. LZ e P2122 para comparar.", font=f(13), fill=(90, 82, 75))
    d.text((m, 68), "Verde: passa tudo · vermelho: o primeiro motivo que a elimina. A semelhança é a régua relativa (margem 0,20); nenhuma foi sinalizada.", font=f(13), fill=(90, 82, 75))
    for i, ident in enumerate(ids):
        x, y = m + (i % colunas) * cw, cab + (i // colunas) * ch
        folha.paste(F.recorte(imagens, caixas, "folha-medicao", ident, 73, "creme"), (x, y))
        folha.paste(F.recorte(imagens, caixas, "folha-medicao", ident, 73, "escuro"), (x + 78, y))
        folha.paste(F.recorte(imagens, caixas, "folha-24px", ident, 24, "creme"), (x + 158, y))
        folha.paste(F.recorte(imagens, caixas, "folha-24px", ident, 24, "escuro"), (x + 186, y))
        folha.paste(F.recorte(imagens, caixas, "folha-24px", ident, 24, "creme").resize((72, 72), Image.NEAREST), (x + 214, y))
        motivos = veredicto(ident, semelhanca, medidas, leituras)
        cor = (60, 60, 60) if ident == "P2122" else ((170, 30, 30) if motivos else (20, 130, 60))
        d.text((x, y + 82), ident, font=f(15, True), fill=cor)
        d.text((x + 64, y + 84), formas[ident]["conceito"] if ident in formas else "âncora", font=f(11), fill=(90, 82, 75))
        lei = leituras.get(ident, {})
        if lei:
            d.text((x, y + 104), f"{lei['forma']}"[:44], font=f(11), fill=(22, 18, 15))
            d.text((x, y + 120), f"{lei['ideia']}"[:44], font=f(11), fill=(90, 82, 75))
        texto = "âncora" if ident == "P2122" else (motivos[0] if motivos else "passa")
        d.text((x, y + 142), texto[:46], font=f(11, not motivos), fill=cor)
        if len(motivos) > 1:
            d.text((x, y + 158), ("+ " + "; ".join(motivos[1:]))[:46], font=f(10), fill=(120, 110, 100))
    folha.save(destino)


def folhas_revisao(ids, formas, semelhanca, medidas, leituras, imagens, caixas, pasta_saida):
    por_folha, caminhos = 12, []
    for n in range(math.ceil(len(ids) / por_folha)):
        grupo = ids[n * por_folha : (n + 1) * por_folha]
        m, cab, lh, largura = 20, 60, 176, 1560
        folha = Image.new("RGB", (largura, cab + len(grupo) * lh + m), (255, 255, 255))
        d = ImageDraw.Draw(folha)
        d.text((m, 16), f"Sessão 25 · revisão {n + 1} · 73 · 48 · 24 creme e escuro (100 %) · 24 ×6 · recorte (creme, escuro, campo) · desfoque ×3", font=f(15, True), fill=(22, 18, 15))
        for r, ident in enumerate(grupo):
            y, x = cab + r * lh, m
            d.line([(m, y - 6), (largura - m, y - 6)], fill=(225, 220, 214))
            folha.paste(F.recorte(imagens, caixas, "folha-medicao", ident, 73, "creme"), (x, y))
            folha.paste(F.recorte(imagens, caixas, "folha-medicao", ident, 48, "creme"), (x + 80, y + 12))
            for j, tema in enumerate(TEMAS):
                folha.paste(F.recorte(imagens, caixas, "folha-24px", ident, 24, tema), (x + 136 + j * 30, y + 24))
                folha.paste(F.recorte(imagens, caixas, "folha-24px", ident, 24, tema).resize((144, 144), Image.NEAREST), (x + 200 + j * 152, y))
            for j, im in enumerate(F.recortes_do_icone(imagens, caixas, ident)):
                folha.paste(im.resize((90, 90), Image.LANCZOS), (x + 510 + j * 96, y))
            des = next(c for c in caixas["folha-desfoque"] if c["id"] == ident)
            folha.paste(imagens["folha-desfoque"].crop((des["x"] + 64, des["y"], des["x"] + 136, des["y"] + 72)), (x + 806, y))
            tx, me, fo, s = x + 890, medidas[ident], formas.get(ident), semelhanca.get(ident)
            d.text((tx, y), f"{ident} · {me['conceito'] or 'âncora: a P2122'}", font=f(14, True), fill=(22, 18, 15))
            d.text((tx, y + 20), (fo["nome"].split(" · ", 1)[-1] if fo else "L de duas peças")[:84], font=f(11), fill=(90, 82, 75))
            d.text((tx, y + 38), linha_de_numeros(fo, me, s)[:110], font=f(11), fill=(22, 18, 15))
            p24 = " · ".join(f"{me['medidas']['24'][t]['pecas']}p {me['medidas']['24'][t]['furos']}f" for t in TEMAS)
            d.text((tx, y + 56), f"24 px: {p24} (a forma tem {me['pecas_n']}p {me['furos_n']}f)", font=f(11), fill=(22, 18, 15))
            ds = me["desfoque"]
            d.text((tx, y + 74), f"recorte {num(me['recorte']['perda'] * 100, 1)} % · peso {num(ds['peso'])} · mancha {num(ds['mancha'])}{' · destoa' if ds['destoa'] else ''}", font=f(11), fill=(22, 18, 15))
            lei = leituras.get(ident)
            if lei:
                d.text((tx, y + 94), f"forma: {lei['forma']}"[:96], font=f(11), fill=(22, 18, 15))
                d.text((tx, y + 110), f"letra/ideia: {lei['ideia']}"[:96], font=f(11), fill=(22, 18, 15))
            motivos = veredicto(ident, semelhanca, medidas, leituras)
            if ident != "P2122":
                texto = "passa" if not motivos else "chumba: " + "; ".join(motivos)
                d.text((tx, y + 130), texto[:96], font=f(11, True), fill=(170, 30, 30) if motivos else (20, 130, 60))
                if len(texto) > 96:
                    d.text((tx, y + 146), texto[96:192], font=f(11, True), fill=(170, 30, 30))
        caminho = os.path.join(pasta_saida, f"folha-revisao-{n + 1}.png")
        folha.save(caminho)
        caminhos.append(caminho)
    return caminhos


def tabela(ids, formas, semelhanca, medidas, leituras, destino):
    linhas = [
        "| id | família | variação | traço mín | vão mín | torção | semelhança relativa: excesso (marca) | sinalizada | 24 px: peças · furos (creme / escuro; a forma) | recorte | uma cor | lista negra | que forma é? | que letra ou ideia? | desfoque: peso · mancha | veredicto |",
        "|---|---|---|---:|---:|---:|---|:---:|---|---:|:---:|---|---|---|---|---|",
    ]
    for ident in ids:
        me, fo, lei = medidas[ident], formas.get(ident, {}), leituras.get(ident, {})
        s = semelhanca.get(ident)
        p24 = " / ".join(f"{me['medidas']['24'][t]['pecas']} · {me['medidas']['24'][t]['furos']}" for t in TEMAS)
        ds = me["desfoque"]
        motivos = veredicto(ident, semelhanca, medidas, leituras)
        ver = "âncora" if ident == "P2122" else ("**passa**" if not motivos else "chumba: " + "; ".join(motivos))
        linhas.append(
            f"| {ident} | {fo.get('familia', '—')} | {fo.get('nome', 'L de duas peças').split(' · ', 1)[-1]} "
            f"| {num(fo['traco_minimo'], 2) if fo.get('traco_minimo') else '—'} | {num(fo['vao_minimo'], 2) if fo.get('vao_minimo') else '—'} "
            f"| {num(fo['torcao']['indice'], 2) if fo.get('torcao') else '—'} "
            f"| {num(s['excesso'], 3) + ' (' + s['nome_da_marca'] + ', sem ' + num(s['semelhanca'], 3) + ')' if s else '—'} | {'sim' if s and s['sinalizada'] else 'não'} "
            f"| {p24}; {me['pecas_n']} · {me['furos_n']} | {num(me['recorte']['perda'] * 100, 1)} % | sim | {lei.get('lista_negra') or '—'} "
            f"| {lei.get('forma', '—')} | {lei.get('ideia', '—')} "
            f"| {num(ds['peso'])} ({pct(ds['peso'] / medidas['P2122']['desfoque']['peso'] - 1)}) · {num(ds['mancha'])} ({pct(ds['mancha'] / medidas['P2122']['desfoque']['mancha'] - 1)}) | {ver} |"
        )
    open(destino, "w", encoding="utf-8").write("\n".join(linhas) + "\n")


def main():
    pasta = sys.argv[1]
    formas, semelhanca, medidas, caixas, leituras, imagens, cores = carregar(pasta)
    ids = ["P2122"] + list(formas)
    med = os.path.join(pasta, "medicao")
    fid = F.fidelidade(pasta, caixas, imagens, cores)
    json.dump(fid, open(os.path.join(med, "fidelidade.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    pior = max(fid.values(), key=lambda v: v["diferenca_maxima"])
    print(f"fidelidade: pior diferença {pior['diferenca_maxima']}, píxeis acima de 0,5: {sum(v['pixeis_acima_de_meio'] for v in fid.values())}")
    folha_contacto(ids, formas, semelhanca, medidas, leituras, imagens, caixas, os.path.join(med, "folha-contacto.png"))
    for c in folhas_revisao(ids, formas, semelhanca, medidas, leituras, imagens, caixas, med):
        print(c)
    tabela(ids, formas, semelhanca, medidas, leituras, os.path.join(med, "medidas.md"))
    passam = [i for i in formas if not veredicto(i, semelhanca, medidas, leituras)]
    print(f"passam: {len(passam)} de {len(formas)}", passam)


if __name__ == "__main__":
    main()
