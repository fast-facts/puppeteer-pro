module.exports = () => {
  try {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'languages', { get: () => ['en-US', 'en'] });
  } catch (ex) { null; }
};