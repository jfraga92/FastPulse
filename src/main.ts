// Fast Pulse — arranque da aplicação: liga o modelo (executor "ESP32"),
// a cena Three.js e a interface.

import './estilo.css';
import { ExecutorESP32 } from './model/executor';
import { amostraPlano, compilarPlano } from './model/plano';
import { preset100m } from './model/presets';
import type { PlanoCompilado, PlanoJSON } from './model/tipos';
import { Camaras } from './scene/camaras';
import { Cena } from './scene/cena';
import { Fita3D } from './scene/fita3d';
import { Nadador3D } from './scene/nadador3d';
import { Piscina } from './scene/piscina';
import { montarControlos } from './ui/controlos';
import { EstadoApp } from './ui/estado';
import { Hud } from './ui/hud';
import { PainelESP32 } from './ui/painel';
import { montarTabela } from './ui/tabela';
import { Timeline } from './ui/timeline';

const vista = document.getElementById('vista')!;
const estado = new EstadoApp(preset100m());
const executor = new ExecutorESP32();

const cena = new Cena(vista);
const piscina = new Piscina();
const fita = new Fita3D();
const nadador = new Nadador3D();
cena.scene.add(piscina.grupo, fita.grupo, nadador.grupo);
const camaras = new Camaras(vista, cena.renderer.domElement);

const hud = new Hud();
const timeline = new Timeline(estado, executor);

/** Plano do nadador virtual: o mesmo plano com +desvio em cada parcial. */
let planoNadador: PlanoCompilado | null = null;
function recompilarNadador(): void {
  if (!executor.planoJSON) {
    planoNadador = null;
    return;
  }
  const comDesvio: PlanoJSON = {
    ...executor.planoJSON,
    percursos: executor.planoJSON.percursos.map((p) => ({ ...p, parcial_s: p.parcial_s + estado.desvio_s })),
  };
  const compilado = compilarPlano(comDesvio, executor.opcoesAtuais);
  planoNadador = compilado.valido ? compilado : null;
}

/** Reconstrói piscina/fita quando o plano enviado muda de dimensões. */
let dimensoes = '';
function reconstruirCena(): void {
  if (!executor.planoJSON) return;
  const chave = `${executor.planoJSON.piscina_m}|${executor.planoJSON.leds_por_metro}`;
  if (chave !== dimensoes) {
    dimensoes = chave;
    piscina.construir(executor.planoJSON.piscina_m);
    camaras.configurar(executor.planoJSON.piscina_m);
  }
  fita.construir(executor.numLeds, executor.planoJSON.leds_por_metro);
}

function enviarPlano(): void {
  const rascunho = JSON.parse(JSON.stringify(estado.plano)) as PlanoJSON;
  const r = executor.enviarPlano(rascunho, { modoConstante: estado.modoConstante });
  if (r.valido) {
    reconstruirCena();
    recompilarNadador();
    timeline.definirTotal(r.total_s);
  }
  atualizarSujo();
}

const painel = new PainelESP32(executor, {
  enviar: enviarPlano,
  iniciar: () => {
    executor.iniciar();
    estado.pausado = false;
  },
  parar: () => executor.parar(),
  mudarHz: (hz) => { executor.hz = hz; },
});

/** "Alterações por enviar": rascunho difere do plano no ESP32. */
let sujo = false;
function atualizarSujo(): void {
  sujo = JSON.stringify(estado.plano) !== JSON.stringify(executor.planoJSON);
}
estado.on('plano', atualizarSujo);

// Alterar o modo constante recompila o plano já enviado (não envia o rascunho).
let modoConstanteAnterior = estado.modoConstante;
estado.on('sim', () => {
  if (estado.modoConstante !== modoConstanteAnterior) {
    modoConstanteAnterior = estado.modoConstante;
    if (executor.planoJSON) {
      executor.enviarPlano(executor.planoJSON, { modoConstante: estado.modoConstante });
      executor.repintar();
    }
  }
  recompilarNadador();
});
estado.on('camara', () => camaras.ativar(estado.camara));

montarControlos(estado);
montarTabela(estado);

// Arranque: o preset segue logo para o "ESP32" para se poder carregar Iniciar.
enviarPlano();

// ---------------------------------------------------------------- loop
let ultimo = performance.now();
let fps = 0;
let framesJanela = 0;
let tempoJanela = 0;

function frame(agora: number): void {
  // Clamp largo: protege de saltos (separador em segundo plano) sem atrasar
  // o relógio da simulação em máquinas que rendam a poucos fps.
  const dtReal = Math.min((agora - ultimo) / 1000, 0.25);
  ultimo = agora;

  framesJanela++;
  tempoJanela += dtReal;
  if (tempoJanela >= 0.5) {
    fps = framesJanela / tempoJanela;
    framesJanela = 0;
    tempoJanela = 0;
  }

  executor.avancar(estado.pausado ? 0 : dtReal * estado.velocidade, dtReal);

  const lebre = executor.amostra();
  const aNadador = planoNadador ? amostraPlano(planoNadador, executor.tPlano) : null;
  const tSim = executor.tPlano;

  piscina.atualizar(agora / 1000);
  fita.sincronizar(executor.fita, camaras.camara);
  nadador.atualizar(aNadador, tSim, estado.nadadorVisivel, executor.planoJSON?.piscina_m ?? 25);
  camaras.atualizar(dtReal, aNadador ?? lebre, lebre, tSim);

  hud.atualizar(executor, lebre, aNadador);
  painel.atualizar(fps, sujo);
  timeline.atualizar();

  cena.render(camaras.camara);
  requestAnimationFrame(frame);
}

function aoRedimensionar(): void {
  const w = vista.clientWidth;
  const h = vista.clientHeight;
  cena.resize(w, h);
  camaras.resize(w / Math.max(h, 1));
}
window.addEventListener('resize', aoRedimensionar);
aoRedimensionar();

requestAnimationFrame(frame);

// Acesso de diagnóstico na consola (também útil para experimentar valores).
Object.assign(window as unknown as Record<string, unknown>, {
  __fastpulse: { cena, camaras, executor, estado },
});
