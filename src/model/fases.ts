// Física do ritmo: compilação de um percurso em fases sequenciais e
// avaliação posição/velocidade em função do tempo.
//
// Este módulo será traduzido quase linha a linha para C++ no firmware:
// só aritmética, sem dependências.

import type { Fase, PercursoCompilado, PercursoJSON, Problema, TipoFase } from './tipos';

export const EPS = 1e-9;

/**
 * Tempo do deslize em forma fechada.
 * Modelo: v decai LINEARMENTE NA DISTÂNCIA de v_pico para v_pernada ao longo
 * de deslize_m:  v(x) = v_pico + (v_pernada − v_pico)·x/deslize_m.
 * t = ∫₀^D dx/v(x) = D·ln(v_pico/v_pernada)/(v_pico − v_pernada).
 * Caso degenerado v_pico == v_pernada: t = D/v_pernada.
 */
export function tempoDeslize(deslize_m: number, v_pico: number, v_pernada: number): number {
  if (deslize_m <= EPS) return 0;
  if (Math.abs(v_pico - v_pernada) < EPS) return deslize_m / v_pernada;
  return (deslize_m * Math.log(v_pico / v_pernada)) / (v_pico - v_pernada);
}

function fase(
  tipo: TipoFase,
  t0: number,
  dur: number,
  pos0: number,
  dist: number,
  subaquatico: boolean,
  v: number,
  b: number,
): Fase {
  return { tipo, t0, dur, pos0, dist, subaquatico, v, b };
}

/**
 * Compila um percurso na sequência de fases:
 *   morto → [voo] → deslize → pernada → nado
 * `primeiro` distingue o 1.º percurso (tem voo; o morto é no bloco, fora de água).
 * Nunca lança exceção: devolve sempre fases utilizáveis + lista de problemas.
 */
