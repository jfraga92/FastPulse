// Fita LED no fundo: um InstancedMesh com um LED por instância.
// As cores vêm do buffer do executor (o "firmware"); aqui aplica-se apenas
// a física da água: atenuação por canal com a distância à câmara.

import * as THREE from 'three';
import { PROFUNDIDADE } from './piscina';

// Coeficientes de absorção da água (por metro). O vermelho morre depressa —
// é exatamente isto que queremos avaliar na vista do atleta.
const ABSORCAO_R = 0.42;
const ABSORCAO_G = 0.062;
const ABSORCAO_B = 0.045;

// Multiplicador HDR: >1 para os LEDs acesos passarem o threshold do bloom.
const BRILHO = 4.0;

const COR_APAGADO = { r: 0.018, g: 0.026, b: 0.034 };

function texturaHalo(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export class Fita3D {
  readonly grupo = new THREE.Group();

  private mesh: THREE.InstancedMesh | null = null;
  private geo: THREE.SphereGeometry | null = null;
  private mat: THREE.MeshBasicMaterial | null = null;
  private xs: Float32Array = new Float32Array(0);
  private numLeds = 0;
  private readonly cor = new THREE.Color();
  private readonly y = -PROFUNDIDADE + 0.02;

  // Halo difuso da mangueira opalina no LED de cabeça: sem ele o ponto é
  // sub-pixel visto da bancada/treinador.
  private readonly halo: THREE.Sprite;

  constructor() {
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaHalo(),
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    }));
    this.halo.scale.set(0.6, 0.6, 1);
    this.halo.renderOrder = 8;
    this.halo.visible = false;
    this.grupo.add(this.halo);
  }

  construir(numLeds: number, ledsPorMetro: number): void {
    if (this.mesh) {
      this.grupo.remove(this.mesh);
      this.geo?.dispose();
      this.mat?.dispose();
    }
    this.numLeds = numLeds;
    // Esferas: visíveis em ângulo rasante (vista do atleta). O raio aproxima
    // o halo da mangueira opalina, não o LED nu — senão é sub-pixel ao longe.
    this.geo = new THREE.SphereGeometry(0.02, 8, 6);
    this.mat = new THREE.MeshBasicMaterial({ toneMapped: true, fog: false });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, numLeds);
    this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.xs = new Float32Array(numLeds);
    const m = new THREE.Matrix4();
    for (let i = 0; i < numLeds; i++) {
      const x = i / ledsPorMetro;
      this.xs[i] = x;
      m.setPosition(x, this.y, 0);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, this.cor.setRGB(COR_APAGADO.r, COR_APAGADO.g, COR_APAGADO.b));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.grupo.add(this.mesh);
  }

  /**
   * Copia o buffer do firmware para as instâncias, aplicando a absorção
   * espectral da água no caminho LED→câmara. Fora de água usa-se apenas o
   * percurso vertical até à superfície (~profundidade).
   */
  sincronizar(fita: Float32Array, camara: THREE.PerspectiveCamera): void {
    if (!this.mesh || this.mesh.count !== this.numLeds) return;
    const submersa = camara.position.y < 0;
    const cx = camara.position.x;
    const cy = camara.position.y;
    const cz = camara.position.z;
    const atributo = this.mesh.instanceColor!;
    const arr = atributo.array as Float32Array;

    let acesos = 0;
    let cabecaIdx = -1;
    let cabecaInt = 0;
    for (let i = 0; i < this.numLeds; i++) {
      const r = fita[i * 3];
      const g = fita[i * 3 + 1];
      const b = fita[i * 3 + 2];
      const o = i * 3;
      if (r + g + b <= 0) {
        arr[o] = COR_APAGADO.r;
        arr[o + 1] = COR_APAGADO.g;
        arr[o + 2] = COR_APAGADO.b;
        continue;
      }
      acesos++;
      if (r + g + b > cabecaInt) {
        cabecaInt = r + g + b;
        cabecaIdx = i;
      }
      let dAgua: number;
      if (submersa) {
        const dx = this.xs[i] - cx;
        const dy = this.y - cy;
        const dz = -cz;
        dAgua = Math.sqrt(dx * dx + dy * dy + dz * dz);
      } else {
        dAgua = PROFUNDIDADE;
      }
      arr[o] = r * BRILHO * Math.exp(-ABSORCAO_R * dAgua);
      arr[o + 1] = g * BRILHO * Math.exp(-ABSORCAO_G * dAgua);
      arr[o + 2] = b * BRILHO * Math.exp(-ABSORCAO_B * dAgua);
    }
    atributo.needsUpdate = true;

    // Halo só quando há um "ponto" (no countdown a fita inteira acende) e a
    // câmara está longe — ao perto as esferas com bloom chegam, e o halo
    // gigante em primeiro plano só atrapalharia.
    let dCam = 0;
    if (cabecaIdx >= 0) {
      const dx = this.xs[cabecaIdx] - cx;
      const dy = this.y - cy;
      const dz = -cz;
      dCam = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    const éPonto = cabecaIdx >= 0 && acesos <= Math.max(this.numLeds * 0.05, 16) && dCam > 4;
    this.halo.visible = éPonto;
    if (éPonto) {
      const o = cabecaIdx * 3;
      // Acima do fundo (coluna de luz difusa na água): o disco nunca corta o
      // chão e é ocluído corretamente pelo cais e pelas paredes.
      this.halo.position.set(this.xs[cabecaIdx], this.y + 0.35, 0);
      // Normalizar pelo canal máximo preserva a tonalidade (um clamp por
      // canal tornava o vermelho saturado em branco).
      const escala = 1 / Math.max(1, arr[o], arr[o + 1], arr[o + 2]);
      this.halo.material.color.setRGB(arr[o] * escala, arr[o + 1] * escala, arr[o + 2] * escala);
    }
  }
}
