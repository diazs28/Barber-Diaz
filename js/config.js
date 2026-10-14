// ÚNICA fuente de los datos de marca, barberos, servicios y agenda.
// Todo dato no confirmado por el cliente va marcado con TODO cliente.
export const MARCA = {
  nombre: 'Barber Mafia',
  eslogan: 'Cortes de la vieja escuela. Tu silla, a tu hora.',
  descripcion:
    'Barbería en el centro de Popayán. Mira en el plano qué barbero está libre y agenda tu corte en minutos.', // TODO cliente
  presentacion:
    'Tres sillas, tres barberos y oficio de la vieja escuela: tijera, navaja y toalla caliente. Elige tu barbero en el plano del local, mira sus horas libres y aparta tu turno sin hacer fila.', // TODO cliente
  lema: 'Barbería · Popayán', // Texto pequeño del preloader
  fundacion: 2019, // TODO cliente: año de apertura (contador del preloader)
  ciudad: 'Popayán', // TODO cliente
  direccion: 'Calle 5 # 8-24, Centro', // TODO cliente
  // Solo dígitos, con indicativo 57 y sin "+" ni espacios.
  whatsapp: '573000000000', // TODO cliente
  mensajeWhatsapp: 'Hola, Barber Mafia. Quiero agendar un corte.',
  correo: 'hola@barbermafia.co', // TODO cliente
  redes: {
    instagram: '', // TODO cliente: URL completa del perfil
    facebook: '',
    tiktok: '',
  },
  creditoDesarrollo: 'Experiencia digital · BWL & SOFT', // Vacío = sin sello en el preloader
};

// Horario del local por día de la semana (0 = domingo … 6 = sábado). null = cerrado.
// TODO cliente
export const HORARIO_LOCAL = {
  0: ['10:00', '15:00'],
  1: ['09:00', '20:00'],
  2: ['09:00', '20:00'],
  3: ['09:00', '20:00'],
  4: ['09:00', '20:00'],
  5: ['09:00', '20:00'],
  6: ['09:00', '20:00'],
};

// Precios de referencia en pesos enteros (solo informativos: el pago se hace en el local).
// TODO cliente: servicios, duración y precios reales.
export const SERVICIOS = [
  { id: 'clasico', nombre: 'Corte clásico', minutos: 45, precio: 30000 },
  { id: 'fade', nombre: 'Fade y diseño', minutos: 60, precio: 35000 },
  { id: 'barba', nombre: 'Barba con toalla caliente', minutos: 30, precio: 25000 },
  { id: 'completo', nombre: 'Corte y barba', minutos: 75, precio: 50000 },
];

// La silla corresponde al puesto del plano (ver index.html, data-silla).
// descansa: días sin turno (0 = domingo). almuerzo: pausa diaria.
// calendarioId: ID del Google Calendar del barbero (solo con AGENDA.fuente = 'google').
// TODO cliente: nombres, apodos, especialidades y turnos reales.
export const BARBEROS = [
  {
    id: 'andres',
    silla: 1,
    nombre: 'Andrés',
    apodo: 'El Don',
    especialidad: 'Cortes clásicos y a tijera',
    descansa: [1],
    almuerzo: ['12:00', '13:00'],
    calendarioId: '',
  },
  {
    id: 'camilo',
    silla: 2,
    nombre: 'Camilo',
    apodo: 'Navaja',
    especialidad: 'Barba, perfilado y afeitado con navaja',
    descansa: [2],
    almuerzo: ['13:00', '14:00'],
    calendarioId: '',
  },
  {
    id: 'julian',
    silla: 3,
    nombre: 'Julián',
    apodo: 'El Capo',
    especialidad: 'Fade, degradados y diseños',
    descansa: [0],
    almuerzo: ['14:00', '15:00'],
    calendarioId: '',
  },
];

export const AGENDA = {
  // 'demo': ocupación de ejemplo (siempre la misma para cada día).
  // 'google': lee los bloques ocupados de cada calendarioId con la API free/busy de Google Calendar.
  fuente: 'demo',
  // Clave de navegador de Google Cloud, restringida a este dominio y solo a Calendar API (ver README).
  googleApiKey: '',
  diasVisibles: 7,
  intervaloMin: 30, // Cada cuánto empieza un turno
  anticipacionMin: 60, // No se reserva con menos de esta antelación
  recargaMin: 5, // Cada cuánto se vuelve a leer la agenda
};

export const enlaceWhatsapp = (mensaje = MARCA.mensajeWhatsapp) =>
  `https://wa.me/${MARCA.whatsapp}?text=${encodeURIComponent(mensaje)}`;

export const enlaceMapa = () =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${MARCA.direccion}, ${MARCA.ciudad}, Colombia`,
  )}`;

// "573000000000" → "+57 300 000 0000"
export const telefonoVisible = () => {
  const n = MARCA.whatsapp.replace(/^57/, '');
  return `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
};
