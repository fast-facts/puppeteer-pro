module.exports = () => {
  try {
    const hasPlugins = navigator.plugins && navigator.plugins.length > 0;

    if (!hasPlugins) {
      const _mimeTypes = [
        {
          type: 'application/pdf', suffixes: 'pdf', description: '', __pluginName: 'Chrome PDF Viewer'
        },
        {
          type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', __pluginName: 'Chrome PDF Plugin'
        },
        {
          type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', __pluginName: 'Native Client'
        },
        {
          type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', __pluginName: 'Native Client'
        }
      ];

      const _plugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ];

      const fn = (className, fnName) => function (x) {
        if (fnName === 'refresh') return undefined;
        if (!arguments.length) throw new TypeError(`Failed to execute '${fnName}' on '${className}': 1 argument required, but only 0 present.`);
        return this[x] || null;
      };

      // Mime Types
      const mimeTypeArray = _mimeTypes
        .map(x => ['type', 'suffixes', 'description'].reduce((a, k) => ({ ...a, [k]: x[k] }), {}))
        .map(x => Object.setPrototypeOf(x, MimeType.prototype))
        .map(x => ({ ...x, namedItem: fn('MimeTypeArray', 'namedItem'), item: fn('MimeTypeArray', 'item') }));

      mimeTypeArray.forEach(x => mimeTypeArray[x.type] = x);

      Object.setPrototypeOf(mimeTypeArray, MimeTypeArray.prototype);
      Object.defineProperty(Object.getPrototypeOf(navigator), 'mimeTypes', { get: () => mimeTypeArray });

      // Plugins
      const pluginArray = _plugins
        .map(x => ['name', 'filename', 'description'].reduce((a, k) => ({ ...a, [k]: x[k] }), {}))
        .map(x => {
          const _mimeTypesSubset = _mimeTypes.filter(y => y.__pluginName === x.name);

          _mimeTypesSubset.forEach((mime, i) => {
            navigator.mimeTypes[mime.type].enabledPlugin = x;
            x[mime.type] = navigator.mimeTypes[mime.type];
            x[i] = navigator.mimeTypes[mime.type];
          });

          return { ...x, length: _mimeTypesSubset.length };
        })
        .map(x => ({ ...x, namedItem: fn('Plugin', 'namedItem'), item: fn('Plugin', 'item') }))
        .map(x => Object.setPrototypeOf(x, Plugin.prototype));


      pluginArray.forEach(x => pluginArray[x.name] = x);

      ['namedItem', 'item', 'refresh'].forEach(x => pluginArray[x] = fn('PluginArray', x));

      Object.setPrototypeOf(pluginArray, PluginArray.prototype);
      Object.defineProperty(Object.getPrototypeOf(navigator), 'plugins', { get: () => pluginArray });
    }
  } catch (ex) { null; }
};