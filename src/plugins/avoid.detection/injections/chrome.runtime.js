module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    window.chrome = { runtime: {} };
  } catch (ex) { null; }
};