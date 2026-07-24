# Lebre 3D

Simulador 3D de uma piscina de 25 m com um sistema de luzes de ritmo no fundo
(uma fita LED endereçável dentro de uma mangueira opalina), que **emula o
firmware** que mais tarde vai correr num ESP32 real. Um "ponto" de ~8 LEDs
percorre a fita à velocidade-alvo e serve de lebre para o nadador; a cor muda
na fase subaquática.

## Como correr

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # testes unitários do modelo (Vitest)
npm run build      # verificação de tipos + build de produção
```

Atalhos na aplicação: **1/2/3** mudam de câmara (Bancada / Treinador /
Atleta), **espaço** pausa/retoma. A timeline em baixo permite fazer scrub no
tempo do plano; a velocidade da simulação vai de 0,25× a 2×.

## Como exportar o plano JSON

No cartão **Plano JSON** do painel lateral:

- **Exportar .json** transfere o ficheiro do plano atual;
- **Copiar** põe o JSON na área de transferência;
- **Importar…** carrega um plano exportado (com validação e mensagens de erro).

O botão **Enviar plano** faz o mesmo que o upload para o ESP32 real: valida o
rascunho da tabela e entrega-o à máquina de estados (IDLE → COUNTDOWN →
RUNNING → FINISHED). Alterações na tabela só têm efeito depois de novo envio —
tal como no hardware.

## Correspondência simulador ↔ firmware

O módulo `src/model/` é o contrato com o firmware e foi escrito para ser
traduzido quase linha a linha para C++: só aritmética e estruturas simples,
sem qualquer dependência de Three.js ou do DOM. O mesmo JSON que o simulador
consome (`nome`, `piscina_m`, `leds_por_metro`, `ponto_leds`, cores e
`percursos[]` com `parcial_s, sub_m, morto_s, v_pico, v_pernada, deslize_m` e,
só no 1.º percurso, `voo_m, voo_s`) será enviado ao ESP32. As fases de cada
percurso são morto → [voo] → deslize (velocidade a decair linearmente na
distância, com tempo em forma fechada) → pernada → nado, com o nado calculado
para fechar o percurso exatamente no parcial. A atualização da fita é feita a
passos discretos (100 Hz por omissão) e o mapeamento posição→LED é
`idx = round(pos_m × leds_por_metro)` — igual ao que o C++ fará. A cena 3D
(`src/scene/`) limita-se a mostrar o buffer RGB que o "firmware" pinta,
acrescentando apenas a física da água: o vermelho subaquático atenua
fortemente com a distância (absorção espectral por canal), que é precisamente
o que se quer avaliar na vista do Atleta.
