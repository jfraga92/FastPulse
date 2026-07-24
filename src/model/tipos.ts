// Tipos do modelo de ritmo. Este ficheiro define o CONTRATO JSON com o
// firmware ESP32 — os nomes e unidades têm de se manter estáveis.

/** Um percurso (lap) tal como viaja no JSON para o ESP32. Unidades SI: m, s, m/s. */
export interface PercursoJSON {
  /** Tempo total do percurso (parcial), em segundos. */
  parcial_s: number;
  /** Distância total submersa desde a entrada na água (deslize + pernada), em metros. */
  sub_m: number;
  /** Tempo morto na parede: reação no bloco (1.º) ou rotação na viragem, em segundos. */
  morto_s: number;
  /** Velocidade no instante de entrada/impulso, início do deslize, em m/s. */
  v_pico: number;
  /** Velocidade da pernada subaquática (fim do deslize), em m/s. */
  v_pernada: number;
  /** Distância do deslize (decaimento de v_pico até v_pernada), em metros. */
  deslize_m: number;
  /** Distância do voo do bloco até à entrada na água — SÓ no 1.º percurso. */
  voo_m?: number;
  /** Duração do voo — SÓ no 1.º percurso. */
  voo_s?: number;
}

/** Plano completo — o mesmo JSON que será enviado ao ESP32 real. */
export interface PlanoJSON {
  nome: string;
  piscina_m: number;
  leds_por_metro: number;
  ponto_leds: number;
  cor_superficie: string;
  cor_subaquatico: string;
  percursos: PercursoJSON[];
}

export type TipoFase = 'morto' | 'voo' | 'deslize' | 'pernada' | 'nado';

/**
 * Fase compilada, pronta a avaliar. `t0`/`pos0` são relativos ao início do
 * percurso (pos medida da parede de partida desse percurso, sempre crescente).
 */
export interface Fase {
  tipo: TipoFase;
  /** Instante de início da fase dentro do percurso, s. */
  t0: number;
  /** Duração da fase, s. */
  dur: number;
  /** Posição no início da fase, m (relativa à parede de partida do percurso). */
  pos0: number;
  /** Distância percorrida na fase, m. */
  dist: number;
  /** true ⇒ o ponto usa a cor subaquática. */
  subaquatico: boolean;
  /** Velocidade constante da fase (morto=0). No deslize é v_pico (inicial). */
  v: number;
  /** Só no deslize: b = (v_pernada − v_pico) / deslize_m, tal que v(τ) = v_pico·e^(b·τ). */
  b: number;
}

export interface Problema {
  /** 'erro' impede a execução; 'aviso' é suspeito mas executável. */
  nivel: 'erro' | 'aviso';
  msg: string;
}

/** Percurso compilado: fases + grandezas derivadas para a UI. */
export interface PercursoCompilado {
  fases: Fase[];
  /** Duração total (= parcial_s quando válido), s. */
  dur: number;
  t_deslize: number;
  t_pernada: number;
  t_nado: number;
  v_nado: number;
  problemas: Problema[];
}

/** Plano compilado, com tempos de início acumulados por percurso. */
export interface PlanoCompilado {
  L: number;
  percursos: PercursoCompilado[];
  /** Instante global de início de cada percurso, s. */
  inicio_s: number[];
  /** Duração total do plano, s. */
  total_s: number;
  problemas: Problema[];
  valido: boolean;
}

/** Estado instantâneo do ponto luminoso (saída do sampler). */
export interface Amostra {
  t: number;
  /** Índice do percurso (0-based). */
  percurso: number;
  fase: TipoFase;
  /** +1 = parede A→B (percursos ímpares, 1-based); −1 = B→A. */
  direcao: 1 | -1;
  /** Posição relativa dentro do percurso, 0..L, m. */
  pos_rel: number;
  /** Posição absoluta na piscina (0 = parede A), m. */
  pos_abs: number;
  /** Distância acumulada desde o início do plano, m. */
  dist_cum: number;
  /** Velocidade instantânea, m/s. */
  v: number;
  subaquatico: boolean;
  terminou: boolean;
}
