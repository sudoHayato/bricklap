# A marca do Bricklap

Escolhida pelo fundador e desenhada na sessão 15. Uma **moldura quadrada vazada** com três peças lá dentro: o **pilar** à esquerda, e dois retângulos à direita, alinhados com ele. As três peças juntas leem-se como **B**; o pilar com o retângulo de baixo, na tonalidade clara, lê-se como **L**.

![A marca nos sete tamanhos, nos dois temas](folha-de-contacto.png)

## Cor

| Papel | Hex | Onde |
|---|---|---|
| **O B** | `#C0402C` | a moldura, o pilar e o retângulo de cima |
| **O L** | `#E89478` | o retângulo de baixo, e só ele |
| Preto | `#16120F` | fundos difíceis; é a `tinta` do tema claro |
| Branco | `#FFFFFF` | fundos difíceis e o ícone de notificação |

### A regra da cor

**A distinção entre o B (`#C0402C`) e o L (`#E89478`) é a alma da marca e mantém-se em todas as aplicações visíveis** — ícone da app, ecrã de arranque, cabeçalho, documentos. Decisão do fundador, e é uma **regra, não uma preferência**: a versão a uma cor não é uma alternativa estética entre duas, é o que se usa quando a técnica não deixa usar duas.

**A uma cor existe para três casos, e só para esses:**

1. **O ícone de notificação do Android.** O sistema obriga a monocromático: pinta a silhueta e ignora as cores que lá estiverem.
2. **Favicon.**
3. **Tamanhos abaixo de 24 píxeis renderizados**, onde os píxeis não chegam para duas tonalidades — ver *Tamanhos mínimos*.

Fora destes três, usar a uma cor onde cabiam duas é um erro, não uma escolha.

### Duas notas honestas sobre estas cores

- **O `#E89478` está em matiz 15,0°**, exatamente no limite que o [DESIGN.md](../DESIGN.md) §8 fecha ("nada entre 15° e 45° em nenhum token"). O `#C0402C` está a 8,1°, dentro da família do acento da app (7,2° no tema claro, 7,3° no escuro) — é a mesma terracota, não uma segunda cor. O L é o único valor da identidade que toca a fronteira do laranja. Fica registado porque foi decisão do fundador e porque quem ler a regra do §8 daqui a um ano merece saber que isto foi visto e aceite, não esquecido.
- **O contraste entre o B e o L é 2,23:1.** É baixo por desenho — são duas tonalidades da mesma cor, não duas cores. É também a razão por que a marca **pede fundo escuro** quando as duas tonalidades têm de brilhar: sobre `#121010` o B dá 3,62:1 e o L 8,07:1; sobre um fundo claro (`#FBF8F4`) o L cai para **2,22:1** e quase desaparece. É por isso que o ícone do Android leva fundo escuro.

## Tamanhos mínimos

Medido, não estimado. Na grelha de 100, cada retângulo da direita mede 44 × 28,5 e o vão entre eles 5. Rasterizando a marca a cada tamanho e contando os píxeis de cor que sobrevivem ao antisserrilhado:

| Tamanho | Altura da peça | Vão | Píxeis limpos do L | Leitura |
|---:|---:|---:|---:|---|
| 48 px | 13,7 px | 2,40 px | 240 | as duas tonalidades distinguem-se |
| 36 px | 10,3 px | 1,80 px | 148 | distinguem-se |
| **24 px** | 6,8 px | **1,20 px** | 60 | **o último tamanho em que se distinguem** |
| 18 px | 5,1 px | **0,90 px** | 28 | o vão desce abaixo de 1 px e as peças colam |

**A fronteira é 24 px.** De 24 para cima, duas tonalidades. Abaixo de 24, uma cor — não porque fique melhor, mas porque a outra deixa de ser verdade.

**São píxeis renderizados, não `dp` nem pontos.** Num ecrã a 3× (a maioria dos telemóveis de hoje), 24 dp são **72 px** e a marca está muito acima da fronteira; num ecrã a 1× são 24 px e está em cima dela. Quem aplicar a regra tem de contar os píxeis que a imagem vai mesmo ter, não a medida do esquema. É por isso que o logótipo do cabeçalho da app, desenhado a 26 dp, mostra as duas tonalidades sem problema: no telemóvel são 78 px.

## Qual variante, em que contexto

| Contexto | Ficheiro |
|---|---|
| Uso geral, ≥ 24 px | `bricklap-logo.svg` |
| Notificação do Android, favicon, < 24 px renderizados | `bricklap-logo-uma-cor.svg` |
| Fundo claro difícil (impressão a uma cor, fotocópia) | `bricklap-logo-preto.svg` |
| Fundo escuro ou fotografia | `bricklap-logo-branco.svg` |
| Marca com a palavra ao lado | `bricklap-horizontal.svg` (preto e branco: `-preto`, `-branco`) |
| Em estudo, não adotado | `bricklap-selo.svg` — ver *A pergunta do selo* |

