// Plano 2D del local: pinta el estado de cada silla (lámpara, cliente en la silla, rótulo) y avisa
// cuando alguien elige un puesto. El dibujo es SVG decorativo; los puestos son <button> reales encima.
import { BARBEROS } from './config.js';
import { diaRelativo, fechaDe, formatearHora } from './tiempo.js';

const ESTADO_CORTO = {
  libre: 'Libre ahora',
  ocupado: 'Atendiendo',
  fuera: 'Fuera de turno',
  cargando: 'Consultando…',
  error: 'Agenda no disponible',
};

export function textoProximo(proximo, ahora = new Date()) {
  if (!proximo) return 'Sin horas libres esta semana';
  const dia = diaRelativo(fechaDe(proximo), fechaDe(ahora));
  const hora = formatearHora(proximo);
  return dia === 'hoy' ? `Libre a las ${hora}` : `Libre ${dia} a las ${hora}`;
}

// Frase completa para el panel y los lectores de pantalla
export function detalleEstado(estado, ahora = new Date()) {
  if (!estado) return ESTADO_CORTO.cargando;
  if (estado.tipo === 'libre') return 'Libre ahora';
  const motivo =
    estado.tipo === 'ocupado'
      ? 'Atendiendo'
      : estado.descansaHoy
        ? 'Descansa hoy'
        : 'Fuera de turno';
  return `${motivo}. ${textoProximo(estado.proximo, ahora)}`;
}

const puestos = new Map(
  BARBEROS.map((b) => [
    b.id,
    {
      dibujo: document.querySelector(`.puesto[data-silla="${b.silla}"]`),
      boton: document.querySelector(`.silla-boton[data-silla="${b.silla}"]`),
    },
  ]),
);

export function iniciarPlano(alElegir) {
  BARBEROS.forEach((b) => {
    const { boton } = puestos.get(b.id);
    if (!boton) return;
    boton.querySelector('[data-silla-nombre]').textContent = b.nombre;
    boton.querySelector('[data-silla-numero]').textContent = String(b.silla);
    boton.addEventListener('click', () => alElegir(b.id, { desdePlano: true }));
  });
}

// estados: Map<idBarbero, estado> o null mientras carga. error: true si la agenda no se pudo leer.
export function pintarPlano(estados, error) {
  const ahora = new Date();
  BARBEROS.forEach((b) => {
    const { dibujo, boton } = puestos.get(b.id);
    if (!dibujo || !boton) return;
    const estado = estados?.get(b.id);
    const tipo = error ? 'error' : (estado?.tipo ?? 'cargando');
    dibujo.dataset.estado = tipo;
    boton.dataset.estado = tipo;
    boton.querySelector('[data-silla-estado]').textContent = ESTADO_CORTO[tipo];
    // Sin el punto final de "p. m." para no repetirlo antes de "Ver horarios"
    const detalle = (error ? ESTADO_CORTO.error : detalleEstado(estado, ahora)).replace(/\.$/, '');
    boton.setAttribute(
      'aria-label',
      `Silla ${b.silla}, ${b.nombre} “${b.apodo}”. ${detalle}. Ver horarios y reservar`,
    );
  });
}

export function marcarElegido(idBarbero) {
  puestos.forEach(({ dibujo, boton }, id) => {
    const elegido = id === idBarbero;
    dibujo?.classList.toggle('is-elegido', elegido);
    boton?.setAttribute('aria-pressed', String(elegido));
  });
}

// Resumen para el inicio: cuántas sillas hay libres en este momento
export function resumenAhora(estados, error) {
  if (error)
    return { tipo: 'error', texto: 'No pudimos consultar las sillas. Escríbenos por WhatsApp.' };
  if (!estados) return { tipo: 'cargando', texto: 'Consultando las sillas…' };
  const lista = [...estados.values()];
  const libres = lista.filter((e) => e.tipo === 'libre').length;
  if (libres) {
    return {
      tipo: 'libre',
      texto:
        libres === 1
          ? `1 de ${lista.length} sillas libre ahora mismo`
          : `${libres} de ${lista.length} sillas libres ahora mismo`,
    };
  }
  const proximos = lista
    .map((e) => e.proximo)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const siguiente = proximos[0] ? textoProximo(proximos[0]).replace('Libre', 'próximo turno') : '';
  const abiertos = lista.some((e) => e.tipo === 'ocupado');
  return {
    tipo: abiertos ? 'ocupado' : 'fuera',
    texto: `${abiertos ? 'Todas las sillas ocupadas' : 'Cerrado ahora'}${siguiente ? `, ${siguiente}` : ''}`,
  };
}
