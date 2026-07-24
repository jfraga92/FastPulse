// Compilação do plano completo e sampler global tempo → posição absoluta.

import { amostraPercurso, compilarPercurso, EPS } from './fases';
import type { Amostra, PercursoJSON, PlanoCompilado, PlanoJSON, Problema } from './tipos';

export interface OpcoesCompilacao {
  /** Força v_pico = v_pernada = v_nado (percurso a velocidade constante). */
  modoConstante?: boolean;
}

/**
 * No modo "velocidade constante" cada percurso nada todo o trajeto pós-voo a
 * v = (L − voo_m)/(parcial − morto − voo_s); com v_pico = v_pernada = v o
 * fecho dá v_nado = v e o percurso fecha exatamente no mesmo parcial.
 */
export function percursoConstante(p: PercursoJSON, L: number, primeiro: boolean): PercursoJSON {
  const voo_m = primeiro ? (p.voo_m ?? 0) : 0;
  const voo_s = primeiro ? (p.voo_s ?? 0) : 0;
  const tAgua = p.parcial_s - p.morto_s - voo_s;
  if (tAgua <= EPS) return p; // inválido — a compilação normal sinaliza o erro
  const v = (L - voo_m) / tAgua;
  return { ...p, v_pico: v, v_pernada: v };
}

export function compilarPlano(plano: PlanoJSON, opcoes: OpcoesCompilacao = {}): PlanoCompilado {
  const problemas: Problema[] = [];
  const L = plano.piscina_m;
  if (!(L > 0)) problemas.push({ nivel: 'erro', msg: 'piscina_m tem de ser > 0' });
  if (!plano.percursos || plano.percursos.length === 0) {
    problemas.push({ nivel: 'erro', msg: 'o plano não tem percursos' });
  }

  const percursos = (plano.percursos ?? []).map((p, i) => {
    const primeiro = i === 0;
    const pj = opcoes.modoConstante ? percursoConstante(p, L, primeiro) : p;
    const pc = compilarPercurso(pj, L, primeiro);
    for (const q of pc.problemas) {
      problemas.push({ nivel: q.nivel, msg: `percurso ${i + 1}: ${q.msg}` });
    }
    return pc;
  });

  const inicio_s: number[] = [];
  let total = 0;
  for (const pc of percursos) {
    inicio_s.push(total);
    total += pc.dur;
  }

  return {
    L,
    percursos,
    inicio_s,
    total_s: total,
    problemas,
    valido: !problemas.some((q) => q.nivel === 'erro'),
  };
}

/** Direção do percurso: ímpares (1-based) vão A→B (+1), pares regressam (−1). */
export function direcaoPercurso(indice: number): 1 | -1 {
  return indice % 2 === 0 ? 1 : -1;
}

/**
 * Estado do ponto no instante global t (segundos desde o início do plano).
 * t é limitado a [0, total_s]; depois do fim devolve o ponto parado na
 * parede de chegada do último percurso, com terminou = true.
 */
export function amostraPlano(pl: PlanoCompilado, t: number): Amostra {
  const n = pl.percursos.length;
  const tc = Math.min(Math.max(t, 0), pl.total_s);
  const terminou = t >= pl.total_s - EPS;

  // Percurso ativo: o último cujo início é ≤ tc (varrimento linear, n é pequeno).
  let i = 0;
  for (let k = 0; k < n; k++) {
    if (tc >= pl.inicio_s[k] - EPS) i = k;
  }
  const pc = pl.percursos[i];
  const tau = Math.min(tc - pl.inicio_s[i], pc.dur);
  const { pos, v, fase } = amostraPercurso(pc, tau);

  const direcao = direcaoPercurso(i);
  const pos_rel = Math.min(pos, pl.L);
  const pos_abs = direcao > 0 ? pos_rel : pl.L - pos_rel;

  return {
    t: tc,
    percurso: i,
    fase: fase.tipo,
    direcao,
    pos_rel,
    pos_abs,
    dist_cum: i * pl.L + pos_rel,
    v: terminou ? 0 : v,
    subaquatico: fase.subaquatico,
    terminou,
  };
}

/** Validação estrutural de um JSON importado (contrato com o firmware). */
export function validarPlanoJSON(obj: unknown): { plano?: PlanoJSON; erros: string[] } {
  const erros: string[] = [];
  if (typeof obj !== 'object' || obj === null) return { erros: ['JSON inválido: esperado um objeto'] };
  const o = obj as Record<string, unknown>;

  const num = (campo: string): number => {
    const v = o[campo];
    if (typeof v !== 'number' || !isFinite(v)) erros.push(`campo "${campo}" em falta ou não numérico`);
    return v as number;
  };
  const nome = typeof o.nome === 'string' ? o.nome : 'Plano importado';
  const piscina_m = num('piscina_m');
  const leds_por_metro = num('leds_por_metro');
  const ponto_leds = num('ponto_leds');
  const cor_superficie = typeof o.cor_superficie === 'string' ? o.cor_superficie : '#24d3c4';
  const cor_subaquatico = typeof o.cor_subaquatico === 'string' ? o.cor_subaquatico : '#ff4a3d';

  if (!Array.isArray(o.percursos) || o.percursos.length === 0) {
    erros.push('campo "percursos" em falta ou vazio');
    return { erros };
  }
  const percursos: PercursoJSON[] = [];
  o.percursos.forEach((p, i) => {
    if (typeof p !== 'object' || p === null) {
      erros.push(`percurso ${i + 1}: esperado um objeto`);
      return;
    }
    const q = p as Record<string, unknown>;
    for (const campo of ['parcial_s', 'sub_m', 'morto_s', 'v_pico', 'v_pernada', 'deslize_m']) {
      if (typeof q[campo] !== 'number' || !isFinite(q[campo] as number)) {
        erros.push(`percurso ${i + 1}: campo "${campo}" em falta ou não numérico`);
      }
    }
    percursos.push(q as unknown as PercursoJSON);
  });

  if (erros.length > 0) return { erros };
  return {
    plano: { nome, piscina_m, leds_por_metro, ponto_leds, cor_superficie, cor_subaquatico, percursos },
    erros,
  };
}
