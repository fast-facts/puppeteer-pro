module.exports = async () => {
  if (await window.isStopped()) return;

  try {
    const waitUntil = (func, timeout) => {
      timeout = timeout !== undefined ? timeout : 30000;

      return new Promise((resolve, reject) => {
        let resolveTimeout, rejectTimeout;

        const tryFunc = () => {
          const result = func();

          if (result) {
            clearTimeout(rejectTimeout);
            resolve(result);
          }
          else
            resolveTimeout = setTimeout(tryFunc, 100);
        };

        if (timeout > 0) {
          rejectTimeout = setTimeout(() => {
            clearTimeout(resolveTimeout);
            reject(new Error(`Timeout Exceeded: ${timeout}ms exceeded`));
          }, timeout);
        }

        tryFunc();
      });
    };

    await waitUntil(() => window.Modernizr);

    if (window.Modernizr && !window.Modernizr.hairline) {
      window.Modernizr.hairline = true;
    }
  } catch (ex) { null; }
};