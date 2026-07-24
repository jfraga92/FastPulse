// Nadador virtual: cápsula low-poly com cabeça, sem animação esquelética.
// Executa o mesmo plano da lebre com um desvio, para se ver a diferença.

import * as THREE from 'three';
import type { Amostra } from '../model/tipos';
import { PROFUNDIDADE } from './piscina';

export class Nadador3D {
  readonly grupo = new THREE.Group();
  private readonly cabeca: THREE.Mesh;

  constructor() {
    const corpo = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.16, 0.85, 3, 10),
      new THREE.MeshStandardMaterial({ color: 0x27618f, roughness: 0.55 }),
    );
    corpo.rotation.z = Math.PI / 2; // deitado, eixo ao longo da piscina
    this.cabeca = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0b490, roughness: 0.6 }),
    );
    this.grupo.add(corpo, this.cabeca);
  }

  /** Posição/atitude a partir da amostra do plano do nadador. */
  atualizar(a: Amostra | null, t: number, visivel: boolean, L: number): void {
    this.grupo.visible = visivel && a !== null;
    if (!a) return;

    const dir = a.direcao;
    let x = a.pos_abs;
    let y: number;
    let inclinacao = 0;

    switch (a.fase) {
      case 'morto':
        if (a.percurso === 0) {
          // No bloco de partida, inclinado para a frente
          x = -0.35;
          y = 0.92;
          inclinacao = 0.35;
        } else {
          // Na viragem, junto à parede
          y = -0.45;
        }
        break;
      case 'voo': {
        // Arco do bloco até à entrada na água
        const p = a.fase_prog;
        y = 0.92 - 1.42 * p * p;
        inclinacao = 0.35 + 0.5 * p;
        break;
      }
      case 'deslize':
        y = -0.6 + 0.1 * a.fase_prog;
        inclinacao = 0.1 * (1 - a.fase_prog);
        break;
      case 'pernada':
        // Ondulação de golfinho
        y = -0.45 + 0.06 * Math.sin(2 * Math.PI * 2.2 * t);
        inclinacao = 0.1 * Math.sin(2 * Math.PI * 2.2 * t + 0.7);
        break;
      case 'nado':
      default:
        y = -0.13 + 0.035 * Math.sin(2 * Math.PI * 1.3 * t);
        inclinacao = 0.04 * Math.sin(2 * Math.PI * 1.3 * t + 0.5);
        break;
    }

    this.grupo.position.set(Math.min(Math.max(x, -0.5), L + 0.5), Math.max(y, -PROFUNDIDADE + 0.25), 0);
    this.grupo.rotation.z = -dir * inclinacao;
    this.cabeca.position.set(dir * 0.52, 0, 0);
  }
}
