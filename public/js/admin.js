// Stadfesting før destruktive handlingar i admin (CSP tillèt ikkje inline-JS)
document.addEventListener('submit', function (e) {
  var msg = e.target.getAttribute('data-confirm');
  if (msg && !window.confirm(msg)) e.preventDefault();
});
