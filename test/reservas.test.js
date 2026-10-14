// Pruebas de la reserva automática. Google Calendar se simula con un fetch falso: no se toca
// ningún calendario real. Ejecutar con: npm test
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { _reiniciarToken } from '../api/_google.js';
import { ErrorReserva, reservar } from '../api/_reservar.js';
import { POST } from '../api/reservas.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDENCIALES = JSON.stringify({
  client_email: 'prueba@proyecto.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

// Miércoles 14 de octubre de 2026, 8:00 a. m. en Bogotá. Alexander trabaja de 9 a 20 (almuerzo 12-13).
const AHORA = new Date('2026-10-14T08:00:00-05:00');
const a = (hhmm) => new Date(`2026-10-14T${hhmm}:00-05:00`);

let google;
const fetchOriginal = globalThis.fetch;

function simularGoogle({ ocupados = [], crear = 200, cruzados = [], propioExiste = false } = {}) {
  google = { llamadas: [], borrados: 0 };
  globalThis.fetch = async (url, opciones = {}) => {
    const u = String(url);
    const metodo = opciones.method ?? 'GET';
    google.llamadas.push(`${metodo} ${u.replace('https://www.googleapis.com/calendar/v3', '')}`);
    const json = (status, cuerpo) =>
      new Response(cuerpo === null ? null : JSON.stringify(cuerpo), { status });
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      // Guarda los permisos que pidió el token (parte central del JWT)
      const jwt = new URLSearchParams(opciones.body).get('assertion');
      google.alcance = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).scope;
      return json(200, { access_token: 'token-falso', expires_in: 3600 });
    }
    if (u.endsWith('/freeBusy')) {
      const { items } = JSON.parse(opciones.body);
      return json(200, {
        calendars: Object.fromEntries(
          items.map(({ id }) => [
            id,
            {
              busy: ocupados.map(([i, f]) => ({
                start: a(i).toISOString(),
                end: a(f).toISOString(),
              })),
            },
          ]),
        ),
      });
    }
    if (metodo === 'POST' && u.endsWith('/events')) {
      google.evento = JSON.parse(opciones.body);
      return json(
        crear,
        crear === 200 ? google.evento : { error: { errors: [{ reason: 'duplicate' }] } },
      );
    }
    if (metodo === 'GET' && u.includes('/events?')) {
      return json(200, { items: cruzados });
    }
    if (metodo === 'GET' && /\/events\/bm/.test(u)) {
      // Solo existe si un intento anterior con la misma clave ya lo creó
      return propioExiste
        ? json(200, { id: 'propio', status: 'confirmed' })
        : json(404, { error: { errors: [{ reason: 'notFound' }] } });
    }
    if (metodo === 'DELETE') {
      google.borrados += 1;
      return json(204, null);
    }
    return json(404, {});
  };
}

const pedido = (extra = {}) => ({
  barbero: 'alexander',
  servicio: 'clasico',
  inicio: a('10:00'),
  nombre: 'Cliente Prueba',
  clave: 'clave-de-prueba-0001',
  ...extra,
});

