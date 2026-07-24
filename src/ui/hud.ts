// HUD sobreposto à vista 3D + contagem decrescente central.

import type { ExecutorESP32 } from '../model/executor';
import type { Amostra } from '../model/tipos';

const NOME_FASE: Record<string, string> = {
  morto: 'MORTO',
  voo: 'VOO',
  deslize: 'DESLIZE',
  pernada: 'PERNADA',
  nado: 'NADO',
};

export class Hud {
  private readonly hudEl = document.getElementById('hud')!;
  private readonly contagemEl = document.getElementById('contagem')!;

  atualizar(executor: ExecutorESP32, lebre: Amostra | null, nadador: Amostra | null): void {
    if (!lebre || !executor.plano) {
      this.hudEl.textContent = 'Sem plano carregado';
      this.contagemEl.textContent = '';
      return;
    }

    const n = executor.plano.percursos.length;
    const corFase = lebre.subaquatico
      ? executor.planoJSON!.cor_subaquatico
      : executor.planoJSON!.cor_superficie;
    const delta = nadador ? lebre.dist_cum - nadador.dist_cum : null;

    const linhas = [
      `<span class="rotulo">tempo     </span>${lebre.t.toFixed(2).padStart(7)} s`,
      `<span class="rotulo">percurso  </span>${lebre.percurso + 1}/${n} ${lebre.direcao > 0 ? '→' : '←'}`,
      `<span class="rotulo">fase      </span><span class="fase" style="color:${corFase}">${NOME_FASE[lebre.fase]}</span>`,
      `<span class="rotulo">v ponto   </span>${lebre.v.toFixed(2).padStart(5)} m/s`,
      `<span class="rotulo">posição   </span>${lebre.pos_abs.toFixed(1).padStart(5)} m`,
    ];
    if (delta !== null) {
      linhas.push(`<span class="rotulo">Δ lebre   </span>${delta >= 0 ? '+' : ''}${delta.toFixed(1)} m`);
    }
    this.hudEl.innerHTML = linhas.join('\n');

    if (executor.estado === 'COUNTDOWN') {
      this.contagemEl.textContent = String(Math.ceil(executor.tCountdown));
    } else if (executor.estado === 'RUNNING' && executor.tPlano < 0.8) {
      this.contagemEl.textContent = 'PARTIDA!';
    } else if (executor.estado === 'FINISHED') {
      this.contagemEl.textContent = 'TERMINADO';
    } else {
      this.contagemEl.textContent = '';
    }
  }
}
