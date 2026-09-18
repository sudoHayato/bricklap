# Sistema visual do Bricklap

Documento vivo. É este documento que a implementação na app Android segue; o protótipo em [docs/prototipo/bricklap.html](prototipo/bricklap.html) é a sua primeira aplicação completa, nos nove ecrãs. Decidido na sessão 12 (2026-09-12) a partir da direção do fundador: fundo claro, tinta quase preta, **um** acento quente e forte, números grandes, contraste alto — sem copiar nada de nenhuma app de treino.

Quando houver conflito entre este documento e o protótipo, manda este documento.

## 1. Tema: escolha do atleta

Decisão do fundador (sessão 12): o tema é uma **preferência do atleta**, com três presets e a opção de seguir o sistema. Não há personalização livre de cores nem de tipografia.

| Preset | Treino (gravação) | Consulta (tudo o resto) |
|---|---|---|
| Claro | claro | claro |
| Escuro | escuro | escuro |
| **Híbrido (predefinido)** | **escuro** | **claro** |
| Seguir o sistema | segue `prefers-color-scheme` | idem |

**Porque o híbrido é o predefinido**, por ordem de peso:

1. **Legibilidade em treino.** O ecrã de gravação vê-se de relance, ao sol, com suor e com o braço em movimento: números claros sobre fundo escuro perdem menos com reflexos e brilho alto, e o cronómetro fica a única coisa luminosa no ecrã.
2. **Bateria.** O painel do telemóvel do fundador é OLED e a gravação é o único ecrã que fica minutos ligado durante o treino; um fundo quase preto gasta menos.
3. **Assinatura.** A app não se parece com nenhuma outra na única altura em que é usada em público — no ginásio, entre séries.

A consulta fica clara porque o histórico e o resumo lêem-se sentado, com tempo, e uma superfície clara com tinta quase preta é mais rápida a ler em texto corrido e em tabelas.

Regra de implementação: o tema é decidido **por ecrã**, não pela app. Uma função única recebe o ecrã e devolve `claro` ou `escuro`; nenhum componente sabe qual dos presets está ativo. No protótipo é `temaDoEcra(screen)`, com o conjunto `TREINO` a dizer quais são os ecrãs de treino.

## 2. Cor

Dois conjuntos de tokens. Nenhum componente usa um hex diretamente: usa sempre o token.

### Tema claro

| Token | Hex | Onde |
|---|---|---|
| `fundo` | `#FBF8F4` | fundo do ecrã |
| `sup` | `#FFFFFF` | cartões, folha, barra de separadores |
| `sup2` | `#F2ECE4` | pílulas, botões −/+, campos |
| `linha` | `#E6DFD6` | contornos e separadores |
| `tinta` | `#16120F` | texto principal |
| `tinta2` | `#5A524B` | texto secundário |
| `tinta3` | `#948A81` | rótulos em maiúsculas, ícones inertes |
| **`acento`** | **`#B03A2A`** | botão Marca, botões de ação, estado ativo |
| `acento-premido` | `#96301E` | acento enquanto se prime |
| `acento-tinta` | `#9A3122` | acento em **texto** sobre fundo claro |
| `acento-fundo` | `#F9EBE9` | fundo do que está por preencher |
| `sobre-acento` | `#FFFFFF` | texto sobre o acento |
| `junta` | `rgba(255,253,250,.55)` | o vinco da fiada |

### Tema escuro

| Token | Hex | Onde |
|---|---|---|
| `fundo` | `#121010` | fundo do ecrã |
| `sup` | `#1C1917` | cartões, folha |
| `sup2` | `#272220` | pílulas, botões −/+ |
| `linha` | `#332D2A` | contornos |
| `tinta` | `#F7F2EC` | texto principal |
| `tinta2` | `#B5ABA2` | texto secundário |
| `tinta3` | `#7A716A` | rótulos |
| **`acento`** | **`#D14F3D`** | o mesmo papel do `#B03A2A` claro |
| `acento-premido` | `#B03A2A` | |
| `acento-tinta` | `#E88073` | acento em texto sobre fundo escuro |
| `acento-fundo` | `#341714` | por preencher |
| `sobre-acento` | `#FFFFFF` | texto sobre o acento |
| `junta` | `rgba(14,12,12,.6)` | o vinco da fiada |

O acento é **vermelho-tijolo (terracota)**, matiz 7°, ligado ao nome do produto. O `#D14F3D` do tema escuro é o mesmo matiz e a mesma saturação do `#B03A2A`, com a luminosidade subida para manter o contraste: é o **mesmo acento**, calibrado, não uma segunda cor.

Contrastes medidos (WCAG 2.1, sobre o `fundo` do respetivo tema):

