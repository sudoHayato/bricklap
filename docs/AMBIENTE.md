# Ambiente de trabalho

**Contexto técnico que até à sessão 22 só existia nas conversas.** As máquinas, o equipamento de teste e a forma de trabalhar com o fundador. O detalhe de instalação da app no telemóvel está em [`apps/mobile/README.md`](../apps/mobile/README.md); as limitações conhecidas estão no [`STATUS.md`](../STATUS.md).

## Máquinas

- **PC com Windows 10** (Home 22H2).
- **WSL 2 com Ubuntu.** Os repositórios vivem **dentro do sistema de ficheiros da WSL**, não em `/mnt/c`.
- **Sem modo de rede espelhada** — o Windows 10 não o tem. Consequência: os serviços da WSL não ficam visíveis ao telemóvel sem uma ponte (ver "Telemóvel").
- **Sem `sudo` sem palavra-passe**: tudo o que se instala na WSL instala-se em modo de utilizador.
- **Node 24 LTS via nvm** e **npm 11** (o npm 10 falha neste repositório — [`AGENTS.md`](../AGENTS.md), "Comandos"). Numa shell não interativa o `PATH` pode não carregar o nvm e apanhar outra versão do Node: nesse caso, chamar o binário do Node 24 explicitamente.

## Build Android

- **Build LOCAL**, na WSL: JDK 17 e Android SDK (plataforma 36, build-tools 36) instalados em modo de utilizador. Ver [ADR 0005](adr/0005-build-local-android.md).
- **Sem conta Expo e sem EAS.** O fundador não quer criar contas de terceiros para desenvolvimento.

## Telemóvel

- **Samsung Galaxy S24 Ultra, Android 16 (One UI 8.5)** — o telemóvel de teste, e o do fundador.
- **Ligado por USB**, com o **`adb.exe` do Windows chamado a partir da WSL**: a firewall bloqueia a ponte para um `adb` dentro da WSL, e a depuração sem fios exige Wi-Fi, quando o fundador trabalha muitas vezes em hotspot.
- O Metro da WSL chega ao telemóvel por `adb reverse` através de um relé IPv4 (o Metro só se expõe em IPv6 local). Procedimento no README da app.
- O telemóvel **tem PIN**: os testes de dispositivo precisam dele desbloqueado antes de correr.
- **O telemóvel é o do fundador e anda com ele.** Regras desde a sessão 26 (2026-09-18, decisão do fundador, depois de um agente iniciar uma sessão de Corrida por `adb` enquanto o telemóvel ia de carro, e de os toques seguintes caírem noutra aplicação que estava à frente):
  - **Nenhum agente inicia uma sessão com GPS sem perguntar primeiro ao fundador.** Uma Corrida gravada em movimento contamina o histórico do dogfooding e deixa o trajeto na base. O que se puder testar indoor testa-se indoor: Força, Remo indoor e Passadeira não ligam a localização (ADR 0008).
  - **Antes de cada toque por `adb`, confirmar que o Bricklap está à frente** (`dumpsys activity activities | grep topResumedActivity`). **Se outra aplicação estiver à frente, parar logo e avisar** — nunca continuar. Uma captura de ecrã que apanhe outra aplicação apaga-se de imediato e nada do seu conteúdo se regista em lado nenhum.
  - **Antes de instalar (o `pm install` mata a app), confirmar que não há uma gravação em curso — e a prova certa é `isForeground=true`, não a existência do serviço.** `adb shell dumpsys activity services com.bricklap.app` lista o `LocationTaskService` mesmo **depois** do Parar (a app usa `killServiceOnDestroy: false`); o que distingue uma gravação viva é `isForeground=true` nesse registo, ou a notificação do Bricklap visível. Na sessão 27 um registo antigo foi lido como um treino em curso e adiou a instalação mais de uma hora; o `logcat` mostrou a notificação a sair 26 ms depois do Parar.
  - **Pedir ao fundador uma janela** — uns minutos com o ecrã desbloqueado e o telemóvel pousado — antes de conduzir a interface, e tratar tudo o que a app gravar como dados reais do dogfooding: uma sessão de teste apaga-se no histórico no fim, e diz-se no relatório.

## Relógio

- **Garmin Fenix 6X Pro.** Uma app Connect IQ escreve-se em **Monkey C** e o motor em TypeScript não corre lá: é uma segunda implementação do motor, com ADR próprio, na **Fase 5** ([`BACKLOG.md`](BACKLOG.md), secção do dogfooding; [`ROADMAP.md`](../ROADMAP.md)).

## Blender

- **Instalado no Windows, chamado a partir da WSL** em modo headless. É o que a cadeia [`tools/marca-blender/`](../tools/marca-blender/) usa: o `gerar.sh` encontra o executável do Windows e passa-lhe os caminhos da WSL convertidos para o formato do Windows. Detalhe no relatório da sessão 18.

## O fundador e os agentes

- **O fundador não faz trabalho de desenvolvimento nem git.** Tudo o que os agentes conseguem fazer, fazem eles. **O fundador só intervém no que exige credenciais ou o telemóvel físico** — desbloquear o telemóvel, aceitar um diálogo do sistema, ver a notificação na barra, fazer um treino, confirmar o que vê no ecrã.
  - Consequência para o agente de código: **não lhe delegar** comandos, instalações, commits, merges nem leitura de logs. Se um passo pode ser feito pelo agente, é o agente que o faz; ao fundador pede-se só o gesto físico ou a credencial, dito de forma que não exija saber o que é um terminal.
- **Preferências de trabalho com agentes:**
  - **Honestidade total, nada de yes-man.**
  - **Indicações simples mas explícitas**, como para quem nunca viu o projeto.
  - **Prompts em caixa de código**, com **modelo, esforço e "telemóvel por USB ou não"** no cabeçalho, **por fora da caixa**.
  - **Para código ou julgamento: modelo de topo com esforço alto.** Modelos leves só em tarefas mecânicas, e mesmo aí dizendo porquê.
