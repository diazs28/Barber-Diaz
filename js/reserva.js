// Panel de reserva: barbero elegido → servicio → día → hora → nombre → mensaje de WhatsApp.
// No se guarda ningún dato en la página: la cita la confirma la barbería por WhatsApp.
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
};

const estado = {
  barbero: null,
  servicio: SERVICIOS[0].id,
  fecha: null,
  hora: null, // ISO del inicio elegido
  ocupacion: null,
  estados: null,
  error: false,
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

function enviar(evento) {
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
  if (!nombre) {
    mostrarError('Escribe tu nombre para que el barbero sepa a quién esperar.');
    el.campoNombre.setAttribute('aria-invalid', 'true');
    el.campoNombre.focus();
    return;
  }
  mostrarError('');
  const inicio = new Date(estado.hora);
  const cuando = `${fechaLarga(estado.fecha)} a las ${formatearHora(inicio)}`;
  const mensaje = [
    `Hola, ${MARCA.nombre}. Soy ${nombre} y quiero reservar:`,
    `• Barbero: ${nombreBarbero(b)} (silla ${b.silla})`,
    `• Servicio: ${servicio.nombre} (${servicio.minutos} min, ${formatearCop(servicio.precio)})`,
    `• Día: ${cuando}`,
    '¿Me confirman, por favor?',
    '',
    // La barbería toca este enlace, guarda el evento y esa hora queda ocupada en la página
    `Para la barbería, apartar en el calendario de ${b.nombre}: ${enlaceCalendario(
      inicio,
      servicio,
      {
        titulo: `${servicio.nombre} · ${nombre}`,
        detalles: `Reserva desde la página web. Cliente: ${nombre}. Silla ${b.silla}.`,
      },
    )}`,
  ].join('\n');
  const whatsapp = enlaceWhatsapp(mensaje);
  window.open(whatsapp, '_blank', 'noopener');

  el.resumen.textContent = `${servicio.nombre} con ${nombreBarbero(b)}, ${cuando}.`;
  el.whatsapp.href = whatsapp;
  // Sin el nombre: este enlace es para el calendario personal del cliente
  el.calendario.href = enlaceCalendario(inicio, servicio, {
    titulo: `${servicio.nombre} en ${MARCA.nombre}`,
    detalles: `Con ${nombreBarbero(b)}, silla ${b.silla}. Cita sujeta a confirmación por WhatsApp.`,
  });
  el.form.hidden = true;
  el.listo.hidden = false;
  el.listo.focus();
}

export function iniciarReserva() {
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