| Par | Razão |
|---|---|
| `tinta` / `fundo` (claro) | 17,6:1 |
| `tinta2` / `fundo` (claro) | 7,2:1 |
| `acento` / `fundo` (claro) | 5,7:1 |
| `sobre-acento` / `acento` (claro) | 6,0:1 |
| `tinta` / `fundo` (escuro) | 17,0:1 |
| `tinta2` / `fundo` (escuro) | 8,4:1 |
| `acento-tinta` / `fundo` (escuro) | 7,0:1 |
| `sobre-acento` / `acento` (escuro) | 4,1:1 (só em texto ≥ 24 px, que é o único uso: o botão Marca) |

`tinta3` fica em 3,2:1 (claro) e 4,0:1 (escuro): **só** para rótulos em maiúsculas pequenas e ícones decorativos, nunca para texto que tenha de ser lido.

### Cor por desporto

Identifica, não decora, e aparece em **dois sítios apenas**: o **ícone** do desporto, com a cor cheia, e o troço de **fiada**, a 84 % sobre o fundo do tema. A legenda de um resumo usa os **ícones**, não quadradinhos de cor (sessão 13c). Nunca como fundo de um bloco, nunca em texto, e — desde a sessão 13b — **nunca como barra vertical na lateral de um cartão**: o ícone já identifica o bloco, e a barra era decoração a fingir que era dado (decisão do fundador, com o CTO de acordo).

| Desporto | Claro | Escuro |
|---|---|---|
| Força | `#6B4E3D` | `#C49A82` |
| Passadeira | `#2F6A94` | `#7FB2D9` |
| Remo indoor / Natação | `#1F8079` | `#5FBDB4` |
| Rua (corrida, caminhada) | `#4E8A3C` | `#8AC176` |
| Bicicleta | `#9A6A1E` | `#D9AE5E` |
| Transição | `#7C756B` | `#A9A199` |

## 3. Tipografia

Duas famílias, ambas de licença aberta, servidas pelo Google Fonts no protótipo e **embutidas** na app.

- **Texto: Inter**, pesos 400/500/600/700/800. Tudo o que é palavra: rótulos, nomes, explicações, botões.
- **Números: Archivo**, instância **Expanded** (eixo `wdth` 125), pesos 600/700/800/900, com `tabular-nums`. Tudo o que é medida: cronómetro, tempo de bloco, totais, valores dos cartões, número de série, distâncias, cargas.

**Porque Archivo Expanded.** Decisão do fundador na sessão 13a. A sessão 12 tinha proposto a Anybody Expanded pelos dígitos de formas quadradas, que em corpo grande parecem tijolos; o fundador viu-a aplicada e achou-a **robótica**, e tem razão: as contraformas fechadas e os terminais a esquadro dão ao cronómetro um ar de mostrador de máquina, que é precisamente o que a app não é. A **Archivo Expanded** mantém a largura e o peso que o cronómetro de 84 px precisa, com formas humanistas e contraformas abertas — sóbria sem ser fria. A comparação foi feita **nos ecrãs reais**, não num espécime: [gravação](prototipo/capturas/fonte-gravacao.png) e [resumo](prototipo/capturas/fonte-resumo.png), a mesma sessão, só a fonte a mudar.

A identidade não estava na fonte: está na fiada, nos ícones, no acento e na estrutura dos ecrãs (§7). Trocar os dígitos não tira ao Bricklap nada do que o distingue.

Medido, não suposto: a Archivo Expanded serve mesmo números tabulares — `00:00`, `11:11` e `88:88` medem os mesmos **291,66 px** a 84/800; sem `tnum` seriam 293,00 e 265,11, e o cronómetro saltaria a cada segundo. É também **6 % mais estreita** do que a Anybody (308,80 px), o que dá folga ao cronómetro num ecrã de 390 px.

Implementação na app (feita na sessão 14): as instâncias estáticas estão **embebidas no APK** (`apps/mobile/assets/fontes/`, declaradas no plugin `expo-font` do `app.json`) — sem CDN e sem rede, para o ecrã de gravação nunca esperar por uma fonte a meio de um treino. São **oito ficheiros, 1,9 MB**: Inter 400/500/600/700/800 e Archivo Expanded 600/700/800. O peso 900 da Archivo **não entra** porque nenhum papel da escala abaixo o usa — o maior é 800.

Duas regras que só existem por causa do Android, e que o protótipo não tinha de respeitar:

- **O peso escolhe a FAMÍLIA, nunca o `fontWeight`.** Cada peso é um ficheiro e a família é o nome do ficheiro; um `fontWeight` sobre uma fonte embebida é ignorado ou sintetizado a feio. Em `apps/mobile/ui/tipografia.ts` isso está fechado em `texto(tamanho, peso, cor)` e `numero(tamanho, peso, cor)`, e nenhum ecrã escreve `fontFamily` à mão.
- **A instância tem de ser a expandida**, e verifica-se: as três faces da Archivo trazem `usWidthClass = 7` (Expanded) na tabela OS/2. A largura normal é a 5, e serviria sem dar erro nenhum — só com o cronómetro mais estreito do que o desenho.

