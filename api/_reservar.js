// Regla de negocio de la reserva: valida la franja con las mismas reglas que ve el cliente
// (horario, almuerzo, descanso, antelación, duración del servicio), consulta la ocupación real
// y crea el evento en el calendario del barbero. Si dos personas reservan a la vez, solo queda una.
import { createHash } from 'node:crypto';
import { AGENDA, BARBEROS, MARCA, SERVICIOS, nombreBarbero } from '../js/config.js';
import { horariosDelDia } from '../js/disponibilidad.js';
import { fechaDe, sumarDias, sumarMinutos } from '../js/tiempo.js';
import { CALENDARIOS } from './_calendarios.js';
import { calendario, libreOcupado } from './_google.js';

export class ErrorReserva extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const HORA_OCUPADA = () =>
  new ErrorReserva(409, 'HORA_OCUPADA', 'Esa hora se acaba de ocupar. Elige otra, por favor.');

// ID de evento estable por intento: un reintento con la misma Idempotency-Key no duplica la cita.
// Google acepta IDs en base32hex (0-9 y a-v); el hex encaja.
const idEvento = (clave) => `bm${createHash('sha256').update(clave).digest('hex').slice(0, 40)}`;

async function ocupadosDe(idCalendario, desde, hasta) {
  const calendarios = await libreOcupado([idCalendario], desde, hasta);
  const datos = calendarios[idCalendario];
  if (!datos || datos.errors?.length) {
    throw new ErrorReserva(502, 'CALENDARIO_ILEGIBLE', 'No pudimos consultar la agenda.');
  }
  return datos.busy.map((b) => ({ inicio: new Date(b.start), fin: new Date(b.end) }));
}

// Eventos que se cruzan con la cita, menos el propio (para detectar una reserva simultánea)
async function otrosEventos(idCalendario, propio, inicio, fin) {
  const params = new URLSearchParams({
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: 'true',
    maxResults: '50',
  });
  const datos = await calendario(`/calendars/${encodeURIComponent(idCalendario)}/events?${params}`);
  return (datos.items ?? []).filter(
    (e) => e.id !== propio && e.status !== 'cancelled' && e.transparency !== 'transparent',
  );
}

/**
 * Crea la cita. Devuelve { barbero, servicio, inicio, fin, duplicada }.
 * Errores: 422 (franja fuera de horario o ya pasada), 409 (ocupada), 502 (Google).
 */
export async function reservar(
  { barbero: idBarbero, servicio: idServicio, inicio, nombre, clave },
  { ahora = new Date() } = {},
) {
  const barbero = BARBEROS.find((b) => b.id === idBarbero);
  const servicio = SERVICIOS.find((s) => s.id === idServicio);
  const idCalendario = CALENDARIOS[idBarbero];
  if (!barbero || !servicio || !idCalendario) {
    throw new ErrorReserva(400, 'DATOS_INVALIDOS', 'Barbero o servicio desconocido.');
  }
  const fin = sumarMinutos(inicio, servicio.minutos);
  const fecha = fechaDe(inicio);
  const ultimoDia = sumarDias(fechaDe(ahora), AGENDA.diasVisibles - 1);
  if (fecha < fechaDe(ahora) || fecha > ultimoDia) {
    throw new ErrorReserva(422, 'FECHA_FUERA_DE_RANGO', 'Solo se reserva en los próximos días.');
  }

  // Ocupación real del día, sin caché
  const desde = new Date(`${fecha}T00:00:00-05:00`);
  const ocupados = await ocupadosDe(idCalendario, desde, sumarMinutos(desde, 24 * 60));
  const franja = horariosDelDia(barbero, fecha, servicio.minutos, ocupados, { ahora }).find(
    (h) => h.inicio.getTime() === inicio.getTime(),
  );
  if (!franja || franja.estado === 'pasado' || franja.estado === 'corto') {
    throw new ErrorReserva(422, 'HORA_NO_DISPONIBLE', 'Esa hora no está dentro del horario.');
  }

  const id = idEvento(clave);
  if (franja.estado === 'ocupado') {
    // Puede ser nuestro propio evento de un intento anterior con la misma clave
    const propio = await calendario(
      `/calendars/${encodeURIComponent(idCalendario)}/events/${id}`,
    ).catch(() => null);
    if (propio && propio.status !== 'cancelled') {
      return { barbero, servicio, inicio, fin, duplicada: true };
    }
    throw HORA_OCUPADA();
  }

  try {
    await calendario(`/calendars/${encodeURIComponent(idCalendario)}/events`, {
      method: 'POST',
      cuerpo: {
        id,
        summary: `${servicio.nombre} · ${nombre}`,
        description: [
          `Cliente: ${nombre}`,
          `Servicio: ${servicio.nombre} (${servicio.minutos} min)`,
          `Barbero: ${nombreBarbero(barbero)}, silla ${barbero.silla}`,
          `Reservada desde la página de ${MARCA.nombre}. Para cancelar, borra este evento.`,
        ].join('\n'),
        start: { dateTime: inicio.toISOString(), timeZone: 'America/Bogota' },
        end: { dateTime: fin.toISOString(), timeZone: 'America/Bogota' },
        extendedProperties: { private: { origen: 'web' } },
      },
    });
  } catch (e) {
    // 409 = ya existe un evento con este ID: es un reintento de la misma reserva
    if (e.status === 409) return { barbero, servicio, inicio, fin, duplicada: true };
    throw e;
  }

  // Dos reservas simultáneas pueden pasar la comprobación a la vez: si hay otro evento cruzado,
  // se retira la nuestra para no dejar la silla con dos clientes.
  // Google solo devuelve eventos que se cruzan con [inicio, fin)
  const cruzados = await otrosEventos(idCalendario, id, inicio, fin);
  if (cruzados.length) {
    await calendario(`/calendars/${encodeURIComponent(idCalendario)}/events/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
    throw HORA_OCUPADA();
  }
  return { barbero, servicio, inicio, fin, duplicada: false };
}
