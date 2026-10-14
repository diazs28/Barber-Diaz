// POST /api/reservas  { barbero, servicio, inicio, nombre }  +  cabecera Idempotency-Key
// Crea la cita directamente en el Google Calendar del barbero (cuenta de servicio en el servidor).
// El cliente nunca recibe enlaces ni permisos sobre el calendario.
import { z } from 'zod';
import { ErrorGoogle, credenciales } from './_google.js';
import { ErrorReserva, reservar } from './_reservar.js';

const cuerpo = z.object({
  barbero: z.string().min(1).max(40),
  servicio: z.string().min(1).max(40),
  inicio: z.string().datetime({ offset: true }),
  nombre: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre')
    .max(60)
    // Solo letras, espacios y signos comunes de nombres: evita enlaces o código en el calendario
    .regex(/^[\p{L}\p{M}' .-]+$/u, 'Usa solo letras en el nombre')
    .transform((n) => n.replace(/\s+/g, ' ')),
});

const error = (status, code, message) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  try {
    if (!credenciales()) {
      console.error('[reservas] Falta la variable GOOGLE_SERVICE_ACCOUNT_JSON');
      return error(503, 'RESERVAS_NO_CONFIGURADAS', 'Las reservas en línea no están disponibles.');
    }
  } catch (e) {
    console.error('[reservas]', e.message);
    return error(503, 'RESERVAS_NO_CONFIGURADAS', 'Las reservas en línea no están disponibles.');
  }

  const clave = request.headers.get('idempotency-key') ?? '';
  if (!/^[\w-]{16,80}$/.test(clave)) {
    return error(400, 'FALTA_IDEMPOTENCY_KEY', 'Falta la cabecera Idempotency-Key.');
  }
  const datos = cuerpo.safeParse(await request.json().catch(() => null));
  if (!datos.success) {
    return error(400, 'DATOS_INVALIDOS', datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  try {
    const r = await reservar({ ...datos.data, inicio: new Date(datos.data.inicio), clave });
    return Response.json(
      {
        reserva: {
          barbero: r.barbero.id,
          servicio: r.servicio.id,
          inicio: r.inicio.toISOString(),
          fin: r.fin.toISOString(),
        },
      },
      { status: r.duplicada ? 200 : 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    if (e instanceof ErrorReserva) return error(e.status, e.code, e.message);
    // Sin datos del cliente en el log: solo el tipo de fallo
    console.error(
      '[reservas] Falló la reserva:',
      e instanceof ErrorGoogle ? `${e.status} ${e.motivo}` : e.name,
    );
    return error(502, 'RESERVA_FALLIDA', 'No pudimos guardar la cita. Intenta de nuevo.');
  }
}
