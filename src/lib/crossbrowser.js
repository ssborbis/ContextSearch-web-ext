window.browser = (function () {
  return window.msBrowser ||
    window.browser ||
    window.chrome;
})();