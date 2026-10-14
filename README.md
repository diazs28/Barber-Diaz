# Barber Mafia — Landing de reservas

## Descripción

Landing de una barbería en Popayán con tres secciones:

1. **Inicio:** nombre, propuesta, cuántas sillas están libres en este momento, dirección, horario y
   carta de servicios con precios.
2. **Agenda tu silla:** plano 2D del local visto desde arriba (entrada, tres puestos con silla,
   espejo y tocador, sala de espera, baño y vitrina con caja). Cada puesto muestra qué barbero
   atiende y su estado en vivo:
   - **Libre ahora:** lámpara encendida.
   - **Atendiendo:** hay un cliente con capa en la silla.
   - **Fuera de turno:** sin barbero en el puesto.

   Al tocar un puesto se abre la tarjeta de reserva: servicio, día (próximos 7), hora libre y
   nombre. La reserva sale por WhatsApp ya escrita y se puede añadir a Google Calendar.

3. **Pie de página:** WhatsApp, correo, redes, dirección con "Cómo llegar" y horario.

Incluye el preloader sello BWL & SOFT ("ola difuminada") en latón y sangre de buey.

## Supuestos (validar con el cliente)

Todo está marcado con `TODO cliente` en [`js/config.js`](js/config.js).

- Ciudad **Popayán**, dirección _Calle 5 # 8-24, Centro_ y año de apertura 2019: inventados.
- WhatsApp `+57 300 000 0000` y correo `hola@barbermafia.co`: de ejemplo.
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
- GSAP 3.12.5 + ScrollTrigger desde cdnjs, para la entrada del título y el encendido de las lámparas.
- Tipografías de Google Fonts: Big Shoulders Display (títulos) e Instrument Sans (texto).
- Google Calendar API (free/busy), opcional.

## Requisitos

- Cualquier servidor estático. En local: Python 3 (`python -m http.server`) o `npx serve`.

## Instalación y cómo correr

```bash
python -m http.server 5180
```

Abre `http://localhost:5180`. El preloader sale una vez por pestaña. Para verlo otra vez, abre una
pestaña nueva. No aparece si el sistema tiene activado "reducir movimiento" ni si la URL trae `#ancla`.

## Variables de entorno

No hay. La configuración vive en [`js/config.js`](js/config.js). La clave de Google
(`AGENDA.googleApiKey`) es una clave **de navegador**, pública por diseño. Debe restringirse por
dominio y a Calendar API. No pongas ahí claves de cuentas de servicio ni secretos de OAuth.

## Conectar Google Calendar

1. Cada barbero crea (o usa) un Google Calendar donde la barbería anota sus citas.
2. En la configuración de cada calendario: _Permisos de acceso_ → _Hacer público_ → **Ver solo
   libre/ocupado (ocultar detalles)**. Copia el **ID del calendario** (en _Integrar el calendario_).
3. En Google Cloud Console: crea un proyecto, habilita **Google Calendar API** y crea una
   **clave de API**. Restríngela a _Sitios web_ (el dominio de la landing) y a _Google Calendar API_.
4. En `js/config.js`: `AGENDA.fuente = 'google'`, `AGENDA.googleApiKey = '<clave>'` y
   `calendarioId` en cada barbero.

La página lee los bloques ocupados de los próximos 7 días, los vuelve a leer cada 5 minutos y
calcula las horas libres con el horario del local, los descansos y los almuerzos. Si Google no
responde, la página avisa "Agenda no disponible" y ofrece WhatsApp. El detalle técnico queda en la
consola del navegador.

La decisión y sus límites (posible doble reserva hasta que la barbería confirme) están en
[`docs/adr/0001-agenda-sin-backend.md`](docs/adr/0001-agenda-sin-backend.md), junto con la fase 2
propuesta: un backend que cree el evento directamente.

## Scripts

No hay `package.json`. Formato opcional con Prettier (configuración incluida):

```bash
npx prettier --check .
```

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
docs/adr/                  Decisiones de arquitectura
_headers                   Cabeceras de seguridad (Cloudflare Pages / Netlify)
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

Sitio estático: Cloudflare Pages, Netlify o GitHub Pages (skill `desplegar`). En Cloudflare Pages
y Netlify se aplican las cabeceras de `_headers`. Si se activa Google Calendar, la CSP ya permite
`https://www.googleapis.com` en `connect-src`.

## Seguridad

- CSP estricta sin `unsafe-inline`: no hay scripts ni estilos en línea.
- La página no guarda datos personales: el nombre del cliente solo va en el mensaje de WhatsApp que
  él mismo envía (Ley 1581). El enlace de Google Calendar no incluye el nombre.
- Los precios son informativos; no hay pagos en línea.
- La única clave posible (`googleApiKey`) es de navegador, restringida por dominio y por API.
