#!/usr/bin/env bash
# Sessão 25: as duas famílias afinadas (sessao25_formas.py), com a P2122 e a
# P2122 inclinada. Corre o medidor da 24 no Blender, como o gerar.sh (ver lá porque
# os caminhos passam pelo wslpath -w).
#
#   tools/marca-blender/sessao25.sh <pasta-das-formas> [pasta-de-saída]
#
# Folhas: folha-24px, folha-uma-cor-24, folha-medicao, folha-recorte,
# folha-desfoque; medidas.json e caixas.json para o sessao25_folhas.py. Por
# omissão a saída fica em <pasta-das-formas>/medicao, fora do repositório.
set -euo pipefail
aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
formas="$(cd "${1:?indica a pasta das formas (a do sessao25_formas.py)}" && pwd)"
saida="${2:-$formas/medicao}"
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
  -P "$(caminho "$aqui/sessao24.py")" -- \
  --formas "$(caminho "$formas")" \
  --saida "$(caminho "$saida")" \
  --ficheiro formas.json \
  --sessao 25 \
  --titulo "duas famílias afinadas"
echo "Saída em $saida"
