// GET /api/disponibilidad?desde=AAAA-MM-DD&dias=7
// Consulta free/busy de Google Calendar con la clave guardada en el servidor (GOOGLE_CALENDAR_API_KEY)
// y devuelve solo los bloques ocupados de cada barbero. Ni la clave ni los IDs llegan al navegador.
import { z } from 'zod';
import { CALENDARIOS } from './_calendarios.js';

const consulta = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD'),
  dias: z.coerce.number().int().min(1).max(14).default(7),
});

const DESFASE_BOGOTA = '-05:00';
const UN_DIA_MS = 86_400_000;

function error(status, code, message, extra = {}) {
  return Response.json({ error: { code, message } }, { status, ...extra });
}

export async function GET(request) {
  // Se limpian espacios, saltos de línea y comillas que se cuelan al pegar la clave en Vercel
  const clave = process.env.GOOGLE_CALENDAR_API_KEY?.trim().replace(/^['"]|['"]$/g, '');
  if (!clave) {
    console.error('[disponibilidad] Falta la variable GOOGLE_CALENDAR_API_KEY');
    return error(503, 'AGENDA_NO_CONFIGURADA', 'La agenda no está disponible en este momento.');
  }

  const url = new URL(request.url);
  const datos = consulta.safeParse(Object.fromEntries(url.searchParams));
  if (!datos.success) {
    return error(400, 'CONSULTA_INVALIDA', 'Revisa los parámetros desde y dias.');
  }
  const { desde, dias } = datos.data;
  const inicio = new Date(`${desde}T00:00:00${DESFASE_BOGOTA}`);
  if (Number.isNaN(inicio.getTime())) {
    return error(400, 'CONSULTA_INVALIDA', 'La fecha no existe.');
  }

  const ids = Object.entries(CALENDARIOS);
  let respuesta;
  try {
    respuesta = await fetch(
      `https://www.googleapis.com/calendar/v3/freeBusy?key=${encodeURIComponent(clave)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: inicio.toISOString(),
          timeMax: new Date(inicio.getTime() + dias * UN_DIA_MS).toISOString(),
          timeZone: 'America/Bogota',
          items: ids.map(([, id]) => ({ id })),
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch (e) {
    console.error('[disponibilidad] Google no respondió:', e.name);
    return error(502, 'GOOGLE_SIN_RESPUESTA', 'No pudimos consultar la agenda. Intenta de nuevo.');
  }
  if (!respuesta.ok) {
    // Solo el motivo (p. ej. API_KEY_INVALID): el cuerpo completo podría repetir la URL con la clave
    const detalle = await respuesta.json().catch(() => ({}));
    console.error(
      '[disponibilidad] Google respondió',
      respuesta.status,
      detalle.error?.details?.[0]?.reason ?? detalle.error?.errors?.[0]?.reason ?? 'sin motivo',
    );
    return error(502, 'GOOGLE_ERROR', 'No pudimos consultar la agenda. Intenta de nuevo.');
  }

  const { calendars = {} } = await respuesta.json();
  const ocupados = {};
  for (const [barbero, id] of ids) {
    const calendario = calendars[id];
    if (!calendario || calendario.errors?.length) {
      console.error(
        '[disponibilidad] Calendario ilegible:',
        barbero,
        calendario?.errors?.[0]?.reason,
      );
      return error(502, 'CALENDARIO_ILEGIBLE', 'No pudimos consultar la agenda. Intenta de nuevo.');
    }
    ocupados[barbero] = calendario.busy.map((b) => ({ inicio: b.start, fin: b.end }));
  }

  // La CDN de Vercel guarda la respuesta 60 s: muchas visitas = pocas consultas a Google
  return Response.json(
    { ocupados },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
  );
}
