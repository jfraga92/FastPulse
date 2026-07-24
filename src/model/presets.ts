import type { PlanoJSON } from './tipos';

/** Preset "100 m — 12/14/14/13" com os valores por omissão do sistema real. */
export function preset100m(): PlanoJSON {
  return {
    nome: '100 m — 12/14/14/13',
    piscina_m: 25,
    leds_por_metro: 60,
    ponto_leds: 8,
    cor_superficie: '#24d3c4',
    cor_subaquatico: '#ff4a3d',
    percursos: [
      { parcial_s: 12, sub_m: 8, morto_s: 0.65, v_pico: 4.5, v_pernada: 2.1, deslize_m: 3, voo_m: 3, voo_s: 0.35 },
      { parcial_s: 14, sub_m: 4, morto_s: 0.3, v_pico: 3, v_pernada: 2.1, deslize_m: 3 },
      { parcial_s: 14, sub_m: 4, morto_s: 0.3, v_pico: 3, v_pernada: 2.1, deslize_m: 3 },
      { parcial_s: 13, sub_m: 4, morto_s: 0.3, v_pico: 3, v_pernada: 2.1, deslize_m: 3 },
    ],
  };
}
