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
    dobra-3/                os 4 objetos do carrossel (lineup-N e lineup-N-depth)
    dobra-5-paineis/        as 5 imagens do painel fixo de "O que a Ultron faz"
    dobra-8/                janela da busca por imagem
    dobra-10-artigos/       imagens dos 6 artigos
    logo/                   logo da Ultron
  video/dobra-2.mp4         vídeo que anda com a rolagem na dobra 2
  js/                       ultron-robot.js (cena 3D) e ultron-icons.js
  fonts/                    fontes da marca (PP Neue Montreal)
  design-system/            arquivos da cena 3D e das imagens do design system
  favicon.ico               ícone da aba
  extras/                   este LEIA-ME, o servidor local e a prévia do celular
```

## Onde mexer

| Quero mudar… | Onde |
| --- | --- |
| Textos, seções, cores, tamanhos | `index.html` |
| Robô, fundo, desintegração, falha | `ASSETS/js/ultron-robot.js` |
| Rosto que aparece sob a casca do robô | `ASSETS/img/robo/human-face.png` (rosto de frente, olhos na altura da viseira) |
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

## Observações

- Cadastros e newsletter são guardados só no navegador (`localStorage`). Para receber de verdade é preciso ligar a um serviço de formulário ou e-mail.
- Números, planos e textos dos artigos são de exemplo.
- Bibliotecas externas carregadas da internet: GSAP, ScrollTrigger, Lenis e three.js (CDN).
