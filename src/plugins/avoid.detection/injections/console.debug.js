module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    console.debug = () => { return null; };
  } catch (ex) { null; }
};