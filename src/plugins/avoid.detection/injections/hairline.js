module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    const _offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight').get;
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      get: function () {
        const borderWidth = +window.getComputedStyle(this).borderWidth.replace('px', '');
        return borderWidth < 1 ? 1 : _offsetHeight.bind(this)();
      }
    });
  } catch (ex) { null; }
};