beforeEach(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = CREDENCIALES;
  _reiniciarToken();
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('reservar()', () => {
  test('crea la cita en el calendario del barbero con la duración del servicio', async () => {
    simularGoogle();
    const r = await reservar(pedido(), { ahora: AHORA });
    assert.equal(r.duplicada, false);
    assert.equal(google.evento.summary, 'Corte clásico · Cliente Prueba');
    assert.equal(google.evento.start.dateTime, a('10:00').toISOString());
    assert.equal(google.evento.end.dateTime, a('10:45').toISOString());
    assert.match(google.evento.id, /^bm[0-9a-f]{40}$/);
  });

  test('el token pide permiso de eventos y de libre/ocupado (sin este, Google responde 403)', async () => {
    simularGoogle();
    await reservar(pedido(), { ahora: AHORA });
    const permisos = google.alcance.split(' ');
    assert.ok(permisos.includes('https://www.googleapis.com/auth/calendar.events'));
    assert.ok(permisos.includes('https://www.googleapis.com/auth/calendar.freebusy'));
  });

  test('rechaza una hora fuera del horario (422)', async () => {
    simularGoogle();
    await assert.rejects(reservar(pedido({ inicio: a('20:30') }), { ahora: AHORA }), {
      status: 422,
      code: 'HORA_NO_DISPONIBLE',
    });
  });

  test('rechaza un servicio que no alcanza antes del almuerzo (422)', async () => {
    simularGoogle();
    await assert.rejects(reservar(pedido({ inicio: a('11:30') }), { ahora: AHORA }), {
      code: 'HORA_NO_DISPONIBLE',
    });
  });

  test('rechaza una hora que no coincide con los turnos (422)', async () => {
    simularGoogle();
    await assert.rejects(reservar(pedido({ inicio: a('10:15') }), { ahora: AHORA }), {
      code: 'HORA_NO_DISPONIBLE',
    });
  });

  test('rechaza un día de descanso del barbero (422)', async () => {
    simularGoogle();
    // Alexander descansa los lunes: 19 de octubre
    await assert.rejects(
      reservar(pedido({ inicio: new Date('2026-10-19T10:00:00-05:00') }), { ahora: AHORA }),
      { code: 'HORA_NO_DISPONIBLE' },
    );
  });

  test('rechaza una hora ya ocupada en el calendario (409) sin crear nada', async () => {
    simularGoogle({ ocupados: [['10:30', '11:00']] });
    await assert.rejects(reservar(pedido(), { ahora: AHORA }), {
      status: 409,
      code: 'HORA_OCUPADA',
    });
    assert.equal(google.evento, undefined);
  });

  test('si la hora está ocupada por la misma reserva (reintento), no responde error', async () => {
    simularGoogle({ ocupados: [['10:00', '10:45']], propioExiste: true });
    const r = await reservar(pedido(), { ahora: AHORA });
    assert.equal(r.duplicada, true);
    assert.equal(google.evento, undefined);
  });

  test('un reintento con la misma clave no duplica la cita', async () => {
    simularGoogle({ crear: 409 });
    const r = await reservar(pedido(), { ahora: AHORA });
    assert.equal(r.duplicada, true);
  });

  test('si otra reserva entró al mismo tiempo, retira la propia y responde 409', async () => {
    simularGoogle({ cruzados: [{ id: 'otra', status: 'confirmed' }] });
    await assert.rejects(reservar(pedido(), { ahora: AHORA }), { code: 'HORA_OCUPADA' });
    assert.equal(google.borrados, 1);
  });

  test('barbero desconocido (400)', async () => {
    simularGoogle();
    await assert.rejects(reservar(pedido({ barbero: 'nadie' }), { ahora: AHORA }), ErrorReserva);
  });
});

describe('POST /api/reservas', () => {
  const peticion = (cuerpo, cabeceras = { 'Idempotency-Key': 'clave-de-prueba-0002' }) =>
    new Request('http://local/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cabeceras },
      body: JSON.stringify(cuerpo),
    });
  const valido = {
    barbero: 'alexander',
    servicio: 'clasico',
    inicio: a('10:00').toISOString(),
    nombre: 'Cliente Prueba',
  };

  test('sin credenciales responde 503 sin llamar a Google', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    simularGoogle();
    const r = await POST(peticion(valido));
    assert.equal(r.status, 503);
    assert.equal(google.llamadas.length, 0);
  });

  test('exige Idempotency-Key (400)', async () => {
    simularGoogle();
    const r = await POST(peticion(valido, {}));
    assert.equal((await r.json()).error.code, 'FALTA_IDEMPOTENCY_KEY');
  });

  test('rechaza nombres con enlaces o código (400)', async () => {
    simularGoogle();
    const r = await POST(peticion({ ...valido, nombre: 'Visita http://estafa.co' }));
    assert.equal(r.status, 400);
    assert.equal(google.llamadas.length, 0);
  });

  test('los errores no exponen detalles internos', async () => {
    simularGoogle();
    globalThis.fetch = async () => {
      throw new Error('detalle interno secreto');
    };
    const r = await POST(peticion(valido));
    const cuerpo = await r.json();
    assert.equal(r.status, 502);
    assert.doesNotMatch(JSON.stringify(cuerpo), /secreto/);
  });
});