Escala (px), a mesma nos dois temas:

| Papel | Tamanho / peso |
|---|---|
| Cronómetro da gravação | 84 / 800, `letter-spacing -.035em` |
| Total de uma sessão | 72 / 800 |
| Tempo do bloco atual | 38 / 700 |
| Nome do bloco atual, rótulo do botão Marca | 28–29 / 800 |
| Título de ecrã | 27 / 800 |
| Valor principal de um cartão de exercício | 25 / 800 |
| Métrica secundária (distância, ritmo em treino) | 22 / 800 |
| Botão | 17 / 700 |
| Nome em lista, campo de ficha | 15–15,5 / 600–700 |
| Texto secundário, detalhe de cartão | 12,5–13,5 / 500–600 |
| Rótulo em maiúsculas (`kicker`) | 11 / 700, `letter-spacing .1em` |

Regras: números **nunca** em Inter; palavras **nunca** em Archivo; uma só coisa por ecrã acima de 40 px. **Uma exceção, e é da marca e não do texto**: a palavra "Bricklap" no lockup do cabeçalho (§8b, §6) vai em Archivo Expanded — a mesma família do lockup horizontal da marca (`docs/marca/bricklap-horizontal.svg`), não a do texto corrido. É a única palavra do sistema que sai desta regra, e é por ser nome próprio da marca, não copy.

A abreviatura da unidade que pertence ao número (`km`, `m`, `kg`, `/km`, `reps`) fica **dentro** da corrida de Archivo: é parte da medida, não texto — `2 000 m` e `5:30 /km` lêem-se como uma coisa só. Palavras que descrevem a medida ("passadeira", "em movimento", "última vez") são Inter.

## 4. Espaçamento, raios, alvos

- Escala de espaçamento: **4, 8, 12, 16, 20, 24, 32**. Margem lateral dos ecrãs: 20.
- Raios: 8 (pequeno), 12 (botão, linha de tabela), 16 (cartão), 20 (botão Marca), 24 (folha), 999 (pílula, chip).
- Alvos de toque: **56 px** para tudo o que se toca durante o treino (botões, −/+, chips da ficha); 44 px para ações de consulta; o **botão Marca tem 80 px** e ocupa a largura toda (eram 110 até à sessão 16 — ver §6).
- Um ecrã de treino nunca tem mais de três alvos: Marca, Mudar, Parar.

## 5. Ícones

Originais, desenhados para o Bricklap. Traço de **2 px**, extremos e junções redondos, grelha de 24×24, sem preenchimento, herdam a cor do texto (`currentColor`). São SVG inline, um `<symbol>` por ícone.

- **Desportos** — descrevem o aparelho, não a pessoa: força (barra com dois discos), passadeira (tapete com consola inclinada), remo indoor (carril com banco e cabo), natação (duas ondas), corrida (percurso angular com dois pontos), caminhada (percurso curvo com dois pontos), bicicleta (duas rodas e quadro), transição (duas setas em sentidos opostos).
- **Ações** — marca (bandeira num mastro), mudar, parar (quadrado), relógio, aviso, editar, voltar, notas, mais, menos, cima, baixo, fechar, apagar, certo.
- **Navegação** — repetem o motivo do produto: início é **um tijolo** (retângulo com a junta a meio e as juntas da fiada de baixo desencontradas), histórico são **três fiadas** de segmentos desencontrados, modelos são duas fiadas sobrepostas, definições são três reguladores sobre linhas.

Não usar ícone para: o nome de um exercício de força (o nome é o nome), o estado "por preencher" (é cor e texto), nem decoração em cartões de consulta.

## 6. Componentes

**Botão.** Altura 56 (44 em consulta), raio 12, contorno de 1,5 px em `linha`, fundo `sup`. Variantes: `acento` (fundo de acento, texto branco) — no máximo **um** por ecrã; `fantasma` (sem fundo nem contorno, texto `tinta2`) para ações de saída; `perigo` (texto `acento-tinta`) para Parar e Apagar. Ícone à esquerda do rótulo, 22 px.

**Botão Marca.** O gesto central da app, redesenhado na sessão 13c. **Nada de instruções lá dentro**: um botão que se tem de explicar por escrito já falhou, e quem o toca está a suar, a tremer e a olhar de relance.

