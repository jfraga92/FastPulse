// Definições gerais, câmaras, preset e exportar/importar JSON.

import { preset100m } from '../model/presets';
import { validarPlanoJSON } from '../model/plano';
import type { NomeCamara } from '../scene/camaras';
import type { EstadoApp } from './estado';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function montarControlos(estado: EstadoApp): void {
  const inpNome = el<HTMLInputElement>('inp-nome');
  const selPiscina = el<HTMLSelectElement>('sel-piscina');
  const selLeds = el<HTMLSelectElement>('sel-leds');
  const inpPonto = el<HTMLInputElement>('inp-ponto');
  const corSup = el<HTMLInputElement>('cor-sup');
  const corSub = el<HTMLInputElement>('cor-sub');
  const inpVel = el<HTMLInputElement>('inp-vel');
  const velLabel = el<HTMLOutputElement>('vel-label');
  const chkConstante = el<HTMLInputElement>('chk-constante');
  const chkNadador = el<HTMLInputElement>('chk-nadador');
  const inpDesvio = el<HTMLInputElement>('inp-desvio');

  function sincronizarCampos(): void {
    const p = estado.plano;
    inpNome.value = p.nome;
    selPiscina.value = String(p.piscina_m);
    selLeds.value = String(p.leds_por_metro);
    inpPonto.value = String(p.ponto_leds);
    corSup.value = p.cor_superficie;
    corSub.value = p.cor_subaquatico;
  }
  sincronizarCampos();
  estado.on('plano', sincronizarCampos);

  inpNome.addEventListener('change', () => { estado.plano.nome = inpNome.value; estado.emitir('plano'); });
  selPiscina.addEventListener('change', () => { estado.plano.piscina_m = parseFloat(selPiscina.value); estado.emitir('plano'); });
  selLeds.addEventListener('change', () => { estado.plano.leds_por_metro = parseInt(selLeds.value, 10); estado.emitir('plano'); });
  inpPonto.addEventListener('change', () => { estado.plano.ponto_leds = Math.max(1, parseInt(inpPonto.value, 10) || 8); estado.emitir('plano'); });
  corSup.addEventListener('input', () => { estado.plano.cor_superficie = corSup.value; estado.emitir('plano'); });
  corSub.addEventListener('input', () => { estado.plano.cor_subaquatico = corSub.value; estado.emitir('plano'); });

  inpVel.addEventListener('input', () => {
    estado.velocidade = parseFloat(inpVel.value);
    velLabel.textContent = `${estado.velocidade.toFixed(2)}×`;
    estado.emitir('sim');
  });
  chkConstante.addEventListener('change', () => { estado.modoConstante = chkConstante.checked; estado.emitir('sim'); });
  chkNadador.addEventListener('change', () => { estado.nadadorVisivel = chkNadador.checked; estado.emitir('sim'); });
  inpDesvio.addEventListener('change', () => { estado.desvio_s = parseFloat(inpDesvio.value) || 0; estado.emitir('sim'); });

  el<HTMLButtonElement>('btn-preset').addEventListener('click', () => {
    estado.plano = preset100m();
    estado.emitir('plano');
  });

  // Câmaras (botões + teclas 1/2/3)
  const botoesCamara = el<HTMLDivElement>('botoes-camara');
  function ativarCamara(nome: NomeCamara): void {
    estado.camara = nome;
    for (const b of botoesCamara.querySelectorAll('button')) {
      b.classList.toggle('ativa', b.dataset.camara === nome);
    }
    estado.emitir('camara');
  }
  botoesCamara.addEventListener('click', (e) => {
    const alvo = (e.target as HTMLElement).closest('button');
    if (alvo?.dataset.camara) ativarCamara(alvo.dataset.camara as NomeCamara);
  });
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    if (e.key === '1') ativarCamara('bancada');
    if (e.key === '2') ativarCamara('treinador');
    if (e.key === '3') ativarCamara('atleta');
  });

  // Exportar / importar JSON (contrato com o firmware)
  el<HTMLButtonElement>('btn-exportar').addEventListener('click', () => {
    const json = JSON.stringify(estado.plano, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${estado.plano.nome.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'plano'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el<HTMLButtonElement>('btn-copiar').addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(estado.plano, null, 2));
  });

  const inpFicheiro = el<HTMLInputElement>('inp-ficheiro');
  el<HTMLButtonElement>('btn-importar').addEventListener('click', () => inpFicheiro.click());
  inpFicheiro.addEventListener('change', async () => {
    const ficheiro = inpFicheiro.files?.[0];
    inpFicheiro.value = '';
    if (!ficheiro) return;
    try {
      const texto = await ficheiro.text();
      const r = validarPlanoJSON(JSON.parse(texto));
      if (!r.plano) {
        alert(`JSON inválido:\n• ${r.erros.join('\n• ')}`);
        return;
      }
      estado.plano = r.plano;
      estado.emitir('plano');
    } catch (e) {
      alert(`Não foi possível ler o ficheiro: ${(e as Error).message}`);
    }
  });
}
