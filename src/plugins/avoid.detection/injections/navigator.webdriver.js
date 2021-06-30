module.exports = () => {
  try {
    const navigatePrototype = Object.getPrototypeOf(navigator);
    delete navigatePrototype.webdriver;
    Object.setPrototypeOf(navigator, navigatePrototype);
  } catch (ex) { null; }
};