- **Silhueta própria**, e não um retângulo de cantos iguais: **80 px** de altura, largura total, raios **8 px à esquerda e 20 px à direita**. A aresta cortada encosta ao que já está construído; a aberta é por onde entra o bloco seguinte. É a única forma no sistema que não se repete em mais lado nenhum — e continua a não ser redonda, que o §8 proíbe.
- **Profundidade real**: o casco é `acento-premido` e a face é `acento`, assente **4 px** acima do fundo do casco. Ao premir a face desce 3 px e o leito encolhe de 4 para 1 px, em 90 ms. O que muda é **geometria**, não cor: duas terracotas vizinhas são a mesma cor ao sol, e o dedo tapa o centro do botão mas não a aresta de baixo. A sombra é baixa (elevação 3): a profundidade é o leito, não um halo.
- **Indicador do gesto longo**: um anel de 2,5 px em branco a 92 %, recuado 8 px, com os mesmos raios da silhueta, desenhado por `clip-path` da esquerda para a direita ao longo dos **500 ms** exatos do premir. Em repouso está inteiramente recortado — **não existe**, e o botão fica com uma palavra e uma bandeira e mais nada.
- **Rótulo alinhado à esquerda**, **22/800** com 22 px de recuo e a bandeira a 22 px: o polegar direito cai no terço direito do botão, e a palavra nunca fica debaixo do dedo.
- **Alvo**: 80 px de altura por toda a largura útil — 43 % acima do mínimo de 56, e acima do piso que o CTO fixou (72 px de altura, 90 % da largura).
- **Sessão 16: de 110 para 80 px.** No telemóvel real, com a mão a meio de um treino, o botão da 13c era grande de mais (fundador). Desceram juntos a altura, o rótulo (29 → 22, o tamanho das distâncias no cartão de gravação), a bandeira (28 → 22, a dos outros botões), o leito (6 → 4) e a sombra, que era metade do peso visual e não servia o gesto. **O protótipo HTML continua com a medida da 13c**; em conflito, manda este documento.
- Parar mantém o gesto de 0,8 s com a barra em acento a 16 %; Mudar e Parar mantêm-se como estão.
- **Na app, o Marca dispara ao fim do premir e não ao toque** (sessão 14). No protótipo o toque marca e o premir marca **e abre a ficha**; a ficha é a Fase 4.5 e ainda não existe, e até existir um toque e um premir fariam exatamente o mesmo. A escolha foi pelo custo do erro: uma marca **não se desfaz** nesta versão, e um toque acidental no telemóvel pousado no banco partia um bloco em dois sem ninguém dar por isso. Um premir que não chega ao fim não faz nada e **vê-se**, porque o anel recua — e é assim que o botão se explica à primeira tentativa. Quando a ficha entrar, o toque volta a ser marca simples e o anel mantém o significado que já tem.

**Escolha de desporto (folha).** O que o botão Mudar abre — sessão 17, reversão de uma decisão de âmbito do CTO na sessão 14 (o Mudar passava para o desporto seguinte de uma lista fixa, em ciclo, sem o fundador o ter pedido; cada toque escrevia um evento). Sobe do fundo, raio 24 em cima, pega de 36×4; os oito desportos em duas grelhas — GINÁSIO e RUA, a mesma ordem e os mesmos ícones do início —, alvos de **56 px**. O desporto atual aparece com o selo "Atual", em `acento-fundo`/`acento`, e **não é premível**: não existe "mudar para o mesmo". **Nenhum evento se escreve ao abrir a folha** — só ao escolher um desporto diferente, e nessa ordem exata: a amostra de fronteira primeiro, o `changeSport` depois, como o CHANGE sempre fez. Cancelar — toque no véu por fora, o botão "Cancelar" no fundo da folha, ou o gesto de voltar do Android — fecha sem tocar na sessão. `apps/mobile/ui/escolhaDesporto.tsx`.

**"A seguir".** Linha própria **acima** do botão, dentro de `.acoes`: rótulo `A SEGUIR` em maiúsculas a 11/700 em `tinta3`, e o nome do bloco seguinte a 17/800 em `tinta`, truncado com reticências. Não é um cartão e não leva acento — o ecrã só tem um bloco de acento e é o Marca. Quando não há bloco seguinte (HIIT, sessão sem modelo) a linha não se desenha: não se põe lá um traço à espera de texto.

**Cartão.** Fundo `sup`, contorno `linha`, raio 16, sombra dupla suave, folga interior de 16. **Sem barra de cor na lateral** — um cartão que representa um bloco identifica-se pelo ícone do desporto, à esquerda do nome, e por mais nada.

**Chip.** Pílula de 40 px (56 na ficha), contorno `linha`; ativo = fundo `tinta`, texto `fundo`. Serve para escolher o exercício e para alternar entre ritmo e distância.

**Ficha rápida (folha).** Sobe do fundo, raio 24 em cima, pega de 36×4, até 93 % da altura. Cabeça com ícone do desporto + nome do bloco e uma linha de contexto ("Série 3 · 1:28 · o relógio já conta a passadeira"). No máximo **três campos**; cada campo é rótulo à esquerda e −/+ de 56 px com o valor a 29/800 à direita; um campo **calculado** mostra o valor sem controlo e diz de onde vem. Rodapé: "Depois" (fantasma) e "Guardar" (acento).