A palavra da versão horizontal é **Archivo Expanded Bold (700)**, a mesma família dos números da app, **convertida em contornos**: um logótipo que depende de a fonte estar instalada em quem o abre não é um logótipo. O 700 foi escolhido contra o 800 porque acompanha o traço da moldura sem competir com ele, e porque as contraformas continuam abertas a 20 px, onde o 800 começa a fechar ([comparação](versao-horizontal.png)).

## Espaço livre

**Um quarto do lado da marca**, livre de tudo, em todo o redor. Numa marca de 48 px são 12 px; na versão horizontal mede-se pelo lado da moldura, não pela largura total. Dentro desse espaço não entra texto, nem contorno, nem a aresta de um cartão.

## Nunca

- **Deformar.** A marca é quadrada; escala-se sempre com as duas dimensões iguais.
- **Mudar as cores**, inverter o B e o L, ou pintar cada peça de uma cor.
- **Rodar** ou inclinar, em qualquer ângulo.
- **Sombras, brilhos, gradientes, contornos duplos.** A marca é plana, como o resto do sistema visual.
- **Redesenhar as peças** — mudar o vão, a espessura da moldura, o raio dos cantos. As proporções estão fixadas abaixo.
- **Usar a uma cor** onde as duas tonalidades cabem.
- **Pôr a marca sobre uma fotografia** sem ser a versão a branco ou a preto.

## A pergunta do selo, para o fundador

O **selo cheio** (`bricklap-selo.svg`) é um quadrado cheio com as três peças vazadas. Tem mais massa e aguenta melhor os tamanhos pequenos. **Não foi adotado**, e a moldura continua a ser a marca principal em qualquer caso — mas fica a comparação no [ecrã inicial do Android simulado](selo-vs-moldura.png) para o fundador decidir qual usar **como ícone da app**.

O argumento técnico contra o selo, que a maqueta mostra: as peças vazadas deixam ver **o que estiver por trás**. Na maqueta leem-se pretas porque o fundo é escuro; com outro papel de parede leriam outra coisa. **O selo não consegue transportar as duas tonalidades**, por construção — e é a distinção entre o B e o L que a regra da cor manda preservar justamente nas aplicações mais visíveis, que é o que o ícone da app é.

## A marca não está registada

**Nota do CTO.** Não há verificação no [TMview](https://www.tmdn.org/tmview/) nem no [INPI](https://inpi.justica.gov.pt/). Até isso acontecer:

- **Não tratar a marca como definitiva.**
- **Não a usar fora deste repositório e da app** — nada de sítio público, loja, redes ou material impresso.

A verificação é **tarefa do fundador**, quando houver alguma coisa pública para lançar.

## Geometria, para quem tiver de a redesenhar

Grelha de 100. Todos os ficheiros saem destes números — se algum divergir, o errado é o ficheiro.

| Medida | Valor |
|---|---|
| Lado | 100 |
| Raio exterior da moldura | 20 |
| Traço da moldura | 13 |
| Raio interior | 7 (= 20 − 13) |
| Folga entre a moldura e as peças | 6 |
| Campo útil | 62 × 62, de (19,19) a (81,81) |
| Pilar | 13 de largura, 62 de altura |
| Vão | 5 |
| Retângulos da direita | 44 × 28,5 cada |
| Raio das peças | 3 |

**A moldura e o pilar têm o mesmo peso, 13.** Foi o que fechou o desenho: com o pilar mais fino do que a moldura, a barra lia-se como um resto; com a moldura mais grossa, o interior era esmagado.

## Na app

### As margens de cada ficheiro, para quem os voltar a gerar

Não são gosto: saem da máscara do Android, que garante só os **72 dp centrais de 108** (≈ 66 %) e corta o resto conforme o fabricante.

| Ficheiro | Margem transparente | A marca ocupa |
|---|---:|---:|
| `android-icon-foreground.png` (adaptativo) | 18 % | **64 %** da tela |
| `android-icon-monochrome.png` (ícones temáticos) | 18 % | 64 % |
| `icon.png` (lançador antigo, com fundo) | 14 % | 72 % |
| `marca/notificacao-*.png` | 0 % | 100 % |
| `marca/arranque-*.png` | 0 % | 100 % |

Com 28 % — que foi o primeiro valor que usei — a marca fica em 44 % e **lê-se visivelmente mais pequena do que as vizinhas no lançador**. Só se vê no telemóvel, ao lado de outras aplicações; numa captura isolada parece bem.

### Os componentes

`apps/mobile/ui/logotipo.tsx` desenha a mesma geometria em `react-native-svg` — é o que assina o cabeçalho do Início, do Histórico e da retoma, no lugar onde a app escrevia a palavra "Bricklap" em texto. Os PNG do Android saem de `apps/mobile/assets/` e `apps/mobile/assets/marca/`, e o plugin `apps/mobile/plugins/withRecursosDaMarca.js` põe o ícone de notificação e o logótipo de arranque nos drawables por densidade, porque `android/` é gerado pelo `expo prebuild` e não vive no git.
