module.exports = () => {
  try {
    if (!(window.outerWidth && window.outerHeight)) {
      window.outerWidth = window.innerWidth;
      window.outerHeight = window.innerHeight;
    }
  } catch (ex) { null; }
};