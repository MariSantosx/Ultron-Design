# Ultron Design — landing page

Página única em HTML, com cena 3D (three.js), rolagem suave (Lenis) e animações (GSAP). Não precisa de instalação: só de um servidor local.

## Como abrir

Pela pasta do projeto, rode:

```bash
python ASSETS/extras/servidor-local.py
```

Depois abra <http://localhost:8771/index.html> (a página) ou <http://localhost:8771/design-system-ultron.html> (o design system). O servidor aceita pedidos parciais (Range), por isso o vídeo da dobra 2 só anda com a rolagem por esse servidor; abrir o arquivo direto do disco deixa o vídeo travado.

## Estrutura

```
index.html                  a página inteira (estilos e scripts da página estão dentro dela)
design-system-ultron.html   design system da marca (com a cena 3D)
COPY DA PÁGINA.docx         os textos da marca
ASSETS/
  img/
    robo/                   robô (imagem, relevo, máscara) e rosto humano do efeito
    dobra-2/                imagem da peça (usada só como molde)
    dobra-3/                os 4 objetos do carrossel (lineup-N.webp e lineup-N-depth.png)
    dobra-5-paineis/        as 5 imagens do painel fixo de "O que a Ultron faz"
    dobra-8/                janela da busca por imagem
    dobra-10-artigos/       imagens dos 6 artigos
    logo/                   logo da Ultron
  video/dobra-2.mp4         vídeo que anda com a rolagem na dobra 2
  js/                       ultron-robot.js (cena 3D) e ultron-icons.js
  fonts/                    fontes da marca (PP Neue Montreal)
  design-system/            arquivos da cena 3D e das imagens do design system
  favicon.ico               ícone da aba
  extras/                   este LEIA-ME e o servidor local
```

## Onde mexer

| Quero mudar… | Onde |
| --- | --- |
| Textos, seções, cores, tamanhos | `index.html` |
| Robô, fundo, desintegração, falha | `ASSETS/js/ultron-robot.js` |
| Rosto que aparece sob a casca do robô | `ASSETS/img/robo/human-face.webp` (rosto de frente, olhos na altura da viseira) |
| Imagens dos painéis, artigos e busca | pastas `ASSETS/img/dobra-*` (mesmo nome de arquivo) |
| Vídeo da dobra 2 | `ASSETS/video/dobra-2.mp4` (o primeiro segundo é pulado no código) |
| Cor de destaque | variável `--accent` em `index.html` |

## No celular

As mesmas funções do computador existem no celular (largura até 899 px), adaptadas ao toque:

- Robô: se desintegra em laranja enquanto o texto sobe; o rosto humano aparece num "escaneamento" automático a cada ~7 s e também onde o dedo encosta.
- Dobra 2: fica fixa e o vídeo anda com a rolagem (texto no alto, chamadas em 3 colunas embaixo).
- Dobra 3: carrossel fixo; a pasta viaja até o card e deslizar o dedo para o lado troca o card da frente.
- Dobra 5: o painel fica preso no topo e troca de cena conforme o card que passa.
- Dobra 6: rolagem vertical vira horizontal com os cards em 3D.
- Dobra 9: os planos se embaralham e o preço sobe, como no computador.
- Menu: botão de dois traços abre a lista de seções.

Quem pede "reduzir movimento" no sistema recebe a versão sem animação (dobras em lista).

## Desempenho

- Imagens em WebP (de 6,6 MB para 1,9 MB) e vídeo da dobra 2 com 2 MB; o vídeo tem todos os quadros como quadro-chave para a rolagem poder avançar e voltar sem travar (no celular também).
- Cada dobra só calcula as animações quando está perto da tela; a cena 3D desenha só o que ainda está visível e roda a 30 quadros/s nas dobras finais.
- A resolução da cena 3D se ajusta sozinha: se o aparelho não consegue ~33 quadros/s, baixa um degrau; se sobra folga, sobe de novo (`adaptRes` em `ASSETS/js/ultron-robot.js`).
- Sem desfoque de fundo (`backdrop-filter`) nos cartões: o fundo 3D muda todo quadro e o desfoque era o item mais caro.
- No iPhone/iPad o vídeo da dobra 2 tem o fundo preto removido num canvas (o Safari não aplica bem o filtro SVG no vídeo). Para ver esse modo no computador, abra `index.html?key=canvas`.
- Para trocar uma imagem, mantenha o mesmo nome e formato (.webp); para recomprimir o vídeo use `ffmpeg ... -g 1` (todos os quadros-chave).

## Movimento (padrão das animações)

Todas as animações seguem o mesmo padrão, definido em um lugar só:

| O quê | Valor | Onde |
| --- | --- | --- |
| Curva padrão | `cubic-bezier(.22,.8,.3,1)` | CSS `--m-ease` / JS `MOTION.ease` |
| Rápido (hover, cor, borda) | 0,3 s | `--m-fast` |
| Base (cartões, estados) | 0,5 s | `--m-base` |
| Lento (luzes e brilhos) | 0,8 s | `--m-slow` |
| Distância de entrada | 40 px | JS `MOTION.dist` |
| Cartões ao passar o mouse | sobem 6 px | `--m-lift` |
| Puxão dos títulos | 420 ms, um título por vez a cada 5 a 7,5 s | JS `MOTION` / `addPull()` |

Para mudar o "jeito" da página inteira, mude esses valores (bloco `<style id="motion">` e constante `MOTION` em `index.html`). A suavização das animações presas à rolagem não depende da taxa de quadros (`MOTION.k`), então ela tem o mesmo ritmo no computador e no celular.

## Observações

- Cadastros e newsletter são guardados só no navegador (`localStorage`). Para receber de verdade é preciso ligar a um serviço de formulário ou e-mail.
- Números, planos e textos dos artigos são de exemplo.
- Bibliotecas externas carregadas da internet: GSAP, ScrollTrigger, Lenis e three.js (CDN).
