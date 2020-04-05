module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    const _getParameter = WebGLRenderingContext.getParameter;
    WebGLRenderingContext.prototype.getParameter = parameter => {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return _getParameter(parameter);
    };
  } catch (ex) { null; }
};