**Tabela de séries (expansível).** Substitui a "parede de tijolos" da sessão 10, que era ilegível. Cada série é uma linha fechada com: número da série, **fiada** proporcional ao tempo de cada bloco, tempo total da série, selo de acento com o número de blocos por preencher, e seta. Aberta, mostra uma linha por bloco: `ícone + nome` | `valor` | `tempo`; um bloco por preencher mostra no lugar do valor um botão tracejado **Preencher** em acento, que abre a ficha desse bloco. Sessões HIIT e de um só desporto não têm séries: mostram a lista plana de blocos, com a mesma linha. Numa volta de HIIT não há nada a preencher — a linha mostra só nome e tempo, e a sessão não conta blocos em falta (o atleta descreve o treino nas notas).

**Cartão "por preencher".** Um aviso **útil**, não um alarme (redesenhado na sessão 13b; antes era um retângulo de acento com o texto todo em vermelho e o botão encostado ao título). Fundo `acento-fundo`, sem contorno, raio 16, folga de 16/20. Quatro linhas, por esta ordem, que é a hierarquia: rótulo em maiúsculas `Por preencher` em `acento-tinta` com o ícone de aviso; **o que falta** a 16,5/800 em `tinta` — tinta normal, não acento; o **detalhe** a 13/500 em `tinta2`, a listar quais; e a **ação** numa linha só dela, alinhada à direita, com largura mínima de 140 px e 44 de altura. O acento fica no rótulo, no ícone e no botão, e mais nada.

O fundo tingido mantém-se de propósito: o resumo é uma pilha de cartões `sup` com contorno, e um aviso desenhado como eles camufla-se justamente naquilo que exige ação. Foi a razão de escolher este tratamento em vez de um em superfície normal ([comparativa](prototipo/capturas/aviso-tratamentos.png)).

**Cartão de exercício (resumo).** Nome com ícone à esquerda, valor principal grande à direita (`5×10`, `2,0 km`, `2 000 m`), detalhe por baixo do valor (`80–85 kg`, `4 × 0,5 km @ 5:30`) e, quando falta algo, uma linha em `acento-tinta` a dizer o quê. A frase-parágrafo do protótipo da sessão 10 **não volta** (fica reservada para texto de partilha).

**Seletor de tema.** Quatro opções, uma por linha: amostra (dois retângulos, treino e consulta, mais um fio de acento), nome, explicação de uma linha, e visto em acento na ativa. A predefinida traz a etiqueta "predefinido".

**Separadores de fundo.** Três: Início, Histórico, Modelos, com ícone e rótulo de 11,5 px; o ativo em `acento-tinta`. Definições entram pelo canto do ecrã inicial, não por separador.

## 7. Identidade: a fiada, os números, os ícones

O que faz um ecrã ser do Bricklap e de mais nenhuma app, por ordem de importância:

