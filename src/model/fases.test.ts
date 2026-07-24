import { describe, expect, it } from 'vitest';
import { amostraPercurso, compilarPercurso, posicaoNaFase, tempoDeslize } from './fases';
import { preset100m } from './presets';

const L = 25;

describe('tempoDeslize', () => {
  it('forma fechada bate certo com integração numérica de dx/v(x)', () => {
    const D = 3, vp = 4.5, vk = 2.1;
    // v(x) linear na distância: integração trapezoidal fina de dt = dx/v(x)
    const N = 200000;
    let t = 0;
    for (let i = 0; i < N; i++) {
      const x0 = (D * i) / N, x1 = (D * (i + 1)) / N;
      const v0 = vp + ((vk - vp) * x0) / D, v1 = vp + ((vk - vp) * x1) / D;
      t += ((x1 - x0) / 2) * (1 / v0 + 1 / v1);
    }
    expect(tempoDeslize(D, vp, vk)).toBeCloseTo(t, 8);
  });

  it('caso degenerado v_pico == v_pernada → D/v', () => {
    expect(tempoDeslize(3, 2.1, 2.1)).toBeCloseTo(3 / 2.1, 12);
  });

  it('deslize nulo → 0', () => {
    expect(tempoDeslize(0, 4.5, 2.1)).toBe(0);
  });
});

describe('compilarPercurso — preset 100 m', () => {
  const preset = preset100m();

  it('1.º percurso: tempos derivados exatos', () => {
    const pc = compilarPercurso(preset.percursos[0], L, true);
    expect(pc.problemas).toHaveLength(0);
    expect(pc.t_deslize).toBeCloseTo((3 * Math.log(4.5 / 2.1)) / 2.4, 10);
    expect(pc.t_pernada).toBeCloseTo(5 / 2.1, 10);
    // v_nado fecha o percurso: (25 − 8 − 3) / (12 − 0.65 − 0.35 − t_deslize − t_pernada)
    const tNado = 12 - 0.65 - 0.35 - pc.t_deslize - pc.t_pernada;
    expect(pc.v_nado).toBeCloseTo(14 / tNado, 10);
    expect(pc.v_nado).toBeLessThan(2.1);
  });

  it('soma das durações das fases = parcial_s (todos os percursos)', () => {
    preset.percursos.forEach((p, i) => {
      const pc = compilarPercurso(p, L, i === 0);
      const soma = pc.fases.reduce((s, f) => s + f.dur, 0);
      expect(soma).toBeCloseTo(p.parcial_s, 9);
    });
  });

  it('soma das distâncias das fases = L', () => {
    preset.percursos.forEach((p, i) => {
      const pc = compilarPercurso(p, L, i === 0);
      const soma = pc.fases.reduce((s, f) => s + f.dist, 0);
      expect(soma).toBeCloseTo(L, 9);
    });
  });

  it('sequência de fases do 1.º percurso: morto→voo→deslize→pernada→nado', () => {
    const pc = compilarPercurso(preset.percursos[0], L, true);
    expect(pc.fases.map((f) => f.tipo)).toEqual(['morto', 'voo', 'deslize', 'pernada', 'nado']);
  });

  it('percursos seguintes não têm voo (mesmo que o JSON traga os campos)', () => {
    const pc = compilarPercurso({ ...preset.percursos[1], voo_m: 3, voo_s: 0.35 }, L, false);
    expect(pc.fases.map((f) => f.tipo)).toEqual(['morto', 'deslize', 'pernada', 'nado']);
  });

  it('subaquático: deslize e pernada sempre; morto só nas viragens', () => {
    const pc1 = compilarPercurso(preset.percursos[0], L, true);
    const sub1 = Object.fromEntries(pc1.fases.map((f) => [f.tipo, f.subaquatico]));
    expect(sub1).toEqual({ morto: false, voo: false, deslize: true, pernada: true, nado: false });
    const pc2 = compilarPercurso(preset.percursos[1], L, false);
    const sub2 = Object.fromEntries(pc2.fases.map((f) => [f.tipo, f.subaquatico]));
    expect(sub2).toEqual({ morto: true, deslize: true, pernada: true, nado: false });
  });
});

