module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    const elementDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(HTMLDivElement.prototype, 'offsetHeight', {
      ...elementDescriptor,
      get: function () {
        if (this.id === 'modernizr') {
          return 1;
        }
        return elementDescriptor.get.apply(this);
      }
    });
  } catch (ex) { null; }
};