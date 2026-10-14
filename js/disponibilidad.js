// Disponibilidad de cada barbero: turnos de trabajo, bloques ocupados y horas libres.
// La ocupación sale de una "fuente": demostración (sin conexión) o Google Calendar (free/busy).
import { AGENDA, BARBEROS, HORARIO_LOCAL } from './config.js';
import { diaSemana, fechaDe, instante, sumarDias, sumarMinutos } from './tiempo.js';

// Tramos de trabajo de un barbero en una fecha: [{ inicio, fin }]. Vacío si descansa o el local cierra.
export function jornada(barbero, fecha) {
  const dia = diaSemana(fecha);
  const horario = HORARIO_LOCAL[dia];
  if (!horario || barbero.descansa.includes(dia)) return [];
  const [abre, cierra] = horario;
  const [almuerzo, regreso] = barbero.almuerzo ?? [];
  const tramos =
    almuerzo && almuerzo > abre && regreso < cierra
      ? [
          [abre, almuerzo],
          [regreso, cierra],
        ]
      : [[abre, cierra]];
  return tramos.map(([a, b]) => ({ inicio: instante(fecha, a), fin: instante(fecha, b) }));
}

/**
 * Horas de inicio posibles para un servicio. Cada una trae su estado:
 * 'libre', 'ocupado', 'corto' (no alcanza antes del cierre o el almuerzo) o 'pasado'.
 */
export function horariosDelDia(barbero, fecha, minutos, ocupados, opciones = {}) {
  const { ahora = new Date(), anticipacionMin = AGENDA.anticipacionMin } = opciones;
  const limite = sumarMinutos(ahora, anticipacionMin);
  const lista = [];
  for (const tramo of jornada(barbero, fecha)) {
    for (let t = tramo.inicio; t < tramo.fin; t = sumarMinutos(t, AGENDA.intervaloMin)) {
      const fin = sumarMinutos(t, minutos);
      let estado = 'libre';
      if (t < limite) estado = 'pasado';
      else if (fin > tramo.fin) estado = 'corto';
      else if (ocupados.some((o) => o.inicio < fin && o.fin > t)) estado = 'ocupado';
      lista.push({ inicio: t, fin, estado });
    }
  }
  return lista;
}

// Primer momento libre (de al menos un intervalo) desde "ahora", en los próximos días visibles
export function proximoLibre(barbero, ocupados, ahora = new Date()) {
  const desde = fechaDe(ahora);
  for (let i = 0; i < AGENDA.diasVisibles; i += 1) {
    const libre = horariosDelDia(barbero, sumarDias(desde, i), AGENDA.intervaloMin, ocupados, {
      ahora,
      anticipacionMin: 0,
    }).find((h) => h.estado === 'libre');
    if (libre) return libre.inicio;
  }
  return null;
}

/**
 * Estado de la silla en este momento:
 * 'libre' (en turno y sin cliente), 'ocupado' (atendiendo) o 'fuera' (fuera de turno, almuerzo o descanso).
 */
export function estadoAhora(barbero, ocupados, ahora = new Date()) {
  const fecha = fechaDe(ahora);
  const tramos = jornada(barbero, fecha);
  const enTurno = tramos.some((t) => t.inicio <= ahora && ahora < t.fin);
  const atendiendo = ocupados.some((o) => o.inicio <= ahora && ahora < o.fin);
  const descansaHoy = tramos.length === 0;
  if (enTurno && !atendiendo) return { tipo: 'libre', proximo: ahora, descansaHoy };
  return {
    tipo: enTurno ? 'ocupado' : 'fuera',
    proximo: proximoLibre(barbero, ocupados, ahora),
    descansaHoy,
  };
}

/* ---------- Fuentes de ocupación ---------- */

// Generador pseudoaleatorio con semilla (mulberry32): la demo muestra lo mismo en cada visita del día
function azarConSemilla(texto) {
  let t = 2166136261;
  for (const c of texto) t = Math.imul(t ^ c.charCodeAt(0), 16777619);
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function ocupacionDemo(barbero, fecha) {
  const azar = azarConSemilla(`${barbero.id}:${fecha}`);
  const duraciones = [30, 45, 60, 75];
  const ocupados = [];
  for (const tramo of jornada(barbero, fecha)) {
    let t = tramo.inicio;
    while (t < tramo.fin) {
      if (azar() < 0.42) {
        const minutos = duraciones[Math.floor(azar() * duraciones.length)];
        const fin = new Date(Math.min(sumarMinutos(t, minutos).getTime(), tramo.fin.getTime()));
        ocupados.push({ inicio: t, fin });
        t = fin;
      } else {
        t = sumarMinutos(t, 30);
      }
    }
  }
  return ocupados;
}

async function ocupacionGoogle(desde, dias) {
  const sinCalendario = BARBEROS.filter((b) => !b.calendarioId).map((b) => b.nombre);
  if (!AGENDA.googleApiKey || sinCalendario.length) {
    throw new Error(
      `Falta configurar Google Calendar: ${AGENDA.googleApiKey ? '' : 'googleApiKey; '}calendarioId de ${sinCalendario.join(', ') || 'nadie'}`,
    );
  }
  const respuesta = await fetch(
    `https://www.googleapis.com/calendar/v3/freeBusy?key=${encodeURIComponent(AGENDA.googleApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: instante(desde, '00:00').toISOString(),
        timeMax: instante(sumarDias(desde, dias), '00:00').toISOString(),
        timeZone: 'America/Bogota',
        items: BARBEROS.map((b) => ({ id: b.calendarioId })),
      }),
    },
  );
  if (!respuesta.ok) throw new Error(`Google Calendar respondió ${respuesta.status}`);
  const datos = await respuesta.json();
  return new Map(
    BARBEROS.map((b) => {
      const calendario = datos.calendars?.[b.calendarioId];
      if (!calendario || calendario.errors?.length) {
        throw new Error(
          `No se pudo leer el calendario de ${b.nombre}: ${calendario?.errors?.[0]?.reason ?? 'sin datos'}`,
        );
      }
      return [
        b.id,
        calendario.busy.map((o) => ({ inicio: new Date(o.start), fin: new Date(o.end) })),
      ];
    }),
  );
}

// Map<idBarbero, [{ inicio, fin }]> con los bloques ocupados desde "desde" durante "dias"
export async function cargarOcupacion(desde, dias = AGENDA.diasVisibles) {
  if (AGENDA.fuente === 'google') return ocupacionGoogle(desde, dias);
  return new Map(
    BARBEROS.map((b) => [
      b.id,
      Array.from({ length: dias }, (_, i) => ocupacionDemo(b, sumarDias(desde, i))).flat(),
    ]),
  );
}
