#!/usr/bin/env bash
# Fábrica de silhuetas da marca Bricklap: um comando, de ponta a ponta.
#
#   tools/marca-blender/gerar.sh [pasta-de-saída]                # sessão 18
#   tools/marca-blender/gerar.sh --sessao 19 [pasta-de-saída]    # sessão 19
#   tools/marca-blender/gerar.sh --sessao 19b [pasta-de-saída]   # sessão 19b
#
# Sessão 18: folha-de-contacto.png, folha-24px.png, medidas.json e medidas.md.
# Sessão 19: folha-24px.png, folha-medicao.png, folha-73px-aprovadas.png,
# folha-recorte-aprovadas.png, medidas.json e medidas.md; lê as leituras
# humanas de leituras-sessao-19.json.
# Sessão 19b: as mesmas folhas, mais folha-desfoque.png e folha-contraste.png,
# e contraste.md; lê as leituras de leituras-sessao-19b.json. A pasta de
# saída fica fora do repositório por omissão — as imagens não entram no git.
#
# Na WSL usa o Blender instalado no Windows (o mais recente de "Program Files")
# e passa-lhe todos os caminhos pelo `wslpath -w`. O Blender é um processo
# Windows e não entende /home/...; o `wslpath -w` dá o caminho UNC
# \\wsl.localhost\<distribuição>\..., que o Windows lê e escreve através do
# servidor de ficheiros da WSL. Assim o Blender lê o script e os parâmetros e
# grava as imagens diretamente na pasta da WSL, sem cópias de ida e volta.
#
# BLENDER=/caminho/para/blender força outro executável (num Linux nativo, um
# blender sem .exe recebe os caminhos tal como estão).
set -euo pipefail

aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="gerar.py"
parametros="parametros.json"
extra=()
if [[ "${1:-}" == "--sessao" ]]; then
  case "${2:-}" in
    19 | 19b) sessao="$2" ;;
    *)
      echo "Sessões com gerador: 18 (por omissão), 19 e 19b." >&2
      exit 2
      ;;
  esac
  script="sessao${sessao}.py"
  parametros="parametros-sessao-${sessao}.json"
  extra=(--leituras "leituras-sessao-${sessao}.json")
  shift 2
fi
saida="${1:-${TMPDIR:-/tmp}/bricklap-marca-blender}"
mkdir -p "$saida"
saida="$(cd "$saida" && pwd)"

if [[ -z "${BLENDER:-}" ]]; then
  BLENDER="$(ls -1d /mnt/c/Program\ Files/Blender\ Foundation/Blender\ */blender.exe 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -z "$BLENDER" ]]; then
    BLENDER="$(command -v blender || true)"
  fi
fi
if [[ -z "$BLENDER" ]]; then
  echo "Não encontrei o Blender. Indica-o com BLENDER=/caminho/para/blender." >&2
  exit 1
fi

caminho() {
  if [[ "$BLENDER" == *.exe ]]; then wslpath -w "$1"; else printf '%s' "$1"; fi
}

echo "$("$BLENDER" --version | head -n 1) — $BLENDER"
# -b sem interface; --factory-startup ignora as preferências e extensões de quem
# o tiver instalado; --python-exit-code 1 faz um erro no script falhar o comando.
if [[ ${#extra[@]} -gt 0 ]]; then
  extra=("${extra[0]}" "$(caminho "$aqui/${extra[1]}")")
fi
"$BLENDER" -b --factory-startup -noaudio --python-exit-code 1 \
  -P "$(caminho "$aqui/$script")" -- \
  --parametros "$(caminho "$aqui/$parametros")" \
  --saida "$(caminho "$saida")" "${extra[@]}"
echo "Saída em $saida"
