// Mesterbygg Stryn – liten forbetringsfil: meny + scroll-avsløringar.
// Alt fungerer utan JS; dette legg berre på finpuss.
(function () {
  'use strict';

  var redusertRorsle = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobilmeny
  var knapp = document.querySelector('.meny-knapp');
  var meny = document.getElementById('hovudmeny');
  if (knapp && meny) {
    knapp.addEventListener('click', function () {
      var open = meny.classList.toggle('open');
      knapp.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && meny.classList.contains('open')) {
        meny.classList.remove('open');
        knapp.setAttribute('aria-expanded', 'false');
        knapp.focus();
      }
    });
  }

  // Scroll-avsløringar – berre når brukaren ikkje har bede om redusert rørsle
  if (redusertRorsle || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('js');

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('vis');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
  );

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });
})();
