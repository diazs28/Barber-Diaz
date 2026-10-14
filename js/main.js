// Arranque: datos de marca, menú móvil, horario del pie y agenda (plano + reserva).
import {
  AGENDA,
  BARBEROS,
  HORARIO_LOCAL,
  MARCA,
  enlaceMapa,
  enlaceWhatsapp,
  telefonoVisible,
} from './config.js';
import { cargarOcupacion, estadoAhora } from './disponibilidad.js';
import { iniciarPlano, marcarElegido, pintarPlano, resumenAhora } from './plano.js';
import { actualizarReserva, elegirBarbero, iniciarReserva } from './reserva.js';
import { hoy, instante, formatearHora } from './tiempo.js';

// 1. Textos y enlaces de marca: data-marca="<clave>" y data-enlace="whatsapp|mapa|correo"
document.querySelectorAll('[data-marca]').forEach((el) => {
  const valor = MARCA[el.dataset.marca];
  if (typeof valor === 'string') el.textContent = valor;
});
document.querySelectorAll('[data-telefono]').forEach((el) => {
  el.textContent = telefonoVisible();
});

const enlaces = {
  whatsapp: () => enlaceWhatsapp(),
  mapa: () => enlaceMapa(),
  correo: () => `mailto:${MARCA.correo}`,
};
document.querySelectorAll('[data-enlace]').forEach((el) => {
  const crear = enlaces[el.dataset.enlace];
  if (crear) el.setAttribute('href', crear());
});

Object.entries(MARCA.redes).forEach(([red, url]) => {
  document.querySelectorAll(`[data-red="${red}"]`).forEach((el) => {
    if (url) el.querySelector('a')?.setAttribute('href', url);
    else el.remove();
  });
});

// Título del inicio: una línea por palabra del nombre
const titulo = document.querySelector('[data-titulo-marca]');
if (titulo) {
  titulo.replaceChildren(
    ...MARCA.nombre.split(' ').map((palabra) => {
      // La máscara recorta la línea mientras sube (animation.js)
      const mascara = document.createElement('span');
      mascara.className = 'hero__mascara';
      const linea = document.createElement('span');
      linea.className = 'hero__linea';
      linea.textContent = palabra;
      mascara.append(linea);
      return mascara;
    }),
  );
}

// Preloader: el contador lee data-desde al cargar el DOM (después de este módulo)
const contador = document.querySelector('[data-bwl-contador]');
if (contador) {
  if (MARCA.fundacion) {
    contador.dataset.desde = String(MARCA.fundacion);
    contador.textContent = String(MARCA.fundacion);
  } else contador.remove();
}
const sello = document.querySelector('[data-marca="creditoDesarrollo"]');
if (sello && !MARCA.creditoDesarrollo) sello.remove();

document.title = `${MARCA.nombre} | Agenda tu corte en ${MARCA.ciudad}`;

// 2. Menú móvil accesible
const boton = document.querySelector('[data-menu-boton]');
const menu = document.querySelector('[data-menu]');
if (boton && menu) {
  const cerrar = () => {
    boton.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-abierto');
  };
  boton.addEventListener('click', () => {
    const abierto = boton.getAttribute('aria-expanded') === 'true';
    boton.setAttribute('aria-expanded', String(!abierto));
    menu.classList.toggle('is-abierto', !abierto);
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrar));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && cerrar());
}

// 3. Año actual
document.querySelectorAll('[data-anio]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

// 4. Horario agrupado por días con el mismo turno: "Lunes a sábado: 9:00 a. m. – 8:00 p. m."
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function horarioAgrupado() {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const grupos = [];
  orden.forEach((dia) => {
    const h = HORARIO_LOCAL[dia];
    const clave = h ? h.join('-') : 'cerrado';
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.clave === clave) ultimo.hasta = dia;
    else grupos.push({ clave, desde: dia, hasta: dia, horario: h });
  });
  const ref = hoy();
  return grupos.map((g) => ({
    dias:
      g.desde === g.hasta
        ? NOMBRES_DIA[g.desde]
        : `${NOMBRES_DIA[g.desde]} a ${NOMBRES_DIA[g.hasta].toLowerCase()}`,
    horas: g.horario
      ? `${formatearHora(instante(ref, g.horario[0]))} – ${formatearHora(instante(ref, g.horario[1]))}`
      : 'Cerrado',
  }));
}
document.querySelectorAll('[data-horario]').forEach((lista) => {
  lista.replaceChildren(
    ...horarioAgrupado().map(({ dias, horas }) => {
      const li = document.createElement('li');
      const d = document.createElement('span');
      d.textContent = dias;
      const h = document.createElement('span');
      h.textContent = horas;
      li.append(d, h);
      return li;
    }),
  );
});

// 5. Agenda: plano + panel de reserva + resumen del inicio
const ahoraMismo = document.querySelector('[data-ahora]');
let ocupacion = null;
let errorAgenda = false;

function pintar(datosNuevos = false) {
  const ahora = new Date();
  const estados = ocupacion
    ? new Map(BARBEROS.map((b) => [b.id, estadoAhora(b, ocupacion.get(b.id) ?? [], ahora)]))
    : null;
  pintarPlano(estados, errorAgenda);
  actualizarReserva({ ocupacion, estados, error: errorAgenda, datosNuevos });
  if (ahoraMismo) {
    const resumen = resumenAhora(estados, errorAgenda);
    ahoraMismo.dataset.estado = resumen.tipo;
    const texto = ahoraMismo.querySelector('[data-ahora-texto]');
    if (texto.textContent !== resumen.texto) texto.textContent = resumen.texto;
  }
}

async function recargar() {
  try {
    ocupacion = await cargarOcupacion(hoy());
    errorAgenda = false;
  } catch (error) {
    console.error('[agenda] No se pudo cargar la disponibilidad:', error);
    errorAgenda = true;
  }
  pintar(true);
}

iniciarPlano((id, opciones) => {
  marcarElegido(id);
  elegirBarbero(id, opciones);
});
iniciarReserva();
pintar();
recargar();
setInterval(() => pintar(), 60_000);
setInterval(recargar, AGENDA.recargaMin * 60_000);
