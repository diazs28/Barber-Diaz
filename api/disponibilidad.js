// GET /api/disponibilidad?desde=AAAA-MM-DD&dias=7
// Devuelve solo los bloques ocupados de cada barbero. Consulta Google Calendar desde el servidor con
// la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON) o, si no está, con la clave de API
// (GOOGLE_CALENDAR_API_KEY). Ni las credenciales ni los IDs de calendario llegan al navegador.
import { z } from 'zod';
import { CALENDARIOS } from './_calendarios.js';
import { ErrorGoogle, credenciales, libreOcupado } from './_google.js';

const consulta = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD'),
  dias: z.coerce.number().int().min(1).max(14).default(7),
});

const DESFASE_BOGOTA = '-05:00';
const UN_DIA_MS = 86_400_000;

function error(status, code, message) {
  return Response.json({ error: { code, message } }, { status });
}

// Respaldo con clave de API (calendarios públicos como libre/ocupado)
async function libreOcupadoConClave(clave, ids, desde, hasta) {
  const respuesta = await fetch(
    `https://www.googleapis.com/calendar/v3/freeBusy?key=${encodeURIComponent(clave)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: desde.toISOString(),
        timeMax: hasta.toISOString(),
        timeZone: 'America/Bogota',
        items: ids.map((id) => ({ id })),
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  // Solo el motivo (p. ej. API_KEY_INVALID): el cuerpo completo podría repetir la URL con la clave
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const motivo =
      datos.error?.details?.[0]?.reason ?? datos.error?.errors?.[0]?.reason ?? 'sin motivo';
    throw new ErrorGoogle(respuesta.status, motivo);
  }
  return datos.calendars ?? {};
}

export async function GET(request) {
  // Se limpian espacios, saltos de línea y comillas que se cuelan al pegar la clave en Vercel
  const clave = process.env.GOOGLE_CALENDAR_API_KEY?.trim().replace(/^['"]|['"]$/g, '');
  let conCuenta;
  try {
    conCuenta = Boolean(credenciales());
  } catch (e) {
    console.error('[disponibilidad]', e.message);
    conCuenta = false;
  }
  if (!conCuenta && !clave) {
    console.error('[disponibilidad] Faltan GOOGLE_SERVICE_ACCOUNT_JSON y GOOGLE_CALENDAR_API_KEY');
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
  const fin = new Date(inicio.getTime() + dias * UN_DIA_MS);
  const ids = Object.entries(CALENDARIOS);

  let calendarios;
  try {
    calendarios = conCuenta
      ? await libreOcupado(
          ids.map(([, id]) => id),
          inicio,
          fin,
        )
      : await libreOcupadoConClave(
          clave,
          ids.map(([, id]) => id),
          inicio,
          fin,
        );
  } catch (e) {
    console.error(
      '[disponibilidad] Google falló:',
      e instanceof ErrorGoogle ? `${e.status} ${e.motivo}` : e.name,
    );
    return error(502, 'GOOGLE_ERROR', 'No pudimos consultar la agenda. Intenta de nuevo.');
  }

  const ocupados = {};
  for (const [barbero, id] of ids) {
    const calendario = calendarios[id];
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

  // La CDN de Vercel guarda la respuesta 60 s: muchas visitas = pocas consultas a Google.
  // Tras reservar, la página pide ?fresco=… para saltarse esa caché.
  return Response.json(
    { ocupados },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
  );
}
