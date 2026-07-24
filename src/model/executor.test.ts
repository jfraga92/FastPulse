import { describe, expect, it } from 'vitest';
import { COUNTDOWN_S, ExecutorESP32 } from './executor';
import { indiceLed } from './led';
import { preset100m } from './presets';

function novoExecutor(): ExecutorESP32 {
  const ex = new ExecutorESP32();
  ex.enviarPlano(preset100m());
  return ex;
}

describe('máquina de estados do ESP32', () => {
  it('IDLE → COUNTDOWN → RUNNING → FINISHED', () => {
    const ex = novoExecutor();
    expect(ex.estado).toBe('IDLE');
    ex.iniciar();
    expect(ex.estado).toBe('COUNTDOWN');
    ex.avancar(COUNTDOWN_S - 0.5, COUNTDOWN_S - 0.5);
    expect(ex.estado).toBe('COUNTDOWN');
    ex.avancar(1, 1);
    expect(ex.estado).toBe('RUNNING');
    expect(ex.tPlano).toBeCloseTo(0.5, 6);
    ex.avancar(60, 60);
    expect(ex.estado).toBe('FINISHED');
    expect(ex.tPlano).toBeCloseTo(53, 6);
  });

  it('iniciar sem plano é ignorado; parar limpa a fita e volta a IDLE', () => {
    const vazio = new ExecutorESP32();
    vazio.iniciar();
    expect(vazio.estado).toBe('IDLE');

    const ex = novoExecutor();
    ex.iniciar();
    ex.avancar(10, 10);
    expect(ex.estado).toBe('RUNNING');
    ex.parar();
    expect(ex.estado).toBe('IDLE');
    expect(ex.tPlano).toBe(0);
    expect(Array.from(ex.fita).every((v) => v === 0)).toBe(true);
  });

  it('plano inválido é rejeitado e não substitui o anterior', () => {
    const ex = novoExecutor();
    const mau = preset100m();
    mau.percursos[0].parcial_s = 2; // impossível
    const r = ex.enviarPlano(mau);
    expect(r.valido).toBe(false);
    expect(ex.plano?.valido).toBe(true);
    expect(ex.plano?.total_s).toBeCloseTo(53, 9);
  });

  it('o tempo avança em passos discretos de 1/hz', () => {
    const ex = novoExecutor();
    ex.hz = 100;
    ex.iniciar();
    ex.avancar(COUNTDOWN_S, COUNTDOWN_S);
    ex.avancar(0.004, 0.004); // menos de um passo → nada acontece
    const t0 = ex.tPlano;
    ex.avancar(0.004, 0.004); // acumulado 0.008 → 0 ticks? não: 0.008 ≥ 0.01? não → ainda nada
    expect(ex.tPlano).toBe(t0);
    ex.avancar(0.002, 0.002); // acumulado 0.01 → exatamente 1 tick
    expect(ex.tPlano).toBeCloseTo(t0 + 0.01, 9);
  });

  it('scrub salta no tempo do plano e repinta', () => {
    const ex = novoExecutor();
    ex.iniciar();
    ex.saltarPara(20);
    expect(ex.estado).toBe('RUNNING');
    expect(ex.amostra()?.percurso).toBe(1);
    ex.saltarPara(999);
    expect(ex.estado).toBe('FINISHED');
  });
});

describe('fita de LEDs (contrato com o firmware)', () => {
  it('idx = round(pos_m × leds_por_metro), com limites', () => {
    expect(indiceLed(0, 60, 1500)).toBe(0);
    expect(indiceLed(12.5, 60, 1500)).toBe(750);
    expect(indiceLed(12.51, 60, 1500)).toBe(751); // 750.6 arredonda para cima
    expect(indiceLed(25, 60, 1500)).toBe(1499); // limitado ao último LED
    expect(indiceLed(-1, 60, 1500)).toBe(0);
  });

  it('durante a pernada o ponto está aceso com a cor subaquática (vermelho)', () => {
    const ex = novoExecutor();
    ex.iniciar();
    ex.avancar(COUNTDOWN_S + 3, COUNTDOWN_S + 3); // t=3 s: pernada do 1.º percurso
    const a = ex.amostra()!;
    expect(a.fase).toBe('pernada');
    const idx = indiceLed(a.pos_abs, 60, ex.numLeds);
    const r = ex.fita[idx * 3], g = ex.fita[idx * 3 + 1];
    expect(r).toBeGreaterThan(0.9); // #ff4a3d → r≈1
    expect(r).toBeGreaterThan(g);
  });

  it('a cauda esbate atrás da direção do movimento', () => {
    const ex = novoExecutor();
    ex.iniciar();
    ex.avancar(COUNTDOWN_S + 8, COUNTDOWN_S + 8); // nado do 1.º percurso, direção +1
    const a = ex.amostra()!;
    const idx = indiceLed(a.pos_abs, 60, ex.numLeds);
    const intensidade = (i: number) => ex.fita[i * 3] + ex.fita[i * 3 + 1] + ex.fita[i * 3 + 2];
    expect(intensidade(idx)).toBeGreaterThan(intensidade(idx - 3));
    expect(intensidade(idx - 3)).toBeGreaterThan(intensidade(idx - 7));
    expect(intensidade(idx + 2)).toBe(0); // à frente da cabeça: apagado
    expect(intensidade(idx - 8)).toBe(0); // para lá da cauda: apagado
  });

  it('countdown: a fita toda pisca', () => {
    const ex = novoExecutor();
    ex.iniciar();
    ex.avancar(0.1, 0.1); // restante ≈ 4.9 → flash dos 200 ms iniciais de cada segundo
    const acesos = () => {
      let n = 0;
      for (let i = 0; i < ex.numLeds; i++) if (ex.fita[i * 3] + ex.fita[i * 3 + 1] + ex.fita[i * 3 + 2] > 0) n++;
      return n;
    };
    expect(acesos()).toBe(ex.numLeds);
    ex.avancar(0.4, 0.4); // restante ≈ 4.5 → fora do flash
    expect(acesos()).toBe(0);
  });
});