describe('continuidade nas fronteiras de fase', () => {
  const preset = preset100m();

  it('posição contínua e velocidade do deslize termina em v_pernada', () => {
    preset.percursos.forEach((p, i) => {
      const pc = compilarPercurso(p, L, i === 0);
      const eps = 1e-7;
      for (const f of pc.fases.slice(1)) {
        const antes = amostraPercurso(pc, f.t0 - eps);
        const depois = amostraPercurso(pc, f.t0 + eps);
        expect(Math.abs(depois.pos - antes.pos)).toBeLessThan(1e-4);
      }
      const deslize = pc.fases.find((f) => f.tipo === 'deslize')!;
      const fim = posicaoNaFase(deslize, deslize.dur);
      expect(fim.v).toBeCloseTo(p.v_pernada, 9);
      expect(fim.pos).toBeCloseTo(deslize.pos0 + p.deslize_m, 9);
    });
  });

  it('velocidade do deslize decai de v_pico e é monótona', () => {
    const pc = compilarPercurso(preset.percursos[0], L, true);
    const deslize = pc.fases.find((f) => f.tipo === 'deslize')!;
    let vAnterior = posicaoNaFase(deslize, 0).v;
    expect(vAnterior).toBeCloseTo(4.5, 9);
    for (let k = 1; k <= 50; k++) {
      const { v } = posicaoNaFase(deslize, (deslize.dur * k) / 50);
      expect(v).toBeLessThanOrEqual(vAnterior + 1e-12);
      vAnterior = v;
    }
  });

  it('percurso fecha exatamente: pos(parcial_s) = L', () => {
    preset.percursos.forEach((p, i) => {
      const pc = compilarPercurso(p, L, i === 0);
      expect(amostraPercurso(pc, p.parcial_s).pos).toBeCloseTo(L, 9);
      expect(amostraPercurso(pc, 0).pos).toBe(0);
    });
  });
});

describe('validação', () => {
  const base = { parcial_s: 12, sub_m: 8, morto_s: 0.65, v_pico: 4.5, v_pernada: 2.1, deslize_m: 3, voo_m: 3, voo_s: 0.35 };

  it('parcial impossível (tempo restante ≤ 0) → erro', () => {
    const pc = compilarPercurso({ ...base, parcial_s: 3.5 }, L, true);
    expect(pc.problemas.some((q) => q.nivel === 'erro' && q.msg.includes('impossível'))).toBe(true);
  });

  it('v_nado > v_pernada → aviso, não erro', () => {
    // 25 m em 11 s com sub 4 m e v_pernada 1.6 obriga a nadar mais rápido do que a pernada
    const pc = compilarPercurso({ parcial_s: 11, sub_m: 4, morto_s: 0.3, v_pico: 3, v_pernada: 1.6, deslize_m: 3 }, L, false);
    expect(pc.problemas.some((q) => q.nivel === 'erro')).toBe(false);
    expect(pc.problemas.some((q) => q.nivel === 'aviso' && q.msg.includes('v_nado'))).toBe(true);
    expect(pc.v_nado).toBeGreaterThan(1.6);
  });

  it('sub_m < deslize_m → erro', () => {
    const pc = compilarPercurso({ ...base, sub_m: 2 }, L, true);
    expect(pc.problemas.some((q) => q.nivel === 'erro' && q.msg.includes('sub_m'))).toBe(true);
  });

  it('voo_m + sub_m > L → erro', () => {
    const pc = compilarPercurso({ ...base, sub_m: 23 }, L, true);
    expect(pc.problemas.some((q) => q.nivel === 'erro' && q.msg.includes('excede'))).toBe(true);
  });

  it('v_pico < v_pernada → aviso', () => {
    const pc = compilarPercurso({ ...base, v_pico: 1.5 }, L, true);
    expect(pc.problemas.some((q) => q.nivel === 'aviso' && q.msg.includes('v_pico'))).toBe(true);
  });

  it('percurso com erro devolve fases utilizáveis (parado na parede)', () => {
    const pc = compilarPercurso({ ...base, parcial_s: -1 }, L, true);
    expect(pc.fases.length).toBeGreaterThan(0);
    expect(amostraPercurso(pc, 0.5).pos).toBe(0);
  });
});
