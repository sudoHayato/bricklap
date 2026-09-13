const { withAndroidColors, withAndroidStyles, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
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
 *    Sessão 16: pôr o logótipo nos drawables não chegava. O template do Expo
 *    (sem `expo-splash-screen`) usa o PNG diretamente como fundo da janela —
 *    esticado ao ecrã inteiro no Android < 12 —, e no Android 12+ o sistema
 *    ignora-o e desenha o arranque com o ícone do lançador sobre o fundo do
 *    tema, que em modo escuro dava um fotograma escuro antes do creme da app.
 *    Gravado no telemóvel do fundador. Os estilos abaixo corrigem os dois.
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

/**
 * Os estilos do arranque. O `layer-list` `ic_launcher_background` vem do
 * template (a cor `splashscreen_background` com o logótipo centrado, no seu
 * tamanho) — é ele que tem de ser o fundo da janela, e não o PNG.
 *
 * - `Theme.App.SplashScreen`: fundo da janela = o `layer-list` (Android < 12);
 *   no Android 12+, fundo e ícone do arranque do sistema = o creme e o
 *   logótipo. O logótipo mede 144 dp numa tela de 288, para caber no círculo
 *   de 192 dp que o Android 12 garante (docs/marca/README.md, "Na app").
 * - `AppTheme`: fundo da janela creme. A `MainActivity` troca para este tema
 *   antes do primeiro desenho do React; com o `DayNight` do template, o
 *   telemóvel em modo escuro mostrava um fotograma escuro no meio do arranque.
 */
const ESTILOS = [
  { tema: "Theme.App.SplashScreen", nome: "android:windowBackground", valor: "@drawable/ic_launcher_background" },
  { tema: "Theme.App.SplashScreen", nome: "android:windowSplashScreenBackground", valor: "@color/splashscreen_background", api: "31" },
  { tema: "Theme.App.SplashScreen", nome: "android:windowSplashScreenAnimatedIcon", valor: "@drawable/splashscreen_logo", api: "31" },
  { tema: "AppTheme", nome: "android:windowBackground", valor: "@color/splashscreen_background" },
];

module.exports = function withRecursosDaMarca(config) {
  const comFicheiros = withDangerousMod(config, [
    "android",
    (cfg) => {
      const feitos = copiar(cfg.modRequest.projectRoot, cfg.modRequest.platformProjectRoot);
      const camada = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res", "drawable", "ic_launcher_background.xml");
      if (!fs.existsSync(camada)) {
        throw new Error(`withRecursosDaMarca: o template já não traz ${camada}; o fundo do arranque apontava para ele.`);
      }
      console.log(`withRecursosDaMarca: ${feitos.length} ficheiros copiados para res/`);
      return cfg;
    },
  ]);
  const comCores = withAndroidColors(comFicheiros, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: "splashscreen_background",
      value: FUNDO_ARRANQUE,
    });
    return cfg;
  });
  return withAndroidStyles(comCores, (cfg) => {
    for (const e of ESTILOS) {
      const parent = e.tema === "AppTheme" ? { name: "AppTheme" } : { name: e.tema, parent: "AppTheme" };
      cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
        add: true,
        parent,
        name: e.nome,
        value: e.valor,
        targetApi: e.api,
      });
    }
    return cfg;
  });
};
