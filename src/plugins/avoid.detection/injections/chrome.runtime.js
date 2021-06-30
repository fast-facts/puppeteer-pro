module.exports = () => {
  try {
    window.chrome = { runtime: {} };
  } catch (ex) { null; }
};