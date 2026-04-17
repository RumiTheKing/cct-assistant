(function () {
  const STORAGE_KEY = 'cca-theme';

  function getSavedTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
  }

  applyTheme(getSavedTheme());

  window.CCATheme = {
    getTheme: getSavedTheme,
    setTheme,
    applyTheme,
  };
})();
