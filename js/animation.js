// Dos momentos con GSAP (cargado por CDN en index.html), ambos dentro de "if (!reduceMotion)":
// 1. El nombre del inicio sube letra por línea cuando el preloader empieza a salir.
// 2. Las lámparas del plano se encienden una a una, con un parpadeo, al llegar a la agenda.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const { gsap, ScrollTrigger } = window;

if (!reduceMotion && gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  const lineas = gsap.utils.toArray('.hero__linea');
  const resto = gsap.utils.toArray('[data-anim="hero-resto"] > *');
  gsap.set(lineas, { yPercent: 130 });
  gsap.set(resto, { opacity: 0, y: 16 });

  document.addEventListener(
    'bwl:intro-fin',
    () => {
      // El nombre se pinta por JS (main.js); se vuelve a tomar por si cambió
      const titulo = gsap.utils.toArray('.hero__linea');
      gsap
        .timeline({ defaults: { ease: 'power4.out' } })
        .to(titulo, { yPercent: 0, duration: 1.1, stagger: 0.12 })
        .to(resto, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out' }, '-=0.6');
    },
    { once: true },
  );

  gsap.utils.toArray('.puesto__lampara').forEach((lampara, i) => {
    gsap.fromTo(
      lampara,
      { opacity: 0 },
      {
        keyframes: [
          { opacity: 0.8, duration: 0.06 },
          { opacity: 0.1, duration: 0.1 },
          { opacity: 1, duration: 0.5, ease: 'power2.out' },
        ],
        delay: 0.35 * i,
        scrollTrigger: { trigger: '.plano', start: 'top 70%', once: true },
      },
    );
  });
}
