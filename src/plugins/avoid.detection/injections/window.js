module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    if (!(window.outerWidth && window.outerHeight)) {
      window.outerWidth = window.innerWidth;
      window.outerHeight = window.innerHeight;
    }
  } catch (ex) { null; }
};