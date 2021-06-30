module.exports = () => {
  try {
    console.debug = () => { return null; };
  } catch (ex) { null; }
};