1. **A fiada** — uma **barra fina contínua de cantos arredondados**, **6 px** (9 quando é o total da sessão), sem contorno nem sombra, um troço por bloco, largura proporcional ao tempo, com a cor do desporto a **84 % sobre o fundo do tema**. É **contexto, não protagonista** — mas continua a ser **dado**, e o dado manda: a versão da sessão 13b, a 5 px e 72 % de opacidade, ficou ilegível e foi revertida na 13c. Aparece: sob o cronómetro durante a gravação (a sessão até agora, a crescer com cada marca), em cada linha da tabela de séries, em cada cartão do histórico e em cada cartão de modelo. É o mesmo objeto nos quatro sítios, e é sempre **dado**, nunca ornamento: nunca aparece sozinha sem rótulo nem tempo ao lado — foi isso que afundou a "parede" da sessão 10.

   **Como se desenha** (redesenhada na sessão 13a; a versão da sessão 12 eram segmentos separados por 2 px de argamassa, que o fundador rejeitou por dura e por parecer uma grelha):
   - **São as cores que separam os blocos**, não a argamassa: entre dois troços de cor diferente há uma transição curta (no máximo 2,2 pontos percentuais da largura da barra, e nunca mais de 45 % do troço mais curto que lhe toca).
   - **A junta** — **1 px** do token `junta`, um **vinco** da cor do fundo e não um corte — aparece **só onde a cor não muda**, que é o único sítio onde sem ela se perdia um bloco (força a seguir a força). É a exceção, não a regra: numa sessão de 25 blocos há três ou quatro juntas, não vinte e quatro. A 1,5 px e opaca, como ficou na primeira tentativa desta sessão, a junta **partia a barra** numa sessão de voltas iguais (um AMRAP de 14 voltas lia-se como uma régua tracejada) — o vinco mantém a silhueta contínua e continua a separar.
   - **O pior caso assume-se**: numa sessão de um só desporto com muitas voltas iguais, a fiada mostra tantos vincos quantas as voltas, porque é isso que a sessão é. O que não pode acontecer é o inverso — apagar os vincos e a fiada dizer que houve um bloco só.
   - **Piso de largura**: 82 % proporção ao tempo + 18 % repartido por igual, para que um bloco de 50 s não desapareça ao lado de um de 10 min.
   - **A mistura entre cores é curta**: `min(0,9 pontos percentuais; 18 % do troço mais curto que lhe toca)`. Este valor não é gosto, é o que o critério de aceitação obriga (ver abaixo). A fórmula anterior — `min(2,2 pp; 45 %)`, em vigor desde a sessão 13a — deixava **0,9 px de cor cheia** no troço mais estreito de uma sessão de 25 blocos; com 18 % sobram **5,8 px no pior troço e 10,0 px em média**.
   - **Saturação: 84 % da cor do desporto misturada com o `fundo` do tema** (`color-mix(in srgb, var(--d-X) 84%, var(--fundo))`), e **nunca `opacity`** — a opacidade apaga também o vinco, e foi o que borrou a fiada na sessão 13b. O ícone do mesmo desporto mantém a **cor cheia**: é o ícone que identifica, a fiada dá a proporção. Valores a usar na app, onde não há `color-mix`:

     | Desporto | Fiada, claro | Fiada, escuro |
     |---|---|---|
     | Força | `#82695A` | `#A88470` |
     | Passadeira | `#5081A3` | `#6E98B9` |
     | Remo / Natação | `#42938D` | `#53A19A` |
     | Rua | `#6A9C59` | `#77A566` |
     | Bicicleta | `#AA8140` | `#B99552` |
     | Transição | `#908A81` | `#918A83` |

   - **Critério de aceitação, verificável em captura**: numa fiada de **25 blocos** à largura da gravação (350 px), tem de conseguir contar-se quantos troços há de cada desporto — no 5×5, **15 de força, 5 de passadeira e 5 de remo**. Se não se conseguir, a fiada está errada, por mais discreta que pareça. Qualquer mudança de altura, saturação ou raio passa por este teste antes de entrar.
   - **Sessões de um só desporto com voltas iguais: a fiada fica** (decisão do CTO, sessão 13b). Num AMRAP de 14 voltas a fiada mostra 14 troços e lê-se rítmica — a dúvida levantada na sessão 13a. Não se esconde: quantas voltas houve e quanto durou cada uma é informação útil, e o texto sozinho ("14 voltas") não a dá. Fica com o vinco suave e assume-se.
   - Os tratamentos comparados e o porquê da escolha estão em [docs/prototipo/fiada.html](prototipo/fiada.html) e na [captura](prototipo/capturas/fiada-tratamentos.png). Um degradé **sem** junta nenhuma foi testado e chumbou: três blocos de força seguidos ficavam uma barra lisa, e a fiada deixava de ser dado.
2. **Os números** — Archivo Expanded, sempre tabulares, sempre maiores do que se espera.
3. **Os ícones do desporto** — desenhados para o Bricklap (§5), e o **único** sítio, além da fiada, onde a cor do desporto aparece. O *entalhe* — a barra de 3 px na aresta esquerda dos cartões — era o terceiro elemento até à sessão 13b e **saiu**: era redundante com o ícone, e uma app não ganha identidade por repetir a mesma informação duas vezes no mesmo cartão.

## 8. Regras de distinção

Nenhum ecrã do Bricklap pode ser confundido de relance com outra app de treino, em nenhum tema. Em concreto:

- **Sem laranja.** O acento é vermelho-tijolo de matiz 7°. Nada entre 15° e 45° em nenhum token. **Uma exceção conhecida, e é da marca e não de um token**: a tonalidade clara do logótipo (`#E89478`, o L) está a **15,0°**, em cima da fronteira — decisão do fundador na sessão 15, registada em [docs/marca/README.md](marca/README.md) para não se ler um dia como esquecimento.
- **Sem mapa como fundo.** O mapa, quando existir, é um cartão com contorno, nunca o fundo de um ecrã.
- **Sem botão redondo de gravar.** A ação principal é um retângulo largo de cantos de 20 px, com rótulo escrito. Nenhum botão circular em nenhum ecrã.
- **Sem ícones de terceiros**, sem tipografia de terceiros, sem o seu vocabulário visual (medalhas, chamas, corações de kudos, gráficos de área em gradiente).
- **Uma só coisa grande por ecrã**, e é sempre um número: o cronómetro na gravação, o total no resumo.
- **Cor de desporto em fio**, nunca em bloco: é o que impede o resumo de virar um mosaico colorido.

## 8b. A marca

O logótipo tem documento próprio — [docs/marca/README.md](marca/README.md) —, com as cores, a regra da cor (a distinção entre o B e o L mantém-se em tudo o que é visível; a versão a uma cor existe só para constrangimentos técnicos — **substituída como regra de desenho em 2026-09-15, ver abaixo**), os tamanhos mínimos medidos, o espaço livre e o que nunca fazer. O que interessa a este documento:

