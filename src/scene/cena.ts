// Infraestrutura de renderização: renderer, luzes, bloom e nevoeiro
// (o nevoeiro muda consoante a câmara está dentro ou fora de água).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Cena {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;

  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;

  // Debaixo de água: nevoeiro denso azul-esverdeado (dispersão da luz).
  private readonly fogSub = new THREE.FogExp2(0x0a5064, 0.14);
  private readonly fogSup = new THREE.FogExp2(0x0d1720, 0.008);
  private readonly corSub = new THREE.Color(0x0a5064);
  private readonly corSup = new THREE.Color(0x0d1720);

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const hemisferio = new THREE.HemisphereLight(0xcfe4f0, 0x1a3340, 0.9);
    const projetores = new THREE.DirectionalLight(0xfff4e0, 1.5);
    projetores.position.set(14, 18, 9);
    const contra = new THREE.DirectionalLight(0x9fc8e0, 0.4);
    contra.position.set(-8, 10, -12);
    this.scene.add(hemisferio, projetores, contra);

    const largura = container.clientWidth || 1;
    const altura = container.clientHeight || 1;
    this.renderPass = new RenderPass(this.scene, new THREE.PerspectiveCamera());
    // Threshold alto: só os LEDs (pintados com valores > 1) fazem bloom.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(largura, altura), 1.2, 0.55, 0.85);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  render(camara: THREE.PerspectiveCamera): void {
    const submersa = camara.position.y < 0;
    this.scene.fog = submersa ? this.fogSub : this.fogSup;
    this.scene.background = submersa ? this.corSub : this.corSup;
    this.renderPass.camera = camara;
    this.composer.render();
  }

  resize(largura: number, altura: number): void {
    this.renderer.setSize(largura, altura);
    this.composer.setSize(largura, altura);
    this.bloom.setSize(largura, altura);
  }
}
