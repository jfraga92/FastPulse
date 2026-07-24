// Estado partilhado da aplicação (o "rascunho" do treinador + opções da
// simulação) com um pub/sub mínimo.

import type { PlanoJSON } from '../model/tipos';
import type { NomeCamara } from '../scene/camaras';

export type EventoEstado = 'plano' | 'sim' | 'camara';

export class EstadoApp {
  /** Rascunho editável — só chega ao "ESP32" quando se carrega em Enviar. */
  plano: PlanoJSON;

  velocidade = 1;
  modoConstante = false;
  nadadorVisivel = true;
  desvio_s = 0.3;
  camara: NomeCamara = 'bancada';
  pausado = false;

  private ouvintes = new Map<EventoEstado, Set<() => void>>();

  constructor(planoInicial: PlanoJSON) {
    this.plano = planoInicial;
  }

  on(evento: EventoEstado, cb: () => void): void {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, new Set());
    this.ouvintes.get(evento)!.add(cb);
  }

  emitir(evento: EventoEstado): void {
    for (const cb of this.ouvintes.get(evento) ?? []) cb();
  }
}
