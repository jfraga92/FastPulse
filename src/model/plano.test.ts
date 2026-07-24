import { describe, expect, it } from 'vitest';
import { amostraPlano, compilarPlano, direcaoPercurso, percursoConstante, validarPlanoJSON } from './plano';
import { preset100m } from './presets';

describe('compilarPlano — preset 100 m', () => {
  const pl = compilarPlano(preset100m());

  it('é válido, sem avisos, e dura 53 s', () => {
    expect(pl.valido).toBe(true);
    expect(pl.problemas).toHaveLength(0);
    expect(pl.total_s).toBeCloseTo(12 + 14 + 14 + 13, 9);
    expect(pl.inicio_s).toEqual([0, 12, 26, 40]);
  });

  it('inversão de sentido nos percursos pares (1-based)', () => {
    expect(direcaoPercurso(0)).toBe(1);
    expect(direcaoPercurso(1)).toBe(-1);
    expect(direcaoPercurso(2)).toBe(1);
    // Início do 2.º percurso: parado na parede B → pos_abs = 25
    const a = amostraPlano(pl, 12.05);
    expect(a.percurso).toBe(1);
    expect(a.direcao).toBe(-1);
    expect(a.pos_abs).toBeCloseTo(25, 6);
    // A meio do 2.º percurso a posição absoluta desce
    const b1 = amostraPlano(pl, 18);
    const b2 = amostraPlano(pl, 19);
    expect(b2.pos_abs).toBeLessThan(b1.pos_abs);
  });

  it('posição absoluta contínua na viragem', () => {
    const antes = amostraPlano(pl, 12 - 1e-6);
    const depois = amostraPlano(pl, 12 + 1e-6);
    expect(antes.pos_abs).toBeCloseTo(25, 4);
    expect(depois.pos_abs).toBeCloseTo(25, 4);
  });

  it('distância acumulada é monótona ao longo do plano', () => {
    let anterior = -1;
    for (let t = 0; t <= 53; t += 0.05) {
      const a = amostraPlano(pl, t);
      expect(a.dist_cum).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = a.dist_cum;
    }
    expect(anterior).toBeCloseTo(100, 6);
  });

  it('fim do plano: terminou=true, parado na parede de chegada (par → parede A)', () => {
    const a = amostraPlano(pl, 60);
    expect(a.terminou).toBe(true);
    expect(a.v).toBe(0);
    expect(a.percurso).toBe(3);
    expect(a.pos_abs).toBeCloseTo(0, 6); // 4.º percurso: B→A
  });

  it('fases na ordem certa ao longo do 1.º percurso', () => {
    expect(amostraPlano(pl, 0.3).fase).toBe('morto');
    expect(amostraPlano(pl, 0.8).fase).toBe('voo');
    expect(amostraPlano(pl, 1.5).fase).toBe('deslize');
    expect(amostraPlano(pl, 3).fase).toBe('pernada');
    expect(amostraPlano(pl, 8).fase).toBe('nado');
    expect(amostraPlano(pl, 8).subaquatico).toBe(false);
    expect(amostraPlano(pl, 3).subaquatico).toBe(true);
  });
});

describe('modo velocidade constante', () => {
  it('v_pico = v_pernada = v_nado e o percurso fecha no mesmo parcial', () => {
    const preset = preset100m();
    const pl = compilarPlano(preset, { modoConstante: true });
    expect(pl.valido).toBe(true);
    expect(pl.total_s).toBeCloseTo(53, 9);
    pl.percursos.forEach((pc, i) => {
      const p = preset.percursos[i];
      const voo_m = i === 0 ? p.voo_m! : 0;
      const voo_s = i === 0 ? p.voo_s! : 0;
      const vConst = (25 - voo_m) / (p.parcial_s - p.morto_s - voo_s);
      expect(pc.v_nado).toBeCloseTo(vConst, 9);
      // Todas as fases em água à mesma velocidade
      for (const f of pc.fases) {
        if (f.tipo === 'deslize' || f.tipo === 'pernada' || f.tipo === 'nado') {
          expect(f.v).toBeCloseTo(vConst, 9);
        }
      }
    });
  });

  it('percursoConstante preserva o JSON original nos restantes campos', () => {
    const p = preset100m().percursos[1];
    const c = percursoConstante(p, 25, false);
    expect(c.parcial_s).toBe(p.parcial_s);
    expect(c.sub_m).toBe(p.sub_m);
    expect(c.v_pico).toBeCloseTo(c.v_pernada!, 12);
  });
});

describe('validarPlanoJSON', () => {
  it('aceita o próprio preset (contrato com o firmware)', () => {
    const json = JSON.parse(JSON.stringify(preset100m()));
    const r = validarPlanoJSON(json);
    expect(r.erros).toHaveLength(0);
    expect(r.plano?.percursos).toHaveLength(4);
  });

  it('rejeita campos em falta com mensagens claras', () => {
    const r = validarPlanoJSON({ nome: 'x', percursos: [{ parcial_s: 12 }] });
    expect(r.erros.some((e) => e.includes('piscina_m'))).toBe(true);
    expect(r.erros.some((e) => e.includes('v_pernada'))).toBe(true);
  });

  it('rejeita plano sem percursos', () => {
    const r = validarPlanoJSON({ piscina_m: 25, leds_por_metro: 60, ponto_leds: 8 });
    expect(r.erros.some((e) => e.includes('percursos'))).toBe(true);
  });
});
