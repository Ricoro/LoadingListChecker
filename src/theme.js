(() => {
  const root = document.documentElement;
  const key = 'loading-list-checker:theme:' + (location.pathname.includes('/testing/') ? 'testing' : 'production');
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { const saved = localStorage.getItem(key); if (saved === 'dark' || saved === 'light') preference = saved; } catch {}
  function apply(theme) {
    root.dataset.theme = theme;
    const button = document.getElementById('theme-toggle');
    if (button) button.setAttribute('aria-checked', String(theme === 'dark'));
  }
  apply(preference || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', event => { if (!preference) apply(event.matches ? 'dark' : 'light'); });
  document.addEventListener('DOMContentLoaded', () => {
    apply(root.dataset.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(preference);
      try { localStorage.setItem(key, preference); } catch {}
    });
  });
})();
