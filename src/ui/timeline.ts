// Timeline: pausar/retomar e scrub sobre o tempo do plano.

import type { ExecutorESP32 } from '../model/executor';
import type { EstadoApp } from './estado';

export class Timeline {
  private readonly scrub = document.getElementById('scrub') as HTMLInputElement;
  private readonly btnPausa = document.getElementById('btn-pausa') as HTMLButtonElement;
  private readonly tempoLabel = document.getElementById('tempo-label')!;
  private aArrastar = false;

  constructor(private readonly estado: EstadoApp, private readonly executor: ExecutorESP32) {
    this.btnPausa.addEventListener('click', () => this.alternarPausa());
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.alternarPausa();
      }
    });

    this.scrub.addEventListener('pointerdown', () => {
      this.aArrastar = true;
      this.estado.pausado = true;
    });
    this.scrub.addEventListener('pointerup', () => { this.aArrastar = false; });
    this.scrub.addEventListener('input', () => {
      if (!this.executor.plano) return;
      this.executor.saltarPara(parseFloat(this.scrub.value));
    });
  }

  private alternarPausa(): void {
    this.estado.pausado = !this.estado.pausado;
  }

  definirTotal(total: number): void {
    this.scrub.max = total.toFixed(2);
  }

  atualizar(): void {
    const total = this.executor.plano?.total_s ?? 0;
    if (!this.aArrastar) this.scrub.value = String(this.executor.tPlano);
    this.tempoLabel.textContent = `${this.executor.tPlano.toFixed(2)} / ${total.toFixed(2)} s`;
    this.btnPausa.textContent = this.estado.pausado ? '▶' : '⏸';
  }
}
