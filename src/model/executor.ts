// Emulação do firmware ESP32: máquina de estados + atualização da fita a
// passos discretos. O relógio é o tempo do plano (não o do render).

import { hexParaRGB, limparFita, pintarCountdown, pintarPonto } from './led';
import { amostraPlano, compilarPlano, type OpcoesCompilacao } from './plano';
import type { Amostra, PlanoCompilado, PlanoJSON } from './tipos';

export type EstadoESP32 = 'IDLE' | 'COUNTDOWN' | 'RUNNING' | 'FINISHED';

export const COUNTDOWN_S = 5;

export interface LinhaLog { t: number; msg: string }

/**
 * Executor com a mesma estrutura do loop() do firmware: enviarPlano(),
 * iniciar(), parar() e avancar(dt) que consome o tempo em passos de 1/hz.
 */
export class ExecutorESP32 {
  estado: EstadoESP32 = 'IDLE';
  planoJSON: PlanoJSON | null = null;
  plano: PlanoCompilado | null = null;

  /** Tempo do plano (relógio da simulação), s. */
  tPlano = 0;
  /** Tempo restante da contagem decrescente, s. */
  tCountdown = 0;

  /** Frequência de atualização da fita, Hz (defeito 100). */
  hz = 100;

  fita: Float32Array = new Float32Array(0);
  numLeds = 0;

  log: LinhaLog[] = [];

  private acumulador = 0;
  private tReal = 0;
  private ticksJanela = 0;
  private tJanela = 0;
  /** Ticks efetivamente executados por segundo real (medido). */
  hzEfetivo = 0;

  private opcoes: OpcoesCompilacao = {};

  private registar(msg: string): void {
    this.log.push({ t: this.tReal, msg });
    if (this.log.length > 200) this.log.shift();
  }

  /** Carrega e valida um plano (equivale ao upload por Wi-Fi no ESP32 real). */
  enviarPlano(json: PlanoJSON, opcoes: OpcoesCompilacao = {}): PlanoCompilado {
    const compilado = compilarPlano(json, opcoes);
    if (!compilado.valido) {
      this.registar(`plano "${json.nome}" REJEITADO (${compilado.problemas.filter((p) => p.nivel === 'erro').length} erros)`);
      return compilado;
    }
    this.opcoes = opcoes;
    this.planoJSON = json;
    this.plano = compilado;
    this.numLeds = Math.round(json.piscina_m * json.leds_por_metro);
    this.fita = new Float32Array(this.numLeds * 3);
    this.pararInterno();
    const avisos = compilado.problemas.filter((p) => p.nivel === 'aviso').length;
    this.registar(
      `plano "${json.nome}" carregado: ${json.percursos.length} percursos, ` +
      `${compilado.total_s.toFixed(1)} s, ${this.numLeds} LEDs` + (avisos ? `, ${avisos} avisos` : ''),
    );
    return compilado;
  }

  iniciar(): void {
    if (!this.plano || !this.plano.valido) {
      this.registar('iniciar ignorado: sem plano válido');
      return;
    }
    if (this.estado === 'COUNTDOWN' || this.estado === 'RUNNING') return;
    this.tPlano = 0;
    this.tCountdown = COUNTDOWN_S;
    this.estado = 'COUNTDOWN';
    this.registar(`COUNTDOWN ${COUNTDOWN_S} s`);
    this.repintar();
  }

  /** Botão físico de paragem. */
  parar(): void {
    this.pararInterno();
    this.registar('PARADO → IDLE');
  }

  private pararInterno(): void {
    this.estado = 'IDLE';
    this.tPlano = 0;
    this.tCountdown = 0;
    this.acumulador = 0;
    limparFita(this.fita);
  }

  /** Salta para um instante do plano (scrub na timeline — só no simulador). */
  saltarPara(t: number): void {
    if (!this.plano) return;
    this.tPlano = Math.min(Math.max(t, 0), this.plano.total_s);
    this.tCountdown = 0;
    this.acumulador = 0;
    this.estado = this.tPlano >= this.plano.total_s ? 'FINISHED' : 'RUNNING';
    this.repintar();
  }

  /**
   * Avança o tempo de simulação `dtSim` em passos discretos de 1/hz.
   * `dtReal` (tempo real decorrido) serve só para medir o Hz efetivo.
   */
  avancar(dtSim: number, dtReal: number): void {
    this.tReal += dtReal;
    this.tJanela += dtReal;
    if (this.estado === 'COUNTDOWN' || this.estado === 'RUNNING') {
      this.acumulador += dtSim;
      const passo = 1 / this.hz;
      // Guarda de vírgula flutuante: sem ela, floor(1/0.01) pode dar 99 ticks.
      let restantes = Math.floor(this.acumulador * this.hz + 1e-6);
      this.acumulador -= restantes * passo;
      while (restantes-- > 0) {
        this.tick(passo);
        this.ticksJanela++;
      }
    }
    if (this.tJanela >= 0.5) {
      this.hzEfetivo = this.ticksJanela / this.tJanela;
      this.ticksJanela = 0;
      this.tJanela = 0;
    }
  }

  /** Um passo discreto do firmware: avança o relógio e repinta a fita. */
  private tick(passo: number): void {
    if (this.estado === 'COUNTDOWN') {
      this.tCountdown -= passo;
      if (this.tCountdown <= 0) {
        // O excedente do último passo entra já no tempo do plano.
        this.tPlano = -this.tCountdown;
        this.tCountdown = 0;
        this.estado = 'RUNNING';
        this.registar('RUNNING');
      }
    } else if (this.estado === 'RUNNING') {
      this.tPlano += passo;
      if (this.plano && this.tPlano >= this.plano.total_s) {
        this.tPlano = this.plano.total_s;
        this.estado = 'FINISHED';
        this.registar(`FINISHED aos ${this.plano.total_s.toFixed(2)} s`);
      }
    }
    this.repintar();
  }

  /** Estado instantâneo do ponto (para o HUD e para a cena). */
  amostra(): Amostra | null {
    if (!this.plano) return null;
    return amostraPlano(this.plano, this.tPlano);
  }

  /** Recalcula o buffer da fita a partir do estado atual. */
  repintar(): void {
    if (!this.planoJSON || !this.plano) return;
    const pj = this.planoJSON;
    limparFita(this.fita);
    if (this.estado === 'COUNTDOWN') {
      pintarCountdown(this.fita, this.numLeds, this.tCountdown, hexParaRGB(pj.cor_superficie));
      return;
    }
    if (this.estado === 'RUNNING' || this.estado === 'FINISHED') {
      const a = amostraPlano(this.plano, this.tPlano);
      const cor = hexParaRGB(a.subaquatico ? pj.cor_subaquatico : pj.cor_superficie);
      pintarPonto(this.fita, this.numLeds, pj.leds_por_metro, a, cor, pj.ponto_leds);
    }
  }

  get opcoesAtuais(): OpcoesCompilacao {
    return this.opcoes;
  }
}
