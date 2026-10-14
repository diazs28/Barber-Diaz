// Panel de reserva: barbero elegido → servicio → día → hora → nombre → cita guardada.
// Con AGENDA.fuente = 'google' la cita se crea en el calendario del barbero desde el servidor
// (/api/reservas); el cliente nunca recibe enlaces ni permisos sobre ese calendario.
import { AGENDA, BARBEROS, MARCA, SERVICIOS, enlaceWhatsapp, nombreBarbero } from './config.js';
import { horariosDelDia, jornada } from './disponibilidad.js';
import { formatearCop } from './formato.js';
import { detalleEstado } from './plano.js';
import {
  diaCorto,
  diaRelativo,
  fechaLarga,
  formatearHora,
  formatoGoogle,
  hoy,
  numeroDia,
  sumarDias,
  sumarMinutos,
} from './tiempo.js';

const $ = (selector) => document.querySelector(selector);
const el = {
  panel: $('[data-reserva]'),
  vacio: $('[data-reserva-vacio]'),
  form: $('[data-reserva-form]'),
  listo: $('[data-reserva-listo]'),
  inicial: $('[data-barbero-inicial]'),
  nombre: $('[data-barbero-nombre]'),
  detalle: $('[data-barbero-detalle]'),
  estado: $('[data-barbero-estado]'),
  servicios: $('[data-servicios]'),
  dias: $('[data-dias]'),
  horas: $('[data-horas]'),
  horasAviso: $('[data-horas-aviso]'),
  error: $('[data-reserva-error]'),
  campoNombre: $('#reserva-nombre'),
  resumen: $('[data-listo-resumen]'),
  calendario: $('[data-listo-calendario]'),
  whatsapp: $('[data-listo-whatsapp]'),
  enviar: $('[data-reserva-enviar]'),
  listoDetalle: $('[data-listo-detalle]'),
};

const estado = {
  barbero: null,
  servicio: SERVICIOS[0].id,
  fecha: null,
  hora: null, // ISO del inicio elegido
  ocupacion: null,
  estados: null,
  error: false,
  clave: null, // Idempotency-Key del intento en curso: un reintento no duplica la cita
  alCambiarAgenda: () => {},
};

const barberoActual = () => BARBEROS.find((b) => b.id === estado.barbero);
const servicioActual = () => SERVICIOS.find((s) => s.id === estado.servicio);
const ocupadosDe = (id) => estado.ocupacion?.get(id) ?? [];
const fechasVisibles = () =>
  Array.from({ length: AGENDA.diasVisibles }, (_, i) => sumarDias(hoy(), i));

function crearOpcion({ nombre, valor, marcada, deshabilitada, contenido, clase, etiqueta }) {
  const label = document.createElement('label');
  label.className = clase;
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = nombre;
  input.value = valor;
  input.checked = marcada;
  input.disabled = deshabilitada;
  if (etiqueta) input.setAttribute('aria-label', etiqueta);
  label.append(input, ...contenido);
  return label;
}

const span = (clase, texto) => {
  const s = document.createElement('span');
  s.className = clase;
  s.textContent = texto;
  return s;
};

function pintarServicios() {
  el.servicios.replaceChildren(
    ...SERVICIOS.map((s) =>
      crearOpcion({
        nombre: 'servicio',
        valor: s.id,
        marcada: s.id === estado.servicio,
        clase: 'opcion-servicio',
        contenido: [
          span('opcion-servicio__nombre', s.nombre),
          span('opcion-servicio__meta', `${s.minutos} min · ${formatearCop(s.precio)}`),
        ],
      }),
    ),
  );
}

function libresDe(fecha) {
  const b = barberoActual();
  return horariosDelDia(b, fecha, servicioActual().minutos, ocupadosDe(b.id)).filter(
    (h) => h.estado === 'libre',
  ).length;
}

function pintarDias() {
  const b = barberoActual();
  const fechas = fechasVisibles();
  const libres = new Map(fechas.map((f) => [f, estado.ocupacion ? libresDe(f) : 0]));
  if (!estado.fecha || !libres.get(estado.fecha)) {
    estado.fecha = fechas.find((f) => libres.get(f)) ?? fechas[0];
  }
  el.dias.replaceChildren(
    ...fechas.map((f, i) => {
      const n = libres.get(f);
      const descansa = jornada(b, f).length === 0;
      const nota = !estado.ocupacion
        ? 'Sin datos'
        : descansa
          ? 'Descansa'
          : n
            ? `${n} ${n === 1 ? 'libre' : 'libres'}`
            : 'Lleno';
      const encabezado = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : diaCorto(f);
      return crearOpcion({
        nombre: 'dia',
        valor: f,
        marcada: f === estado.fecha,
        deshabilitada: !n,
        clase: 'opcion-dia',
        etiqueta: `${encabezado} ${numeroDia(f)}, ${fechaLarga(f)}: ${descansa ? `${b.nombre} descansa` : n ? `${n} ${n === 1 ? 'hora libre' : 'horas libres'}` : 'sin horas libres'}`,
        contenido: [
          span('opcion-dia__semana', encabezado),
          span('opcion-dia__numero', String(numeroDia(f))),
          span('opcion-dia__nota', nota),
        ],
      });
    }),
  );
}

