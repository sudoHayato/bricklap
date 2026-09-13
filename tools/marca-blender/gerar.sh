#!/usr/bin/env bash
# Fábrica de silhuetas da marca Bricklap (sessão 18): um comando, de ponta a ponta.
#
#   tools/marca-blender/gerar.sh [pasta-de-saída]
#
# Sai: folha-de-contacto.png, folha-24px.png, medidas.json e medidas.md. A pasta
# de saída fica fora do repositório por omissão — as imagens não entram no git.
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
"$BLENDER" -b --factory-startup -noaudio --python-exit-code 1 \
  -P "$(caminho "$aqui/gerar.py")" -- \
  --parametros "$(caminho "$aqui/parametros.json")" \
  --saida "$(caminho "$saida")"
echo "Saída em $saida"
