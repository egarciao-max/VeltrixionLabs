// Archivo legado para páginas antiguas.
if (!document.querySelector('script[data-main-js="true"]')) {
  const script = document.createElement('script');
  script.src = 'main.js';
  script.dataset.mainJs = 'true';
  document.head.appendChild(script);
}
