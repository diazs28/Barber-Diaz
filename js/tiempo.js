// Fechas y horas en Colombia (America/Bogota: UTC-5 todo el año, sin horario de verano).
// Las fechas de calendario viajan como texto 'AAAA-MM-DD' y los instantes como Date.
const ZONA = 'America/Bogota';
const DESFASE = '-05:00';

const partesFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function fechaDe(instante) {
  const p = Object.fromEntries(partesFecha.formatToParts(instante).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export const hoy = () => fechaDe(new Date());
export const instante = (fecha, hhmm) => new Date(`${fecha}T${hhmm}:00${DESFASE}`);
export const sumarMinutos = (fecha, minutos) => new Date(fecha.getTime() + minutos * 60000);
export const diaSemana = (fecha) => new Date(`${fecha}T12:00:00Z`).getUTCDay();

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const fmtHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
});
const fmtDiaSemana = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'long' });
const fmtDiaCorto = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'short' });
const fmtFechaLarga = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// Intl usa espacios finos (U+202F / U+00A0) en "p. m."; se normalizan a espacio duro para WhatsApp.
const limpiar = (texto) => texto.replace(/[  ]/g, ' ');

export const formatearHora = (d) => limpiar(fmtHora.format(d));
export const nombreDia = (fecha) => fmtDiaSemana.format(instante(fecha, '12:00'));
export const diaCorto = (fecha) => fmtDiaCorto.format(instante(fecha, '12:00')).replace('.', '');
export const fechaLarga = (fecha) => fmtFechaLarga.format(instante(fecha, '12:00'));
export const numeroDia = (fecha) => Number(fecha.slice(8, 10));

// "hoy", "mañana" o "el jueves", relativo a la fecha de referencia
export function diaRelativo(fecha, referencia = hoy()) {
  if (fecha === referencia) return 'hoy';
  if (fecha === sumarDias(referencia, 1)) return 'mañana';
  return `el ${nombreDia(fecha)}`;
}

// Formato de Google Calendar: 20261014T203000Z
export const formatoGoogle = (d) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
