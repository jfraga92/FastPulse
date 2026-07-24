// Geometria da pista: azulejos com linha preta e marcas em T, paredes,
// água com ondulação ligeira, cordas (linhas de água), bandeirolas dos 5 m,
// cais e bloco de partida. Tudo estático e barato (sem sombras dinâmicas).

import * as THREE from 'three';

export const LARGURA_PISTA = 2.5;
export const PROFUNDIDADE = 2;

const PX_POR_M = 64;

function texturaCanvas(desenhar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  desenhar(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function desenharAzulejos(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#cde6ef';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#9cc2d2';
  ctx.lineWidth = 2;
  const passo = 0.25 * PX_POR_M;
  for (let x = 0; x <= w; x += passo) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += passo) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

/** Fundo da pista: azulejos + linha preta central com marca em T a 2 m das paredes. */
function texturaFundo(L: number): THREE.CanvasTexture {
  const w = L * PX_POR_M;
  const h = LARGURA_PISTA * PX_POR_M;
  return texturaCanvas((ctx) => {
    desenharAzulejos(ctx, w, h);
    ctx.fillStyle = '#12181c';
    const larguraLinha = 0.25 * PX_POR_M;
    const inicio = 2 * PX_POR_M;
    ctx.fillRect(inicio, h / 2 - larguraLinha / 2, w - 2 * inicio, larguraLinha);
    // Marcas em T: travessão de 1 m a 2 m de cada parede
    const travessao = 1 * PX_POR_M;
    ctx.fillRect(inicio - larguraLinha / 2, h / 2 - travessao / 2, larguraLinha, travessao);
    ctx.fillRect(w - inicio - larguraLinha / 2, h / 2 - travessao / 2, larguraLinha, travessao);
  }, w, h);
}

/** Parede de topo: azulejos + alvo em cruz (continuação da marca em T). */
function texturaParedeTopo(): THREE.CanvasTexture {
  const w = LARGURA_PISTA * PX_POR_M;
  const h = (PROFUNDIDADE + 0.12) * PX_POR_M;
  return texturaCanvas((ctx) => {
    desenharAzulejos(ctx, w, h);
    ctx.fillStyle = '#12181c';
    const larguraLinha = 0.25 * PX_POR_M;
    ctx.fillRect(w / 2 - larguraLinha / 2, 0.3 * PX_POR_M, larguraLinha, h);
    ctx.fillRect(w / 2 - (1 * PX_POR_M) / 2, (0.3 + 0.5) * PX_POR_M, 1 * PX_POR_M, larguraLinha);
  }, w, h);
}

export class Piscina {
  readonly grupo = new THREE.Group();

  private agua: THREE.Mesh | null = null;
  private aguaBase: Float32Array | null = null;
  private descartaveis: Array<{ dispose(): void }> = [];

  private guardar<T extends { dispose(): void }>(r: T): T {
    this.descartaveis.push(r);
    return r;
  }

  construir(L: number): void {
    for (const d of this.descartaveis) d.dispose();
    this.descartaveis = [];
    this.grupo.clear();
    const meia = LARGURA_PISTA / 2;

    // Fundo com linha preta e marcas em T
    const texFundo = this.guardar(texturaFundo(L));
    const fundo = new THREE.Mesh(
      this.guardar(new THREE.PlaneGeometry(L, LARGURA_PISTA)),
      this.guardar(new THREE.MeshStandardMaterial({ map: texFundo, roughness: 0.85 })),
    );
    fundo.rotation.x = -Math.PI / 2;
    fundo.position.set(L / 2, -PROFUNDIDADE, 0);
    this.grupo.add(fundo);

    // Paredes de topo (partida e viragem) com alvo em T
    const texTopo = this.guardar(texturaParedeTopo());
    const matTopo = this.guardar(new THREE.MeshStandardMaterial({ map: texTopo, roughness: 0.85, side: THREE.DoubleSide }));
    const geoTopo = this.guardar(new THREE.PlaneGeometry(LARGURA_PISTA, PROFUNDIDADE + 0.12));
    const paredeA = new THREE.Mesh(geoTopo, matTopo);
    paredeA.rotation.y = Math.PI / 2;
    // Topo da parede ao nível do cais (y = 0.12), fundo a −PROFUNDIDADE.
    paredeA.position.set(0, 0.12 - (PROFUNDIDADE + 0.12) / 2, 0);
    const paredeB = new THREE.Mesh(geoTopo, matTopo);
    paredeB.rotation.y = -Math.PI / 2;
    paredeB.position.set(L, 0.12 - (PROFUNDIDADE + 0.12) / 2, 0);
    this.grupo.add(paredeA, paredeB);

    // Paredes laterais em azulejo simples
    const texLateral = this.guardar(texturaCanvas(desenharAzulejos, 256, 256));
    texLateral.wrapS = texLateral.wrapT = THREE.RepeatWrapping;
    texLateral.repeat.set(L / 4, (PROFUNDIDADE + 0.12) / 4);
    const matLateral = this.guardar(new THREE.MeshStandardMaterial({ map: texLateral, roughness: 0.85, side: THREE.DoubleSide }));
    const geoLateral = this.guardar(new THREE.PlaneGeometry(L, PROFUNDIDADE + 0.12));
    const lateralPerto = new THREE.Mesh(geoLateral, matLateral);
    lateralPerto.position.set(L / 2, 0.12 - (PROFUNDIDADE + 0.12) / 2, -meia);
    const lateralLonge = new THREE.Mesh(geoLateral, matLateral);
    lateralLonge.rotation.y = Math.PI;
    lateralLonge.position.set(L / 2, 0.12 - (PROFUNDIDADE + 0.12) / 2, meia);
    this.grupo.add(lateralPerto, lateralLonge);

    // Água: plano translúcido com ondulação ligeira (desenhado por cima dos LEDs)
    const geoAgua = this.guardar(new THREE.PlaneGeometry(L, LARGURA_PISTA, 96, 8));
    // Roughness alto: um brilho especular focado rebentava no bloom e
    // parecia um projetor pousado na água.
    const matAgua = this.guardar(new THREE.MeshStandardMaterial({
      color: 0x4fb3d4,
      transparent: true,
      opacity: 0.32,
      roughness: 0.5,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    this.agua = new THREE.Mesh(geoAgua, matAgua);
    this.agua.rotation.x = -Math.PI / 2;
    this.agua.position.set(L / 2, 0, 0);
    this.agua.renderOrder = 5;
    this.aguaBase = new Float32Array(geoAgua.attributes.position.array);
    this.grupo.add(this.agua);

    // Cordas (linhas de água) de cada lado, com boias instanciadas
    const nBoias = Math.floor(L / 0.11);
    const geoBoia = this.guardar(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8));
    geoBoia.rotateZ(Math.PI / 2);
    const matBoia = this.guardar(new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    const cores = { vermelho: new THREE.Color('#c93636'), amarelo: new THREE.Color('#e6c53a'), azul: new THREE.Color('#2e6fb8') };
    for (const lado of [-1, 1]) {
      const boias = new THREE.InstancedMesh(geoBoia, matBoia, nBoias);
      const m = new THREE.Matrix4();
      for (let i = 0; i < nBoias; i++) {
        const x = 0.055 + i * 0.11;
        m.setPosition(x, 0.01, lado * meia);
        boias.setMatrixAt(i, m);
        const cor = x < 5 || x > L - 5 ? cores.vermelho : (Math.floor(x) % 2 === 0 ? cores.amarelo : cores.azul);
        boias.setColorAt(i, cor);
      }
      boias.instanceMatrix.needsUpdate = true;
      this.grupo.add(boias);
    }

    // Bandeirolas dos 5 m (de cada parede)
    const matFio = this.guardar(new THREE.MeshBasicMaterial({ color: 0x8899aa }));
    const geoFio = this.guardar(new THREE.CylinderGeometry(0.008, 0.008, LARGURA_PISTA + 1.6, 6));
    geoFio.rotateX(Math.PI / 2);
    const matBandeiraA = this.guardar(new THREE.MeshStandardMaterial({ color: 0xd23c3c, side: THREE.DoubleSide, roughness: 0.8 }));
    const matBandeiraB = this.guardar(new THREE.MeshStandardMaterial({ color: 0xe8e8e8, side: THREE.DoubleSide, roughness: 0.8 }));
    const geoBandeira = this.guardar(new THREE.BufferGeometry());
    geoBandeira.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.09, 0, 0, 0.09, 0, -0.3, 0], 3));
    geoBandeira.computeVertexNormals();
    for (const xFio of [5, L - 5]) {
      const fio = new THREE.Mesh(geoFio, matFio);
      fio.position.set(xFio, 1.9, 0);
      this.grupo.add(fio);
      for (let i = 0; i < 15; i++) {
        const z = -1.68 + i * 0.24;
        const bandeira = new THREE.Mesh(geoBandeira, i % 2 === 0 ? matBandeiraA : matBandeiraB);
        bandeira.position.set(xFio, 1.9, z);
        this.grupo.add(bandeira);
      }
    }

    // Cais em volta (ao nível da água, como numa piscina de competição — um
    // parapeito alto esconderia o fundo às câmaras exteriores) e bloco de partida
    const matCais = this.guardar(new THREE.MeshStandardMaterial({ color: 0x39444d, roughness: 0.95 }));
    const geoCaisLado = this.guardar(new THREE.BoxGeometry(L + 8, 0.24, 2.6));
    for (const lado of [-1, 1]) {
      const cais = new THREE.Mesh(geoCaisLado, matCais);
      cais.position.set(L / 2, 0, lado * (meia + 1.3));
      this.grupo.add(cais);
    }
    const geoCaisTopo = this.guardar(new THREE.BoxGeometry(4, 0.24, LARGURA_PISTA + 0.02));
    const caisA = new THREE.Mesh(geoCaisTopo, matCais);
    caisA.position.set(-2, 0, 0);
    const caisB = new THREE.Mesh(geoCaisTopo, matCais);
    caisB.position.set(L + 2, 0, 0);
    this.grupo.add(caisA, caisB);

    const bloco = new THREE.Mesh(
      this.guardar(new THREE.BoxGeometry(0.65, 0.5, 0.6)),
      this.guardar(new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.7 })),
    );
    bloco.position.set(-0.38, 0.37, 0);
    this.grupo.add(bloco);
  }

  /** Ondulação suave da superfície (CPU, malha leve). */
  atualizar(t: number): void {
    if (!this.agua || !this.aguaBase) return;
    const pos = (this.agua.geometry as THREE.PlaneGeometry).attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = this.aguaBase[i * 3];
      const y = this.aguaBase[i * 3 + 1];
      arr[i * 3 + 2] = 0.018 * Math.sin(x * 1.4 + t * 1.6) + 0.012 * Math.sin(x * 3.1 - t * 1.1 + y * 2.2);
    }
    pos.needsUpdate = true;
  }
}