function pintarHoras() {
  const b = barberoActual();
  if (estado.error) {
    el.horas.replaceChildren();
    mostrarAvisoHoras(
      `No pudimos leer la agenda de ${b.nombre}. Escríbenos por WhatsApp y te damos un turno.`,
    );
    return;
  }
  const horas = horariosDelDia(b, estado.fecha, servicioActual().minutos, ocupadosDe(b.id)).filter(
    (h) => h.estado !== 'pasado',
  );
  if (!horas.some((h) => h.estado === 'libre' && h.inicio.toISOString() === estado.hora)) {
    estado.hora = null;
  }
  el.horas.replaceChildren(
    ...horas.map((h) => {
      const iso = h.inicio.toISOString();
      const texto = formatearHora(h.inicio);
      const motivo =
        h.estado === 'ocupado' ? 'ocupado' : h.estado === 'corto' ? 'no alcanza el tiempo' : '';
      return crearOpcion({
        nombre: 'hora',
        valor: iso,
        marcada: iso === estado.hora,
        deshabilitada: h.estado !== 'libre',
        clase: 'opcion-hora',
        etiqueta: motivo ? `${texto}, ${motivo}` : texto,
        contenido: [span('opcion-hora__texto', texto)],
      });
    }),
  );
  const libres = horas.filter((h) => h.estado === 'libre').length;
  mostrarAvisoHoras(
    libres
      ? ''
      : `${b.nombre} no tiene horas libres para ${servicioActual().nombre.toLowerCase()} ${diaRelativo(estado.fecha)}. Prueba otro día o un servicio más corto.`,
  );
}

function mostrarAvisoHoras(texto) {
  el.horasAviso.textContent = texto;
  el.horasAviso.hidden = !texto;
}

function pintarCabecera() {
  const b = barberoActual();
  el.inicial.textContent = b.nombre.charAt(0);
  el.nombre.textContent = nombreBarbero(b);
  el.detalle.textContent = `Silla ${b.silla} · ${b.especialidad}`;
  const e = estado.estados?.get(b.id);
  el.estado.textContent = estado.error ? 'Agenda no disponible' : detalleEstado(e);
  el.estado.dataset.estado = estado.error ? 'error' : (e?.tipo ?? 'cargando');
}

function mostrarError(texto) {
  el.error.textContent = texto;
  el.error.hidden = !texto;
}

export function elegirBarbero(id, { desdePlano = false } = {}) {
  const cambia = estado.barbero !== id;
  estado.barbero = id;
  if (cambia) {
    estado.fecha = null;
    estado.hora = null;
  }
  el.vacio.hidden = true;
  el.listo.hidden = true;
  el.form.hidden = false;
  mostrarError('');
  pintarCabecera();
  pintarServicios();
  pintarDias();
  pintarHoras();
  if (desdePlano) {
    const apilado = window.matchMedia('(max-width: 959px)').matches;
    if (apilado) {
      const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.panel.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    }
    el.nombre.focus({ preventScroll: true });
  }
}

// Llamado al cargar o recargar la agenda (datos nuevos) y cada minuto (solo cambia el estado)
export function actualizarReserva({ ocupacion, estados, error, datosNuevos }) {
  estado.ocupacion = ocupacion;
  estado.estados = estados;
  estado.error = error;
  if (!estado.barbero || el.form.hidden) return;
  pintarCabecera();
  if (!datosNuevos) return;
  // Se repinta sin perder el foco si estaba sobre un día o una hora
  const foco = document.activeElement;
  const enfocado =
    foco?.name && el.form.contains(foco) ? { name: foco.name, value: foco.value } : null;
  pintarDias();
  pintarHoras();
  if (enfocado) {
    el.form.querySelector(`input[name="${enfocado.name}"][value="${enfocado.value}"]`)?.focus();
  }
}

