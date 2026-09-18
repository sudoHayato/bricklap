#!/usr/bin/env bash
# Sessão 23: a ligadura BL, o "antes", a P2122 e os dois controlos do Canva, na
# cadeia calibrada. Corre sessao23.py no Blender como o gerar.sh (ver lá porque
# os caminhos passam pelo wslpath -w).
#
#   tools/marca-blender/sessao23.sh [pasta-de-saída]
#
# Folhas: folha-24px, folha-medicao, folha-recorte, folha-desfoque; tabelas em
# medidas.md e medidas.json; caixas.json para o sessao23_folhas.py.
set -euo pipefail
aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
saida="${1:-${TMPDIR:-/tmp}/bricklap-marca-sessao-23}"
mkdir -p "$saida"
saida="$(cd "$saida" && pwd)"
if [[ -z "${BLENDER:-}" ]]; then
  BLENDER="$(ls -1d /mnt/c/Program\ Files/Blender\ Foundation/Blender\ */blender.exe 2>/dev/null | sort -V | tail -n 1 || true)"
  [[ -n "$BLENDER" ]] || BLENDER="$(command -v blender || true)"
fi
[[ -n "$BLENDER" ]] || { echo "Não encontrei o Blender. Indica-o com BLENDER=/caminho/para/blender." >&2; exit 1; }
caminho() { if [[ "$BLENDER" == *.exe ]]; then wslpath -w "$1"; else printf '%s' "$1"; fi; }
echo "$("$BLENDER" --version | head -n 1) — $BLENDER"
"$BLENDER" -b --factory-startup -noaudio --python-exit-code 1 \
  -P "$(caminho "$aqui/sessao23.py")" -- \
  --saida "$(caminho "$saida")" \
  --controlos "$(caminho "$aqui/controlos-sessao-23.json")"
echo "Saída em $saida"
