const { withAndroidColors, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Plugin de configuração local: põe os recursos da marca nos drawables do
 * Android, por densidade.
 *
 * Existe por duas razões, e nenhuma se resolve com um ficheiro à mão:
 *
 * 1. **O ícone da notificação.** O serviço em primeiro plano do
 *    `expo-location` procura um drawable chamado exatamente
 *    `notification_icon` e, se não o encontrar, usa o ícone da aplicação
 *    (`LocationTaskService.kt`). Um ícone colorido ali sai como um borrão
 *    branco: o Android pinta a silhueta e ignora a cor. A alternativa seria
 *    instalar o `expo-notifications` só pelo seu plugin de ícone — uma
 *    dependência inteira por um PNG.
 *
 * 2. **O ecrã de arranque.** `android/` é gerado pelo `expo prebuild` e está
 *    fora do git, por isso qualquer ficheiro lá posto à mão desaparece no
 *    prebuild seguinte. Este plugin corre *depois* do template, e ganha.
 *
 * As imagens vêm já rasterizadas de `assets/marca/` (geradas a partir do SVG
 * mestre em `docs/marca/` — ver `docs/marca/README.md`); o plugin só as copia
 * para a densidade certa. Não rasteriza nada: o prebuild não é sítio para
 * depender de um rasterizador.
 */
const DENSIDADES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];

/** Cada recurso: o nome do drawable e o ficheiro de origem por densidade. */
const RECURSOS = [
  { nome: "notification_icon", origem: (d) => `notificacao-${d}.png` },
  { nome: "splashscreen_logo", origem: (d) => `arranque-${d}.png` },
];

function copiar(projectRoot, plataformaRoot) {
  const de = path.join(projectRoot, "assets", "marca");
  const res = path.join(plataformaRoot, "app", "src", "main", "res");
  const feitos = [];
  for (const recurso of RECURSOS) {
    for (const d of DENSIDADES) {
      const origem = path.join(de, recurso.origem(d));
      if (!fs.existsSync(origem)) {
        throw new Error(
          `withRecursosDaMarca: falta ${origem}. Gera os recursos da marca antes do prebuild (docs/marca/README.md).`,
        );
      }
      const destino = path.join(res, `drawable-${d}`, `${recurso.nome}.png`);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(origem, destino);
      feitos.push(`drawable-${d}/${recurso.nome}.png`);
    }
    // O template do Expo deixa um splashscreen_logo em `drawable/` sem
    // densidade; se ficasse, competia com os nossos e ganhava em mdpi.
    const semDensidade = path.join(res, "drawable", `${recurso.nome}.png`);
    if (fs.existsSync(semDensidade)) fs.rmSync(semDensidade);
  }
  return feitos;
}

/**
 * O fundo do ecrã de arranque. Branco era o do template; #FBF8F4 é o `fundo`
 * do tema claro (DESIGN.md §2), que é o do ecrã inicial — assim o arranque
 * entrega o primeiro ecrã sem um salto de cor pelo meio.
 */
const FUNDO_ARRANQUE = "#FBF8F4";

module.exports = function withRecursosDaMarca(config) {
  const comFicheiros = withDangerousMod(config, [
    "android",
    (cfg) => {
      const feitos = copiar(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      console.log(`withRecursosDaMarca: ${feitos.length} ficheiros copiados para res/`);
      return cfg;
    },
  ]);
  return withAndroidColors(comFicheiros, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: "splashscreen_background",
      value: FUNDO_ARRANQUE,
    });
    return cfg;
  });
};