// Plantilla de evento de Google Calendar con la hora y la duración del servicio
function enlaceCalendario(inicio, servicio, { titulo, detalles }) {
  const fin = sumarMinutos(inicio, servicio.minutos);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: `${formatoGoogle(inicio)}/${formatoGoogle(fin)}`,
    details: detalles,
    location: `${MARCA.direccion}, ${MARCA.ciudad}`,
    ctz: 'America/Bogota',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

async function guardarCita(datos) {
  if (AGENDA.fuente !== 'google') return { demo: true };
  const respuesta = await fetch('/api/reservas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': estado.clave },
    body: JSON.stringify(datos),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const fallo = new Error(cuerpo.error?.message ?? 'No pudimos guardar la cita.');
    fallo.code = cuerpo.error?.code;
    throw fallo;
  }
  return cuerpo;
}

async function enviar(evento) {
  evento.preventDefault();
  const b = barberoActual();
  const servicio = servicioActual();
  const nombre = el.campoNombre.value.trim().replace(/\s+/g, ' ');
  el.campoNombre.removeAttribute('aria-invalid');
  if (!estado.hora) {
    mostrarError('Elige una hora para continuar.');
    el.horas.querySelector('input:not(:disabled)')?.focus();
    return;
  }
  if (nombre.length < 2) {
    mostrarError('Escribe tu nombre para que el barbero sepa a quién esperar.');
    el.campoNombre.setAttribute('aria-invalid', 'true');
    el.campoNombre.focus();
    return;
  }
  mostrarError('');
  const inicio = new Date(estado.hora);
  estado.clave ??= crypto.randomUUID();
  el.enviar.disabled = true;
  el.enviar.textContent = 'Reservando…';
  let resultado;
  try {
    resultado = await guardarCita({
      barbero: b.id,
      servicio: servicio.id,
      inicio: estado.hora,
      nombre,
    });
  } catch (e) {
    mostrarError(
      e.code === 'HORA_OCUPADA' || e.code === 'HORA_NO_DISPONIBLE'
        ? 'Esa hora se acaba de ocupar. Elige otra, por favor.'
        : `${e.message} Si sigue fallando, escríbenos por WhatsApp.`,
    );
    if (e.code === 'HORA_OCUPADA' || e.code === 'HORA_NO_DISPONIBLE') {
      estado.hora = null;
      estado.clave = null;
      estado.alCambiarAgenda();
    }
    return;
  } finally {
    el.enviar.disabled = false;
    el.enviar.textContent = 'Reservar cita';
  }

  const cuando = `${fechaLarga(estado.fecha)} a las ${formatearHora(inicio)}`;
  // Aviso opcional por WhatsApp: solo los datos de la cita, sin enlaces al calendario
  const mensaje = [
    `Hola, ${MARCA.nombre}. Soy ${nombre} y reservé en la página:`,
    `• Barbero: ${nombreBarbero(b)} (silla ${b.silla})`,
    `• Servicio: ${servicio.nombre} (${servicio.minutos} min, ${formatearCop(servicio.precio)})`,
    `• Día: ${cuando}`,
  ].join('\n');
  el.resumen.textContent = `${servicio.nombre} con ${nombreBarbero(b)}, ${cuando}.`;
  el.listoDetalle.textContent = resultado.demo
    ? 'Modo demostración: la cita no se guardó en ningún calendario.'
    : 'Ya quedó en la agenda del barbero. Si no puedes llegar, avísanos por WhatsApp para liberar la silla.';
  el.whatsapp.href = enlaceWhatsapp(mensaje);
  // Para el calendario personal del cliente (sin su nombre)
  el.calendario.href = enlaceCalendario(inicio, servicio, {
    titulo: `${servicio.nombre} en ${MARCA.nombre}`,
    detalles: `Con ${nombreBarbero(b)}, silla ${b.silla}. ${MARCA.direccion}, ${MARCA.ciudad}.`,
  });
  estado.clave = null;
  estado.hora = null;
  el.form.hidden = true;
  el.listo.hidden = false;
  el.listo.focus();
  estado.alCambiarAgenda();
}

export function iniciarReserva({ alCambiarAgenda } = {}) {
  if (alCambiarAgenda) estado.alCambiarAgenda = alCambiarAgenda;
  el.form.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (name === 'servicio') {
      estado.servicio = value;
      pintarDias();
      pintarHoras();
    } else if (name === 'dia') {
      estado.fecha = value;
      pintarHoras();
    } else if (name === 'hora') {
      estado.hora = value;
      estado.clave = null;
      mostrarError('');
    }
  });
  el.form.addEventListener('submit', enviar);
  $('[data-listo-otra]').addEventListener('click', () => {
    estado.hora = null;
    elegirBarbero(estado.barbero);
    el.nombre.focus();
  });
}
