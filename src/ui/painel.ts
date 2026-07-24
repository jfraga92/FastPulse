// Painel "ESP32": estado da máquina, botões, métricas e monitor série.

import type { ExecutorESP32 } from '../model/executor';

export class PainelESP32 {
  private readonly estadoEl = document.getElementById('estado-esp')!;
  private readonly hzEfetivoEl = document.getElementById('hz-efetivo')!;
  private readonly fpsEl = document.getElementById('fps')!;
  private readonly logEl = document.getElementById('log-esp')!;
  private readonly avisoSujoEl = document.getElementById('aviso-sujo')!;
  private readonly btnIniciar = document.getElementById('btn-iniciar') as HTMLButtonElement;
  private readonly btnParar = document.getElementById('btn-parar') as HTMLButtonElement;
  private linhasLog = 0;

  constructor(
    private readonly executor: ExecutorESP32,
    acoes: { enviar(): void; iniciar(): void; parar(): void; mudarHz(hz: number): void },
  ) {
    document.getElementById('btn-enviar')!.addEventListener('click', acoes.enviar);
    this.btnIniciar.addEventListener('click', acoes.iniciar);
    this.btnParar.addEventListener('click', acoes.parar);
    const inpHz = document.getElementById('inp-hz') as HTMLInputElement;
    inpHz.addEventListener('change', () => {
      const hz = Math.min(1000, Math.max(10, parseInt(inpHz.value, 10) || 100));
      inpHz.value = String(hz);
      acoes.mudarHz(hz);
    });
  }

  atualizar(fps: number, sujo: boolean): void {
    const ex = this.executor;
    this.estadoEl.textContent = ex.estado;
    this.estadoEl.className = `estado ${ex.estado}`;
    this.hzEfetivoEl.textContent = `${ex.hzEfetivo.toFixed(0)} Hz efetivo`;
    this.fpsEl.textContent = `${fps.toFixed(0)} fps`;
    this.avisoSujoEl.hidden = !sujo;

    this.btnIniciar.disabled = !ex.plano?.valido || ex.estado === 'COUNTDOWN' || ex.estado === 'RUNNING';
    this.btnParar.disabled = ex.estado === 'IDLE';

    if (ex.log.length !== this.linhasLog) {
      this.linhasLog = ex.log.length;
      this.logEl.textContent = ex.log.map((l) => `[${l.t.toFixed(2).padStart(8)}] ${l.msg}`).join('\n');
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
  }
}
