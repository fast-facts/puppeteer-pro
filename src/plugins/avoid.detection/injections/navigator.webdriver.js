module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    const navigatePrototype = Object.getPrototypeOf(navigator);
    delete navigatePrototype.webdriver;
    Object.setPrototypeOf(navigator, navigatePrototype);
  } catch (ex) { null; }
};