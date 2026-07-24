// Tabela de percursos editável, com colunas calculadas e problemas inline.

import { compilarPercurso } from '../model/fases';
import { compilarPlano, percursoConstante } from '../model/plano';
import type { PercursoJSON } from '../model/tipos';
import type { EstadoApp } from './estado';

const CAMPOS: Array<{ campo: keyof PercursoJSON; titulo: string; passo: number }> = [
  { campo: 'parcial_s', titulo: 'parcial (s)', passo: 0.1 },
  { campo: 'sub_m', titulo: 'sub (m)', passo: 0.5 },
  { campo: 'morto_s', titulo: 'morto (s)', passo: 0.05 },
  { campo: 'v_pico', titulo: 'v_pico (m/s)', passo: 0.1 },
  { campo: 'v_pernada', titulo: 'v_pernada (m/s)', passo: 0.05 },
  { campo: 'deslize_m', titulo: 'deslize (m)', passo: 0.5 },
  { campo: 'voo_m', titulo: 'voo (m)', passo: 0.5 },
  { campo: 'voo_s', titulo: 'voo (s)', passo: 0.05 },
];

export function montarTabela(estado: EstadoApp): void {
  const tabela = document.getElementById('tabela-percursos') as HTMLTableElement;
  const problemasDiv = document.getElementById('problemas-plano')!;
  const btnAdd = document.getElementById('btn-add') as HTMLButtonElement;

  function render(): void {
    const L = estado.plano.piscina_m;
    tabela.innerHTML = '';

    const thead = tabela.createTHead();
    const linhaCab = thead.insertRow();
    for (const t of ['#', ...CAMPOS.map((c) => c.titulo), 'v_nado', 't_deslize', 't_pernada', '']) {
      const th = document.createElement('th');
      th.textContent = t;
      linhaCab.appendChild(th);
    }

    const corpo = tabela.createTBody();
    estado.plano.percursos.forEach((p, i) => {
      const primeiro = i === 0;
      const efetivo = estado.modoConstante ? percursoConstante(p, L, primeiro) : p;
      const pc = compilarPercurso(efetivo, L, primeiro);
      const temErro = pc.problemas.some((q) => q.nivel === 'erro');
      const temAviso = pc.problemas.some((q) => q.nivel === 'aviso');

      const tr = corpo.insertRow();
      const tdN = tr.insertCell();
      tdN.textContent = `${i + 1}${i % 2 === 0 ? ' →' : ' ←'}`;
      if (temErro || temAviso) {
        tdN.textContent += temErro ? ' ✕' : ' ⚠';
        tdN.style.color = temErro ? 'var(--perigo)' : 'var(--aviso)';
        tdN.title = pc.problemas.map((q) => q.msg).join('\n');
      }

      for (const { campo, passo } of CAMPOS) {
        const td = tr.insertCell();
        const eVoo = campo === 'voo_m' || campo === 'voo_s';
        if (eVoo && !primeiro) {
          td.textContent = '—';
          td.className = 'sem-voo';
          continue;
        }
        const input = document.createElement('input');
        input.type = 'number';
        input.step = String(passo);
        input.value = String(p[campo] ?? 0);
        input.addEventListener('change', () => {
          const v = parseFloat(input.value);
          (p[campo] as number) = isNaN(v) ? 0 : v;
          estado.emitir('plano');
        });
        td.appendChild(input);
      }

      const calc = (valor: number, invalido: boolean): HTMLTableCellElement => {
        const td = tr.insertCell();
        td.className = 'calc' + (temErro ? ' erro' : temAviso ? ' aviso' : '');
        td.textContent = invalido ? '—' : valor.toFixed(2);
        if (pc.problemas.length > 0) td.title = pc.problemas.map((q) => q.msg).join('\n');
        return td;
      };
      calc(pc.v_nado, temErro);
      calc(pc.t_deslize, temErro && pc.t_deslize === 0);
      calc(pc.t_pernada, temErro && pc.t_pernada === 0);

      const tdAcoes = tr.insertCell();
      const btnDup = document.createElement('button');
      btnDup.textContent = '⧉';
      btnDup.title = 'Duplicar percurso';
      btnDup.addEventListener('click', () => {
        const copia: PercursoJSON = { ...p };
        // O voo só existe no 1.º percurso — a cópia nunca fica em 1.º
        delete copia.voo_m;
        delete copia.voo_s;
        estado.plano.percursos.splice(i + 1, 0, copia);
        estado.emitir('plano');
      });
      const btnDel = document.createElement('button');
      btnDel.textContent = '✕';
      btnDel.title = 'Remover percurso';
      btnDel.disabled = estado.plano.percursos.length <= 1;
      btnDel.addEventListener('click', () => {
        estado.plano.percursos.splice(i, 1);
        estado.emitir('plano');
      });
      tdAcoes.append(btnDup, btnDel);
    });

    // Resumo de problemas do plano completo (inclui os globais)
    const compilado = compilarPlano(estado.plano, { modoConstante: estado.modoConstante });
    problemasDiv.innerHTML = '';
    for (const q of compilado.problemas) {
      const div = document.createElement('div');
      div.className = `problema ${q.nivel}`;
      div.textContent = `${q.nivel === 'erro' ? '✕' : '⚠'} ${q.msg}`;
      problemasDiv.appendChild(div);
    }
  }

  btnAdd.addEventListener('click', () => {
    const ultimo = estado.plano.percursos[estado.plano.percursos.length - 1];
    const novo: PercursoJSON = { ...ultimo };
    delete novo.voo_m;
    delete novo.voo_s;
    estado.plano.percursos.push(novo);
    estado.emitir('plano');
  });

  estado.on('plano', render);
  estado.on('sim', render); // o modo constante muda as colunas calculadas
  render();
}