- **A marca e o acento são a mesma terracota, calibrada.** `#C0402C` (matiz 8,1°) vive entre o `#B03A2A` do tema claro (7,2°) e o `#D14F3D` do escuro (7,3°). Não é uma terceira cor a competir; é a mesma família.
- **O logótipo não é um ícone do §5.** Os ícones do sistema têm traço de 2 px e herdam a cor do texto; a marca é uma forma cheia com cor própria e não se desenha com as regras deles.
- **Na app, o logótipo assina o cabeçalho** do Início, do Histórico e da retoma (`apps/mobile/ui/logotipo.tsx`), **a duas tonalidades**. Na sessão 15 saiu a uma cor por um defeito do componente, corrigido e com teste na 16.
- **Desde a sessão 17, o símbolo volta a ter a palavra ao lado** (`ui/logotipoComPalavra.tsx`): entre a 15 e a 17 o cabeçalho só tinha o símbolo, e a app ficou sem nome à vista. A palavra é Archivo Expanded — a exceção do §3 — porque é a mesma família do lockup horizontal da marca; não é um wordmark desenhado, é um alinhamento a olho, tão provisório como o resto da marca (`docs/marca/README.md`).
- **O ícone da app não é o logótipo dentro de um quadrado** (decisão do fundador, sessão 16): é o campo `#C0402C` a toda a tela, com as três peças a claro — o pilar e o retângulo de cima em `#FBF8F4`, o de baixo em `#E89478`. **O recorte do sistema faz de moldura.** Desenhar a moldura dentro do ícone dá dois quadrados encaixados, o do sistema e o da marca, e no One UI o recorte chega a comer a moldura inteira.

### Regras de desenho de uma marca nova — decisão do fundador, 2026-09-15 (sessão 24)

**O que mudou e porquê.** As regras com que a marca se explorou desde a sessão 15 — plana, cortes a 90°, duas tonalidades, nunca inclinar — foram escritas antes de haver medições. Deram **200 variantes** nas sessões 18, 19 e 19b que convergiram sempre para tijolos empilhados, e mataram **por construção** a leitura dupla que o fundador quer: o espaço negativo precisava de uma forma que contivesse, e sem curvas a forma que contém é a moldura ([DECISOES-DESCARTADAS](DECISOES-DESCARTADAS.md), entradas 2, 3 e 6). O fundador decidiu abri-las. **Isto governa o desenho de uma marca nova; a marca de trabalho que está na app não muda por esta decisão** (nada entra na app sem decisão própria). **Desde a sessão 26 (decisão do fundador, 2026-09-18) a marca e o nome estão em standby por tempo indeterminado**: a P2122 é a marca de trabalho e "Bricklap" o nome de trabalho; as famílias AR e GI da sessão 25 fecharam ([DECISOES-DESCARTADAS](DECISOES-DESCARTADAS.md), entradas 8 e 9); estas regras ficam escritas para quando a marca reabrir.

**Passa a ser legal:**

- **Curvas verdadeiras**, não só cortes a 90°.
- **Inclinação**, em qualquer ângulo.
- **Uma cor só.** As duas tonalidades deixam de ser obrigatórias.
- **Qualquer número de peças**, ou uma peça só.
- **3D como método, não como resultado**: modelar em três dimensões, rodar, e ficar com a **silhueta plana** que a forma projeta.

**Continua proibido — e a razão é medida, não estética:** o **resultado** parecer 3D (volume, sombreado, gradiente, perspetiva visível). Um cubo isométrico a 24 px é uma mancha: as faces têm luminâncias diferentes e o antisserrilhado mistura-as. E a notificação do Android é monocromática: um volume sem sombreado deixa de ser volume. Os quatro cubos e tijolos em 3D que o Canva deu na sessão 23 confirmaram-no ([relatório](reports/2026-09-15-sessao-23.md) §4).

**As quatro regras que não se tocam** — mataram 200 variantes e nunca falharam:

1. **Legível a 24 px.**
2. **Sobrevive ao recorte circular** do ícone adaptativo (janela de 72 dp, círculo de 66 dp).
3. **Funciona a uma cor.**
4. **Não se lê como controlo de interface** — lista, menu, barra lateral, painel, indicador de carregamento, marca de corte, botão de reprodução, pasta, gráfico de barras, cronómetro, **e, desde a sessão 25 (decisão do CTO), o visto (✓), o cadeado e o sinal de wi-fi — e, desde a sessão 26 (decisão do fundador), o olho (o ícone de mostrar e ocultar)**. A leitura é a estrita: um controlo de interface fora desta lista também chumba, e diz-se qual.

**E uma restrição nova, de originalidade:** cada candidato compara-se, por sobreposição de silhuetas, com marcas existentes. Não se reproduz nem adapta nenhuma marca existente.

