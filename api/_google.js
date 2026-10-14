// Acceso a Google Calendar desde el servidor con la cuenta de servicio.
// La llave vive en la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON (el archivo JSON que entrega
// Google Cloud, pegado completo). Nunca llega al navegador ni se imprime en los logs.
import { createSign } from 'node:crypto';

// calendar.events crea y lista citas; la consulta free/busy exige además calendar.freebusy
export const ALCANCE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
].join(' ');
const API = 'https://www.googleapis.com/calendar/v3';
let tokenEnCache = null;

export class ErrorGoogle extends Error {
  constructor(status, motivo) {
    super(`Google respondió ${status} (${motivo})`);
    this.status = status;
    this.motivo = motivo;
  }
}

// Lee la llave aceptando el JSON tal cual o codificado en base64 (por si el panel lo altera)
export function credenciales() {
  const crudo = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!crudo) return null;
  for (const texto of [crudo, Buffer.from(crudo, 'base64').toString('utf8')]) {
    try {
      const datos = JSON.parse(texto);
      if (datos.client_email && datos.private_key) return datos;
    } catch {
      // Se prueba la siguiente forma
    }
  }
  throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON de cuenta de servicio válido');
}

const base64url = (valor) =>
  Buffer.from(typeof valor === 'string' ? valor : JSON.stringify(valor)).toString('base64url');

async function token(cred) {
  if (tokenEnCache && tokenEnCache.vence > Date.now() + 60_000) return tokenEnCache.valor;
  const ahora = Math.floor(Date.now() / 1000);
  const sinFirma = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: cred.client_email,
    scope: ALCANCE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600,
  })}`;
  const firma = createSign('RSA-SHA256').update(sinFirma).sign(cred.private_key, 'base64url');
  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${sinFirma}.${firma}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorGoogle(respuesta.status, datos.error ?? 'token');
  tokenEnCache = { valor: datos.access_token, vence: Date.now() + datos.expires_in * 1000 };
  return tokenEnCache.valor;
}

// Llamada autenticada a Calendar API. Devuelve el JSON o lanza ErrorGoogle con el motivo.
export async function calendario(ruta, { method = 'GET', cuerpo } = {}) {
  const cred = credenciales();
  if (!cred) throw new Error('Falta la variable GOOGLE_SERVICE_ACCOUNT_JSON');
  const respuesta = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token(cred)}`,
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const motivo = datos.error?.errors?.[0]?.reason ?? datos.error?.status ?? 'sin motivo';
    throw new ErrorGoogle(respuesta.status, motivo);
  }
  return datos;
}

// Bloques ocupados por calendario: { [idCalendario]: [{ start, end }] }
export async function libreOcupado(ids, desde, hasta) {
  const datos = await calendario('/freeBusy', {
    method: 'POST',
    cuerpo: {
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      timeZone: 'America/Bogota',
      items: ids.map((id) => ({ id })),
    },
  });
  return datos.calendars ?? {};
}

// Solo para pruebas: reinicia el token guardado
export function _reiniciarToken() {
  tokenEnCache = null;
}
