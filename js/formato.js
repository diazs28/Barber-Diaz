// Versión vanilla de formato.ts para landings sin build (arquetipo A).
// Pesos colombianos: "$ 47.800" (sin centavos si son 00). Recibe enteros o texto, nunca sumes floats.
export function formatearCop(monto) {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(monto).trim());
  if (!m) return String(monto);
  const [, signo = '', enteros = '0', decimales = ''] = m;
  const miles = enteros.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = decimales.padEnd(2, '0');
  return `${signo}$ ${miles}${centavos === '00' ? '' : `,${centavos}`}`;
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Fechas ISO (UTC) mostradas en hora de Colombia
export function formatearFecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : formatoFecha.format(d);
}