export function compilarPercurso(p: PercursoJSON, L: number, primeiro: boolean): PercursoCompilado {
  const problemas: Problema[] = [];
  const erro = (msg: string) => problemas.push({ nivel: 'erro', msg });
  const aviso = (msg: string) => problemas.push({ nivel: 'aviso', msg });

  // O voo só existe no 1.º percurso — noutros percursos os campos são ignorados.
  const voo_m = primeiro ? (p.voo_m ?? 0) : 0;
  const voo_s = primeiro ? (p.voo_s ?? 0) : 0;

  if (!(p.parcial_s > 0)) erro('parcial_s tem de ser > 0');
  if (!(p.v_pernada > 0)) erro('v_pernada tem de ser > 0');
  if (!(p.v_pico > 0)) erro('v_pico tem de ser > 0');
  if (p.deslize_m < 0) erro('deslize_m não pode ser negativo');
  if (p.morto_s < 0) erro('morto_s não pode ser negativo');
  if (voo_m > 0 && !(voo_s > 0)) erro('voo_s tem de ser > 0 quando voo_m > 0');
  if (p.sub_m < p.deslize_m) erro('sub_m tem de ser ≥ deslize_m (o deslize faz parte da distância submersa)');

  const dist_nado = L - voo_m - p.sub_m;
  if (dist_nado < -EPS) erro(`voo_m + sub_m (${(voo_m + p.sub_m).toFixed(1)} m) excede o comprimento da piscina (${L} m)`);

  if (p.v_pico < p.v_pernada - EPS) aviso('v_pico < v_pernada: o deslize acelera em vez de desacelerar');

  if (problemas.some((q) => q.nivel === 'erro')) {
    // Percurso inutilizável: fase única parada na parede, com a duração pedida.
    const dur = p.parcial_s > 0 ? p.parcial_s : 1;
    return {
      fases: [fase('morto', 0, dur, 0, 0, !primeiro, 0, 0)],
      dur, t_deslize: 0, t_pernada: 0, t_nado: 0, v_nado: 0, problemas,
    };
  }

  const t_deslize = tempoDeslize(p.deslize_m, p.v_pico, p.v_pernada);
  const dist_pernada = p.sub_m - p.deslize_m;
  const t_pernada = dist_pernada / p.v_pernada;

  // Fecho do percurso: o nado à superfície absorve exatamente o tempo restante.
  const t_nado = p.parcial_s - p.morto_s - voo_s - t_deslize - t_pernada;
  let v_nado = 0;
  if (t_nado <= EPS) {
    erro(
      `parcial fisicamente impossível: morto + voo + deslize + pernada = ` +
      `${(p.morto_s + voo_s + t_deslize + t_pernada).toFixed(2)} s ≥ parcial ${p.parcial_s.toFixed(2)} s`,
    );
  } else if (dist_nado > EPS) {
    v_nado = dist_nado / t_nado;
    if (v_nado > p.v_pernada + EPS) {
      aviso(`v_nado (${v_nado.toFixed(2)} m/s) > v_pernada (${p.v_pernada.toFixed(2)} m/s) — suspeito, mas possível em séries lentas`);
    }
  }
  // dist_nado == 0 com t_nado > 0: o ponto espera na parede final (v_nado = 0).

  if (problemas.some((q) => q.nivel === 'erro')) {
    const dur = p.parcial_s;
    return {
      fases: [fase('morto', 0, dur, 0, 0, !primeiro, 0, 0)],
      dur, t_deslize, t_pernada, t_nado: 0, v_nado: 0, problemas,
    };
  }

  // Construção das fases (as de duração nula são omitidas).
  // No 1.º percurso o morto (bloco) e o voo são fora de água; nas viragens o
  // morto é junto à parede, debaixo de água.
  const fases: Fase[] = [];
  let t = 0;
  let x = 0;
  if (p.morto_s > EPS) {
    fases.push(fase('morto', t, p.morto_s, x, 0, !primeiro, 0, 0));
    t += p.morto_s;
  }
  if (voo_m > EPS) {
    fases.push(fase('voo', t, voo_s, x, voo_m, false, voo_m / voo_s, 0));
    t += voo_s;
    x += voo_m;
  }
  if (p.deslize_m > EPS) {
    const b = (p.v_pernada - p.v_pico) / p.deslize_m;
    fases.push(fase('deslize', t, t_deslize, x, p.deslize_m, true, p.v_pico, b));
    t += t_deslize;
    x += p.deslize_m;
  }
  if (dist_pernada > EPS) {
    fases.push(fase('pernada', t, t_pernada, x, dist_pernada, true, p.v_pernada, 0));
    t += t_pernada;
    x += dist_pernada;
  }
  // O nado fecha sempre o percurso (mesmo com dist 0, para absorver o tempo).
  fases.push(fase('nado', t, t_nado, x, dist_nado > EPS ? dist_nado : 0, false, v_nado, 0));

  return { fases, dur: p.parcial_s, t_deslize, t_pernada, t_nado, v_nado, problemas };
}

/**
 * Posição e velocidade dentro de uma fase, no instante τ ∈ [0, dur].
 * Deslize: de dx/dt = v_pico + b·x resulta x(τ) = (v_pico/b)·(e^(b·τ) − 1)
 * e v(τ) = v_pico·e^(b·τ) — contínuo com v_pernada em τ = t_deslize.
 */
export function posicaoNaFase(f: Fase, tau: number): { pos: number; v: number } {
  if (tau <= 0) return { pos: f.pos0, v: f.tipo === 'morto' ? 0 : f.v };
  if (tau >= f.dur) {
    const vFim = f.tipo === 'deslize' ? f.v * Math.exp(f.b * f.dur) : f.v;
    return { pos: f.pos0 + f.dist, v: vFim };
  }
  if (f.tipo === 'deslize' && Math.abs(f.b) > EPS) {
    const e = Math.exp(f.b * tau);
    return { pos: f.pos0 + (f.v / f.b) * (e - 1), v: f.v * e };
  }
  // morto (v=0), voo, pernada, nado e deslize degenerado: velocidade constante.
  return { pos: f.pos0 + f.v * tau, v: f.v };
}

/** Posição/velocidade dentro do percurso compilado, τ ∈ [0, dur]. */
export function amostraPercurso(
  pc: PercursoCompilado,
  tau: number,
): { pos: number; v: number; fase: Fase } {
  const fases = pc.fases;
  let f = fases[0];
  for (let i = 0; i < fases.length; i++) {
    f = fases[i];
    if (tau < f.t0 + f.dur || i === fases.length - 1) break;
  }
  const { pos, v } = posicaoNaFase(f, tau - f.t0);
  return { pos, v, fase: f };
}
