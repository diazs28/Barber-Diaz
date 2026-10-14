// Preloader sello BWL & SOFT: decide antes de pintar si se muestra (una vez por pestaña, nunca con
// movimiento reducido, con #ancla ni fuera del inicio). La animación es CSS; aquí solo se activa,
// se mueve el contador y se limpia. Al empezar la salida emite "bwl:intro-fin" para el hero.
(function () {
  'use strict';
  const CLAVE = 'barbermafia:intro';
  const SALIDA_MS = 2850;
  const FIN_MS = 3750;
  const raiz = document.documentElement;

  function yaVista() {
    try {
      return sessionStorage.getItem(CLAVE) === '1';
    } catch {
      return false;
    }
  }
  const esInicio = location.pathname === '/' || location.pathname.endsWith('/index.html');
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    location.hash ||
    !esInicio ||
    yaVista()
  ) {
    document.addEventListener('DOMContentLoaded', () =>
      document.dispatchEvent(new Event('bwl:intro-fin')),
    );
    return;
  }
  try {
    sessionStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento (modo privado estricto): se volverá a mostrar, no pasa nada
  }
  raiz.classList.add('bwl-intro', 'bwl-intro-bloqueo');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  let terminado = false;
  function salida() {
    if (terminado) return;
    terminado = true;
    raiz.classList.remove('bwl-intro-bloqueo');
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    document.dispatchEvent(new Event('bwl:intro-fin'));
  }
  function retirar() {
    salida();
    document.querySelector('[data-bwl-entrada]')?.remove();
    raiz.classList.remove('bwl-intro');
  }

  // Contador del año (easeInOutQuad entre 0,25 y 1,6 s)
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector('[data-bwl-contador]');
    if (!el) return;
    const desde = Number(el.dataset.desde);
    const hasta = new Date().getFullYear();
    const inicio = performance.now() + 250;
    const suavizar = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const contar = (t) => {
      const avance = Math.min(1, Math.max(0, (t - inicio) / 1350));
      el.textContent = String(Math.round(desde + (hasta - desde) * suavizar(avance)));
      if (avance < 1) requestAnimationFrame(contar);
    };
    requestAnimationFrame(contar);
  });

  setTimeout(salida, SALIDA_MS);
  setTimeout(retirar, FIN_MS);
  // Respaldo por si la pestaña pasa a segundo plano
  setTimeout(retirar, 6000);
})();