- **A régua é relativa desde a sessão 25** (decisão do CTO): a semelhança com uma marca conta só no que **excede** a semelhança com uma forma cheia qualquer (um disco ou um quadrado cheios); sinaliza-se quando esse excesso passa **0,20**, uma margem calibrada só com marcas ([relatório da sessão 25](reports/2026-09-18-sessao-25.md) §3; `tools/marca-blender/sessao25_semelhanca.py`). *O corte absoluto de 0,40 da sessão 24 ficou suspenso*: eliminava a própria P2122 (0,475), um disco cheio (0,686) e marcas reais umas contra as outras (Garmin contra Zwift, 0,659) — media o enchimento da silhueta, não a cópia.
- **As marcas** (35 símbolos, `tools/marca-blender/marcas-sessao-25.json`): as doze do fitness (Strava, Replit, Nike, Adidas, Under Armour, Garmin, Hevy, Whoop, Peloton, Zwift, Fitbit, Decathlon), as simples e conhecidas de fora dele (Beats by Dre, Airbnb, Slack, Dropbox, Spotify, Pinterest, Reddit, Telegram, Monzo, Revolut, Vercel, Linear) e McDonald's, Toyota, Meta, os anéis olímpicos, Mastercard, Target e Apple.
- **A leitura humana continua a ser o crivo que decide**, e é o único para as marcas quase circulares (Beats, Spotify, Telegram…), onde uma cópia se parece tanto com um disco como com a marca e nenhuma régua de silhueta a apanha. Foi a leitura que apanhou a Beats by Dre na sessão 24.

**As regras antigas, substituídas** (ficam para se perceber de onde vieram):

| Regra antiga | De onde vinha | Estado desde 2026-09-15 |
|---|---|---|
| A marca é **plana** | [marca/README.md](marca/README.md), "Nunca" (sessão 15) | **Mantém-se no resultado**; o 3D passa a ser legal como método |
| **Cortes a 90°**, só retângulos | a construção do gerador das sessões 18 a 19b (os briefs e o [relatório da 19b](reports/2026-09-13-sessao-19b.md) §9 leram-na como regra deste documento) | **Substituída**: curvas legais |
| **Duas tonalidades** em tudo o que é visível; uma cor só por constrangimento técnico | [marca/README.md](marca/README.md), "A regra da cor" (sessão 15) — já partida pelas medições da 19b ([DECISOES-DESCARTADAS](DECISOES-DESCARTADAS.md), entrada 5) | **Substituída**: uma cor é legal; duas deixam de ser obrigatórias |
| **Nunca rodar ou inclinar** | [marca/README.md](marca/README.md), "Nunca" (sessão 15) | **Substituída**: inclinação legal |
| As **peças** da marca (três, depois duas: a haste e o pé) | a moldura da sessão 15 e as famílias das 18 a 19b | **Substituída**: qualquer número, ou uma só |

A primeira sessão com estas regras foi a 24 ([relatório](reports/2026-09-15-sessao-24.md)).

## 9. Onde isto vive na app

Escrito na sessão 14, quando o sistema saiu do protótipo para `apps/mobile`. O protótipo continua a ser a referência visual; o código abaixo é a sua tradução, e é ele que o atleta usa.

| Parte deste documento | Ficheiro |
|---|---|
| §1 tema, §2 cor, §4 espaçamento e raios | `apps/mobile/ui/tokens.ts` |
| §1 regra "o tema decide-se por ecrã" | `apps/mobile/ui/tema.ts` (`usarTema`) |
| §3 tipografia | `apps/mobile/ui/tipografia.ts` |
| §5 ícones | `apps/mobile/ui/icones.tsx` |
| §6 componentes | `apps/mobile/ui/componentes.tsx` e `ui/estrutura.tsx` |
| §6 botão Marca | `apps/mobile/ui/marca.tsx` |
| §6 escolha de desporto | `apps/mobile/ui/escolhaDesporto.tsx` |
| §7 a fiada | `apps/mobile/ui/fiada.tsx` |
| Os ecrãs | `apps/mobile/ecras.tsx` |
| §8b a marca | `apps/mobile/ui/logotipo.tsx` e `ui/coresDoLogotipo.ts`; os PNG em `apps/mobile/assets/`; os estilos do arranque em `apps/mobile/plugins/withRecursosDaMarca.js` |
| §8b o lockup do cabeçalho | `apps/mobile/ui/logotipoComPalavra.tsx` |

Duas notas sobre a tradução, porque nenhuma é óbvia:

- **A fiada é SVG** (`react-native-svg`), e não uma fila de `View`s: precisa de um degradé com paradas em percentagem para as cores passarem umas para as outras, e é isso que a faz ler como uma barra e não como uma grelha. O vinco é um retângulo de 1 px por cima do degradé, nas mesmas juntas que o protótipo calcula.
- **Não há `color-mix` em React Native**, por isso os 84 % da fiada são os hexes já calculados da tabela do §7. É a razão de essa tabela existir.

## 10. O que este documento ainda não cobre

Fica para os briefs seguintes da Fase 4: ecrã de detalhe de um bloco, mapa de uma sessão de rua, gráficos (ritmo ao longo do tempo), estados de erro e de permissões, vazios de primeira utilização, animação de transição entre ecrãs, e o tratamento no relógio (Fase 5).
