module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  } catch (ex) { null; }
};