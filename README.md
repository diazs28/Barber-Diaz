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
   nombre. Al reservar, la cita se guarda sola en el Google Calendar del barbero. Después el cliente
   puede avisar por WhatsApp o añadirla a su propio calendario; nunca recibe enlaces para editar la
   agenda del barbero.

3. **Pie de página:** WhatsApp, correo, redes, dirección con "Cómo llegar" y horario.

Colores: azul oscuro de noche, blanco y hueso. Incluye el preloader sello BWL & SOFT ("ola
difuminada") con una ola blanca y hueso sobre azul.

## Supuestos (validar con el cliente)

Todo está marcado con `TODO cliente` en [`js/config.js`](js/config.js).

- Ciudad **Popayán**, dirección _Calle 5 # 8-24, Centro_ y año de apertura 2019: inventados.
- WhatsApp `+57 320 936 7458`: número de Johan para pruebas. Correo `hola@barbermafia.co`: de ejemplo.
- Barberos de prueba: **Alexander** (silla 1, descansa los lunes), **David** (silla 2, descansa
  los martes) y **X** (silla 3, descansa los domingos). Especialidades, descansos y almuerzos son de
  ejemplo.
- Horario: lunes a sábado de 9:00 a. m. a 8:00 p. m.; domingo de 10:00 a. m. a 3:00 p. m.
- Servicios y precios de referencia: corte clásico $ 30.000 (45 min), fade y diseño $ 35.000
  (60 min), barba con toalla caliente $ 25.000 (30 min), corte y barba $ 50.000 (75 min).
- Calendarios de prueba en `magiabarber8@gmail.com`. Al vender la landing se crean en la cuenta del negocio.
- El plano sigue el boceto del cliente: entrada arriba, silla 2 a la izquierda y silla 3 a la
  derecha de la entrada, silla 1 debajo de la 2, sala de espera contra la pared derecha, WC y
  muebles al fondo. Los "muebles" se interpretaron como vitrina de productos con caja.

### Pendiente del cliente

- Datos reales de contacto, dirección, redes sociales (Instagram, Facebook, TikTok: si están
  vacías no se muestran) y año de apertura.
- Nombres y turnos de los barberos; servicios, duraciones y precios.
- Cuenta de Google del negocio con un calendario por barbero (ver abajo).

## Stack

- HTML + CSS + JavaScript (módulos ES), sin build.
- Funciones serverless de Vercel (Node 22 + Zod): `api/disponibilidad.js` lee la ocupación y
  `api/reservas.js` crea las citas, ambas con una cuenta de servicio de Google guardada en el
  servidor.
- GSAP 3.12.5 + ScrollTrigger desde cdnjs, para la entrada del título y el encendido de las lámparas.
- Tipografías de Google Fonts: Big Shoulders Display (títulos) e Instrument Sans (texto).
- Google Calendar API (free/busy y eventos). Pruebas con `node:test`.

## Requisitos

- Node 22 o superior y npm.

## Instalación y cómo correr

```bash
npm install
cp .env.example .env   # y pega la llave JSON en GOOGLE_SERVICE_ACCOUNT_JSON
npm run dev
```

Abre `http://localhost:5180`. El preloader sale una vez por pestaña. Para verlo otra vez, abre una
pestaña nueva. No aparece si el sistema tiene activado "reducir movimiento" ni si la URL trae `#ancla`.

## Variables de entorno

| Variable                      | Para qué                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Llave JSON completa de la cuenta de servicio. Lee la ocupación y crea las citas.             |
| `GOOGLE_CALENDAR_API_KEY`     | Opcional. Respaldo de solo lectura si no hay cuenta de servicio (las reservas no funcionan). |

En local van en el archivo de variables (copia de `.env.example`, nunca se sube); en Vercel, en
_Settings → Environment Variables_, tipo **Secret**. Las credenciales **nunca llegan al navegador**
y los logs no las imprimen. Los IDs de los calendarios también viven en el servidor
([`api/_calendarios.js`](api/_calendarios.js)).

## Conectar Google Calendar

Se configura una sola vez:

1. Con una **cuenta Gmail del negocio** crea un calendario por barbero (_Silla 1 - Alexander_…).
   Las cuentas de una universidad o empresa suelen bloquear el permiso de edición hacia fuera.
2. En cada calendario, _Permisos de acceso_ → **Compartir públicamente** → **Ver solo
   libre/ocupado (ocultar detalles)**.
3. En _Compartido con_ agrega `reservas-web@magiabarber.iam.gserviceaccount.com` con
   **Hacer cambios y ver todos los detalles del evento**. Agrega también a cada barbero, con
   _Hacer cambios en eventos_, en su propio calendario: así solo ellos y la página lo editan.
4. Copia el **ID del calendario** (en _Integrar el calendario_) a
   [`api/_calendarios.js`](api/_calendarios.js) (la clave del objeto es el `id` del barbero en
   `js/config.js`).
5. En Google Cloud (proyecto `magiabarber`, cuenta magiabarber8@gmail.com) → _IAM → Cuentas de servicio_ → `reservas-web` →
   _Claves_ → _Agregar clave → JSON_. Pega el contenido del archivo en `GOOGLE_SERVICE_ACCOUNT_JSON`
   y borra el archivo descargado.

### Cómo funciona una reserva

1. El cliente elige silla, servicio, día, hora y escribe su nombre.
2. `POST /api/reservas` revisa la franja con las mismas reglas que ve el cliente (horario,
   almuerzo, descanso, antelación de 60 min y duración del servicio) y la ocupación real.
3. Crea el evento "_Servicio · Nombre_" en el calendario del barbero. Si en ese mismo instante otra
   persona reservó una hora que se cruza, se retira la propia y el cliente ve "Esa hora se acaba de
   ocupar". Un reintento con la misma `Idempotency-Key` no duplica la cita.
4. La página se actualiza sin caché y la hora sale ocupada. El cliente puede avisar por WhatsApp
   (solo los datos de la cita, sin enlaces) o añadirla a su propio calendario.

### Cómo marca el barbero una hora ocupada (sin panel de administrador)

El panel es la app **Google Calendar** del celular. Cualquier evento en el calendario de un barbero
ocupa esa franja en la página. No importa el título y nadie más ve los detalles.

| Situación                           | Qué hace el barbero en Google Calendar          | Qué pasa en la página                                    |
| ----------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Llega una reserva por la página     | Nada: ya está en su calendario                  | Esa hora deja de aparecer libre                          |
| Cliente sin cita (llega al local)   | Crea un evento ahora, por la duración del corte | Su silla pasa a "Atendiendo", con el cliente en el plano |
| Cita por teléfono o en persona      | Crea el evento en el día y la hora              | Hora ocupada                                             |
| Día libre, vacaciones o incapacidad | Evento de **todo el día** (o de varios días)    | Ese día sale lleno                                       |
| Sale antes o llega tarde            | Evento que cubra esas horas                     | Esas horas ocupadas                                      |
| Cancelan una cita                   | Borra el evento                                 | La hora vuelve a quedar libre                            |

Los eventos marcados como **Disponible** (en vez de _Ocupado_) no bloquean. La página vuelve a leer
el calendario cada 5 minutos y cada vez que alguien la abre.

La página pide a `/api/disponibilidad` los bloques ocupados de los próximos 7 días. La respuesta
queda 60 s en la caché de Vercel, así que muchas visitas generan pocas consultas a Google. La
página los vuelve a leer cada 5 minutos y
calcula las horas libres con el horario del local, los descansos y los almuerzos. Si Google no
responde, la página avisa "Agenda no disponible" y ofrece WhatsApp. El detalle técnico queda en la
consola del navegador.

Las decisiones están en [`docs/adr/0001-agenda-sin-backend.md`](docs/adr/0001-agenda-sin-backend.md).

## Scripts

| Script           | Qué hace                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `npm run dev`    | Landing y `/api/disponibilidad` en `http://localhost:5180`, como en Vercel |
| `npm run format` | Formatea con Prettier                                                      |
| `npm test`       | Pruebas de la reserva (Google simulado: no toca calendarios reales)        |
| `npm run check`  | Formato, sintaxis y pruebas                                                |

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
js/reserva.js              Tarjeta de reserva: guarda la cita y ofrece avisar por WhatsApp
js/main.js                 Arranque: rellena la marca y coordina plano, reserva y resumen
js/animation.js            GSAP: entrada del título y encendido de lámparas
assets/icons/favicon.svg   Poste de barbería
assets/images/og.png       Imagen para redes (1200 × 630)
api/disponibilidad.js      Función de Vercel: ocupación de cada barbero
api/reservas.js            Función de Vercel: crea la cita (valida y llama a _reservar.js)
api/_reservar.js           Regla de negocio de la reserva
api/_google.js             Token de la cuenta de servicio y llamadas a Calendar API
api/_calendarios.js        ID del calendario de cada barbero (solo servidor)
test/                      Pruebas de la reserva (npm test)
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
2. _Settings → Environment Variables_: agrega `GOOGLE_SERVICE_ACCOUNT_JSON` (tipo Secret) para
   Production y Preview.
3. Despliega. Las cabeceras de seguridad salen de `vercel.json`.

Si cambias la variable, vuelve a desplegar para que la función la tome.

## Seguridad

- CSP estricta sin `unsafe-inline`: no hay scripts ni estilos en línea.
- Datos personales (Ley 1581): solo se pide el nombre, con aviso antes de reservar. Queda en el
  calendario privado del barbero; públicamente los calendarios muestran solo libre/ocupado. El
  enlace "Añadir a mi Google Calendar" del cliente no incluye el nombre.
- El nombre solo admite letras (sin enlaces ni código) y se valida con Zod en el servidor.
- Pendiente antes de producción real: límite de peticiones por IP en el Firewall de Vercel.
- Los precios son informativos; no hay pagos en línea.
- Las credenciales de Google viven solo en variables de entorno del servidor. La cuenta de
  servicio solo tiene acceso a los 3 calendarios compartidos. Las respuestas de error al navegador no incluyen detalles internos; los logs no la imprimen.
- `connect-src 'self'`: el navegador solo habla con el mismo dominio.
