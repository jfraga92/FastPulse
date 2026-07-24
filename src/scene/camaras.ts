// As três câmaras: Bancada (órbita livre), Treinador (fixa na borda) e
// Atleta (subaquática, a seguir o nadador — a vista que valida a leitura do ponto).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Amostra } from '../model/tipos';
import { PROFUNDIDADE } from './piscina';

export type NomeCamara = 'bancada' | 'treinador' | 'atleta';

export class Camaras {
  ativa: NomeCamara = 'bancada';

  private readonly bancada: THREE.PerspectiveCamera;
  private readonly treinador: THREE.PerspectiveCamera;
  private readonly atleta: THREE.PerspectiveCamera;
  private readonly controlos: OrbitControls;
  private L = 25;
  private xAtleta = 2;
  private xOlharTreinador = 10;

  /** `superficieControlo` deve ser o canvas do renderer — usar o contentor
   *  faria os OrbitControls capturar os cliques dos botões sobrepostos. */
  constructor(container: HTMLElement, superficieControlo: HTMLElement) {
    const aspeto = container.clientWidth / Math.max(container.clientHeight, 1);
    this.bancada = new THREE.PerspectiveCamera(50, aspeto, 0.05, 300);
    this.treinador = new THREE.PerspectiveCamera(60, aspeto, 0.05, 300);
    this.atleta = new THREE.PerspectiveCamera(88, aspeto, 0.05, 300);
    this.controlos = new OrbitControls(this.bancada, superficieControlo);
    this.controlos.enableDamping = true;
    this.controlos.maxPolarAngle = Math.PI * 0.52;
    this.configurar(25);
  }

  configurar(L: number): void {
    this.L = L;
    // Diagonal sobre a zona de partida, a olhar ao longo da pista: mostra a
    // perspetiva toda sem gastar meio ecrã em cais.
    this.bancada.position.set(-L * 0.14, L * 0.26, L * 0.34);
    this.controlos.target.set(L * 0.36, -1, 0);
    this.controlos.update();
    this.treinador.position.set(0.4, 1.75, 1.9);
    this.treinador.lookAt(L * 0.4, -0.6, 0);
    this.xAtleta = 2;
    this.xOlharTreinador = L * 0.4;
  }

  ativar(nome: NomeCamara): void {
    this.ativa = nome;
    this.controlos.enabled = nome === 'bancada';
  }

  get camara(): THREE.PerspectiveCamera {
    if (this.ativa === 'treinador') return this.treinador;
    if (this.ativa === 'atleta') return this.atleta;
    return this.bancada;
  }

  /**
   * `aNadador`: amostra do plano do nadador (a câmara do atleta segue-o);
   * `aLebre`: amostra do ponto (o treinador segue-o com o olhar).
   * A câmara do atleta vai ~40 cm acima do fundo, a olhar para baixo/frente.
   */
  atualizar(dt: number, aNadador: Amostra | null, aLebre: Amostra | null, t: number): void {
    if (this.ativa === 'bancada') this.controlos.update();

    if (aLebre) {
      this.xOlharTreinador += (aLebre.pos_abs - this.xOlharTreinador) * Math.min(1, dt * 4);
      this.treinador.lookAt(this.xOlharTreinador, -0.6, 0);
    }

    if (!aNadador) return;
    const dir = aNadador.direcao;
    // O olho fica ~45 cm atrás da posição do modelo (mãos/cabeça): nas fases
    // submersas a lebre coincide com o nadador e tem de aparecer à frente do
    // olho, não exatamente por baixo dele.
    const alvoX = Math.min(Math.max(aNadador.pos_abs - dir * 0.45, 0.6), this.L - 0.6);
    // Perseguição suave, independente do frame rate
    this.xAtleta += (alvoX - this.xAtleta) * Math.min(1, dt * 9);

    const balancoZ = 0.05 * Math.sin(t * 2.1);
    this.atleta.position.set(this.xAtleta, -PROFUNDIDADE + 0.4, 0.15 + balancoZ);
    // Olhar para baixo/frente como no crol
    this.atleta.lookAt(this.xAtleta + dir * 1.3, -PROFUNDIDADE - 0.5, 0);
    this.atleta.rotateZ(0.05 * Math.sin(t * 2.3 + 1.2));
  }

  resize(aspeto: number): void {
    for (const c of [this.bancada, this.treinador, this.atleta]) {
      c.aspect = aspeto;
      c.updateProjectionMatrix();
    }
  }
}
