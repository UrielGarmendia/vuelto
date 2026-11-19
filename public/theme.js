// Applies the theme before the first paint, so dark mode never flashes light. A file rather
// than an inline script, so the Content-Security-Policy needs no exception for it.
try {
  var t = JSON.parse(localStorage.getItem('vuelto-prefs') || '{}').state?.theme || 'system';
  if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
} catch (e) {}
