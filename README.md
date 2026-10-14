# Barber Mafia — Landing de reservas

## Descripción

Landing de una barbería en Popayán con tres secciones:

1. **Inicio:** nombre, propuesta, cuántas sillas están libres en este momento y accesos a la
   agenda y a WhatsApp. Es corto a propósito para que la agenda quede casi a la vista.
2. **Agenda tu silla:** plano 2D del local visto desde arriba (entrada, tres puestos con silla,
   espejo y tocador, sala de espera, baño y vitrina con caja). Cada puesto muestra qué barbero
   atiende y su estado en vivo:
   - **Libre ahora:** lámpara encendida.
   - **Atendiendo:** hay un cliente con capa en la silla.
   - **Fuera de turno:** sin barbero en el puesto.

   Al tocar un puesto se abre la tarjeta de reserva: servicio, día (próximos 7), hora libre y
   nombre. La reserva sale por WhatsApp ya escrita, con un enlace para que la barbería la aparte en
   Google Calendar con un toque. El cliente también puede añadirla a su propio calendario.

3. **Pie de página:** WhatsApp, correo, redes, dirección con "Cómo llegar" y horario.

Colores: azul oscuro de noche, blanco y hueso. Incluye el preloader sello BWL & SOFT ("ola
difuminada") con una ola blanca y hueso sobre azul.

## Supuestos (validar con el cliente)

Todo está marcado con `TODO cliente` en [`js/config.js`](js/config.js).

- Ciudad **Popayán**, dirección _Calle 5 # 8-24, Centro_ y año de apertura 2019: inventados.
- WhatsApp `+57 320 936 7458`: número de Johan para pruebas. Correo `hola@barbermafia.co`: de ejemplo.
- Barberos: **Andrés "El Don"** (silla 1, descansa los lunes), **Camilo "Navaja"** (silla 2,
  descansa los martes) y **Julián "El Capo"** (silla 3, descansa los domingos). Nombres, apodos,
  especialidades, días de descanso y almuerzos son de ejemplo.
- Horario: lunes a sábado de 9:00 a. m. a 8:00 p. m.; domingo de 10:00 a. m. a 3:00 p. m.
- Servicios y precios de referencia: corte clásico $ 30.000 (45 min), fade y diseño $ 35.000
  (60 min), barba con toalla caliente $ 25.000 (30 min), corte y barba $ 50.000 (75 min).
- La ocupación que se ve ahora es **de demostración** (`AGENDA.fuente = 'demo'`).
- El plano sigue el boceto del cliente: entrada arriba, silla 2 a la izquierda y silla 3 a la
  derecha de la entrada, silla 1 debajo de la 2, sala de espera contra la pared derecha, WC y
  muebles al fondo. Los "muebles" se interpretaron como vitrina de productos con caja.

### Pendiente del cliente

- Datos reales de contacto, dirección, redes sociales (Instagram, Facebook, TikTok: si están
  vacías no se muestran) y año de apertura.
- Nombres y turnos de los barberos; servicios, duraciones y precios.
- Para conectar Google Calendar: un calendario por barbero y una clave de Google Cloud (ver abajo).

## Stack

- HTML + CSS + JavaScript (módulos ES), sin build.
- Una función serverless de Vercel (`api/disponibilidad.js`, Node 22 + Zod) que consulta Google
  Calendar con la clave guardada en el servidor.
- GSAP 3.12.5 + ScrollTrigger desde cdnjs, para la entrada del título y el encendido de las lámparas.
- Tipografías de Google Fonts: Big Shoulders Display (títulos) e Instrument Sans (texto).
- Google Calendar API (free/busy).

## Requisitos

- Node 22 o superior y npm.

## Instalación y cómo correr

```bash
npm install
cp .env.example .env   # y pega la clave de Google en GOOGLE_CALENDAR_API_KEY
npm run dev
```

Abre `http://localhost:5180`. El preloader sale una vez por pestaña. Para verlo otra vez, abre una
pestaña nueva. No aparece si el sistema tiene activado "reducir movimiento" ni si la URL trae `#ancla`.

## Variables de entorno

| Variable                  | Dónde                                                                          | Para qué                                                |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `GOOGLE_CALENDAR_API_KEY` | `.env` en local (nunca se sube) y _Settings → Environment Variables_ en Vercel | Clave de Google Cloud restringida a Google Calendar API |

La clave **nunca llega al navegador**: la usa solo la función `api/disponibilidad.js`. Los IDs de
los calendarios también viven en el servidor ([`api/_calendarios.js`](api/_calendarios.js)).

## Conectar Google Calendar

Se configura una sola vez:

1. Con la cuenta de Google de la barbería, crea un calendario por barbero (_Silla 1 · Andrés_,
   _Silla 2 · Camilo_, _Silla 3 · Julián_) y compártelo con cada barbero con permiso **Hacer cambios
   en eventos**. Así cada uno lo maneja desde la app Google Calendar de su celular.
2. En la configuración de cada calendario: _Permisos de acceso_ → _Hacer público_ → **Ver solo
   libre/ocupado (ocultar detalles)**. Copia el **ID del calendario** (en _Integrar el calendario_).
3. En Google Cloud Console: crea un proyecto, habilita **Google Calendar API** y crea una
   **clave de API**. En _Restricciones de API_ deja solo **Google Calendar API**. En _Restricciones
   de aplicaciones_ elige **Ninguno**: quien llama es el servidor de Vercel, que no envía sitio web
   de origen ni tiene una IP fija.
4. Pon los IDs en [`api/_calendarios.js`](api/_calendarios.js) (la clave del objeto es el `id` del
   barbero en `js/config.js`) y la clave en la variable `GOOGLE_CALENDAR_API_KEY`.

### Cómo marca el barbero una hora ocupada (sin panel de administrador)

El panel es la app **Google Calendar** del celular. Cualquier evento en el calendario de un barbero
ocupa esa franja en la página. No importa el título y nadie más ve los detalles.

| Situación                           | Qué hace el barbero en Google Calendar                                                                                                | Qué pasa en la página                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Llega una reserva por WhatsApp      | Toca el enlace _"Para la barbería, apartar en el calendario de…"_ que trae el mensaje, revisa que esté elegido su calendario y guarda | Esa hora deja de aparecer libre                          |
| Cliente sin cita (llega al local)   | Crea un evento ahora, por la duración del corte                                                                                       | Su silla pasa a "Atendiendo", con el cliente en el plano |
| Cita por teléfono o en persona      | Crea el evento en el día y la hora                                                                                                    | Hora ocupada                                             |
| Día libre, vacaciones o incapacidad | Evento de **todo el día** (o de varios días)                                                                                          | Ese día sale lleno                                       |
| Sale antes o llega tarde            | Evento que cubra esas horas                                                                                                           | Esas horas ocupadas                                      |
| Cancelan una cita                   | Borra el evento                                                                                                                       | La hora vuelve a quedar libre                            |

Los eventos marcados como **Disponible** (en vez de _Ocupado_) no bloquean. La página vuelve a leer
el calendario cada 5 minutos y cada vez que alguien la abre.

La página pide a `/api/disponibilidad` los bloques ocupados de los próximos 7 días. La respuesta
queda 60 s en la caché de Vercel, así que muchas visitas generan pocas consultas a Google. La
página los vuelve a leer cada 5 minutos y
calcula las horas libres con el horario del local, los descansos y los almuerzos. Si Google no
responde, la página avisa "Agenda no disponible" y ofrece WhatsApp. El detalle técnico queda en la
consola del navegador.

La decisión y sus límites (posible doble reserva hasta que la barbería confirme) están en
[`docs/adr/0001-agenda-sin-backend.md`](docs/adr/0001-agenda-sin-backend.md), junto con la fase 2
propuesta: un backend que cree el evento directamente.

## Scripts

| Script           | Qué hace                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `npm run dev`    | Landing y `/api/disponibilidad` en `http://localhost:5180`, como en Vercel |
| `npm run format` | Formatea con Prettier                                                      |
| `npm run check`  | Formato y sintaxis de la función y del servidor local                      |

## Estructura

```
index.html                 Estructura: inicio, plano SVG + reserva, pie de página
css/reset.css              Reset compartido (no tocar)
css/entrada.css            Preloader sello BWL & SOFT
css/style.css              Tokens de color y tipografía, layout, plano y tarjeta de reserva
js/config.js               ÚNICA fuente de datos: marca, horario, servicios, barberos y agenda
js/intro.js                Decide si se muestra el preloader (va en <head>, sin defer)
js/tiempo.js               Fechas y horas en America/Bogota
js/formato.js              Pesos colombianos ($ 30.000)
js/disponibilidad.js       Turnos, horas libres, estado actual y fuentes (demo / Google)
js/plano.js                Estado de cada silla en el plano
js/reserva.js              Tarjeta de reserva y mensaje de WhatsApp
js/main.js                 Arranque: rellena la marca y coordina plano, reserva y resumen
js/animation.js            GSAP: entrada del título y encendido de lámparas
assets/icons/favicon.svg   Poste de barbería
assets/images/og.png       Imagen para redes (1200 × 630)
api/disponibilidad.js      Función de Vercel: consulta Google Calendar con la clave del servidor
api/_calendarios.js        ID del calendario de cada barbero (solo servidor)
scripts/servidor-local.mjs Servidor de desarrollo (npm run dev)
docs/adr/                  Decisiones de arquitectura
vercel.json                Cabeceras de seguridad en Vercel
_headers                   Las mismas cabeceras para Cloudflare Pages / Netlify
```

## Personalización

| Qué                                                      | Dónde                                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre, eslogan, presentación, contacto, redes           | `MARCA` en `js/config.js`                                                                                                                                         |
| Horario del local                                        | `HORARIO_LOCAL` en `js/config.js`                                                                                                                                 |
| Servicios, duración y precio                             | `SERVICIOS` en `js/config.js`                                                                                                                                     |
| Barberos, silla, descanso y almuerzo                     | `BARBEROS` en `js/config.js`                                                                                                                                      |
| Intervalo entre turnos, antelación mínima, días visibles | `AGENDA` en `js/config.js`                                                                                                                                        |
| Colores y tipografías                                    | `:root` en `css/style.css` (y `--pre-*` en `css/entrada.css`)                                                                                                     |
| Distribución del local                                   | SVG `.plano__dibujo` en `index.html` (viewBox 400 × 600). Si mueves un puesto, ajusta su `.silla-boton[data-silla]` en `css/style.css` (porcentajes del viewBox). |

## Despliegue

**Vercel** (por la función de `api/`):

1. _Add New → Project_ e importa el repositorio. Framework Preset: **Other**, sin comando de build.
2. _Settings → Environment Variables_: agrega `GOOGLE_CALENDAR_API_KEY` para Production y Preview.
3. Despliega. Las cabeceras de seguridad salen de `vercel.json`.

Si cambias la variable, vuelve a desplegar para que la función la tome.

## Seguridad

- CSP estricta sin `unsafe-inline`: no hay scripts ni estilos en línea.
- La página no guarda datos personales (Ley 1581). El nombre del cliente solo viaja en el mensaje
  de WhatsApp que él mismo envía; el enlace para la barbería lo lleva al título del evento en su
  calendario privado. El enlace "Añadir a Google Calendar" del cliente no incluye el nombre.
- Los precios son informativos; no hay pagos en línea.
- La clave de Google vive solo en variables de entorno del servidor y está restringida a Calendar
  API. Las respuestas de error al navegador no incluyen detalles internos; los logs no la imprimen.
- `connect-src 'self'`: el navegador solo habla con el mismo dominio.
