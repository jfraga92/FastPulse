// Mapeamento posição→LED e pintura da fita — igual ao que o C++ fará.
// A fita é um buffer RGB [0..1] com 3 floats por LED (no firmware: bytes).

import type { Amostra } from './tipos';

/** Mapeamento posição→índice do contrato com o firmware: idx = round(pos_m × leds/m). */
export function indiceLed(pos_m: number, ledsPorMetro: number, numLeds: number): number {
  const idx = Math.round(pos_m * ledsPorMetro);
  if (idx < 0) return 0;
  if (idx >= numLeds) return numLeds - 1;
  return idx;
}

export interface CorRGB { r: number; g: number; b: number }

/** '#rrggbb' → componentes 0..1 (sem dependências, igual em C++). */
export function hexParaRGB(hex: string): CorRGB {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h, 16);
  if (h.length !== 6 || isNaN(v)) return { r: 1, g: 1, b: 1 };
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

export function limparFita(fita: Float32Array): void {
  fita.fill(0);
}

/**
 * Pinta o ponto da lebre: cabeça no LED correspondente a pos_abs e cauda de
 * `pontoLeds` LEDs a esbater, atrás da direção do movimento (quadrático).
 */
export function pintarPonto(
  fita: Float32Array,
  numLeds: number,
  ledsPorMetro: number,
  amostra: Amostra,
  cor: CorRGB,
  pontoLeds: number,
): void {
  const cabeca = indiceLed(amostra.pos_abs, ledsPorMetro, numLeds);
  const n = pontoLeds < 1 ? 1 : pontoLeds;
  for (let k = 0; k < n; k++) {
    const i = cabeca - amostra.direcao * k;
    if (i < 0 || i >= numLeds) continue;
    const f = 1 - k / n;
    const intensidade = f * f;
    const o = i * 3;
    fita[o] = Math.max(fita[o], cor.r * intensidade);
    fita[o + 1] = Math.max(fita[o + 1], cor.g * intensidade);
    fita[o + 2] = Math.max(fita[o + 2], cor.b * intensidade);
  }
}

/**
 * Padrão de contagem decrescente: a fita toda pisca uma vez por segundo
 * (flash de 200 ms), com um flash contínuo no último meio segundo.
 * `restante_s` é o tempo que falta para o arranque.
 */
export function pintarCountdown(fita: Float32Array, numLeds: number, restante_s: number, cor: CorRGB): void {
  const frac = restante_s - Math.floor(restante_s);
  const aceso = restante_s <= 0.5 || frac > 0.8;
  limparFita(fita);
  if (!aceso) return;
  const intensidade = restante_s <= 0.5 ? 0.9 : 0.55;
  for (let i = 0; i < numLeds; i++) {
    const o = i * 3;
    fita[o] = cor.r * intensidade;
    fita[o + 1] = cor.g * intensidade;
    fita[o + 2] = cor.b * intensidade;
  }
}
