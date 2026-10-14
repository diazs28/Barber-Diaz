# 0001. Agenda de citas sin backend: disponibilidad desde Google Calendar y reserva por WhatsApp

- Estado: aceptada
- Fecha: 2026-10-13

## Contexto

Barber Mafia quiere que sus clientes vean la disponibilidad de cada barbero en un plano 2D del local
y agenden su cita. El cliente pidió conectarlo a Google Calendar "o una idea" equivalente. La primera
versión es una landing estática (HTML, CSS y JS, sin build ni servidor).

Crear eventos en Google Calendar exige OAuth o una cuenta de servicio, y esas credenciales no pueden
vivir en el navegador. Sin servidor tampoco hay forma de bloquear un turno de manera atómica.

## Decisión

1. **Lectura de disponibilidad** con un adaptador de fuentes (`js/disponibilidad.js`):
   - `demo`: ocupación de ejemplo, determinista por barbero y por día, para mostrar y vender el sitio.
   - `google`: una sola consulta a la API **free/busy** de Google Calendar con los calendarios de los
     tres barberos. Necesita que cada calendario sea público (basta con "ver solo libre/ocupado") y una
     clave de navegador restringida por dominio y limitada a Calendar API. Esa clave no es un secreto:
     Google la diseña para ir en el navegador.
2. **Reserva** con un mensaje de WhatsApp ya escrito (barbero, servicio, día, hora y nombre). La
   barbería confirma y crea el evento en el calendario del barbero. El cliente puede añadir la cita a
   su propio Google Calendar con un enlace de plantilla.
3. La página **no guarda datos personales**: el nombre solo viaja en el mensaje que el cliente envía.

## Consecuencias

- Dos clientes pueden pedir la misma hora antes de que la barbería la marque en el calendario. La
  barbería lo resuelve al confirmar por WhatsApp. El texto de la página dice que el turno queda
  apartado cuando la barbería responde.
- La barbería pasa cada cita confirmada a Google Calendar. Para que sea un solo toque, el mensaje
  de WhatsApp trae un enlace de plantilla de evento con el servicio, el nombre, la hora y la
  duración: se abre, se elige el calendario del barbero y se guarda. Los clientes sin cita, los
  descansos y las vacaciones se marcan creando eventos en ese mismo calendario. No hace falta un
  panel de administrador.
- **Fase 2 propuesta:** un backend pequeño (Express 5 + Zod) con una cuenta de servicio de Google que
  cree el evento al reservar, con bloqueo de la franja, `Idempotency-Key` y recordatorios automáticos.
  Así se elimina la doble reserva y el paso manual.

## Actualización 2026-10-14: la clave pasa al servidor

Para que la clave de Google no quede visible en la página, la lectura de disponibilidad se hace en
una función serverless de Vercel (`api/disponibilidad.js`). La clave está en la variable de entorno
`GOOGLE_CALENDAR_API_KEY` y los IDs de los calendarios en `api/_calendarios.js`. El navegador solo
llama a `/api/disponibilidad` en el mismo dominio y recibe los bloques ocupados.

- La clave ya no puede restringirse por sitio web (el servidor no envía origen). Se restringe solo a
  Google Calendar API.
- La CDN de Vercel guarda cada respuesta 60 s para no gastar cuota de Google.
- Para desarrollo local, `npm run dev` levanta la landing y la función con la clave de `.env`.
