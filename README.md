# Puppeteer-Pro

A simple [`puppeteer`](https://github.com/puppeteer/puppeteer) wrapper to enable useful plugins with ease

## Installation

Requires node v10 and higher

```bash
npm install puppeteer-pro
```

## Quickstart

Puppeteer-Pro can do all the same things as [`puppeteer`](https://github.com/puppeteer/puppeteer), just now with plugins!

```js
// Puppeteer-Pro is a drop-in replacement for puppeteer
const PuppeteerPro = require('puppeteer-pro');

// Enable the 'avoidDetection' plugin to prevent headless detection
PuppeteerPro.avoidDetection();

(async () => {
  const browser = await PuppeteerPro.launch();
  const page = await browser.newPage();
  
  console.log('Testing the 🐱‍👤 avoidDetection 🐱‍👤 plugin..')
  await page.goto('https://arh.antoinevastel.com/bots/areyouheadless');
  await page.screenshot({ path: 'areyouheadless.png' });

  await browser.close();
})();
```

---

## Optional Built-in Plugins

### Anonymize User Agent

- Anonymize the user-agent across all pages

### Avoid Detection

- Multiple techniques to combat headless browser detection

### Block Resources

- Block any [resource type](https://github.com/puppeteer/puppeteer/blob/v2.1.1/docs/api.md#requestresourcetype) from loading
- Can be used to speed up loading websites by blocking style sheets and images

### Disable Dialogs

- Block dialogs from popping up and stopping execution

### Manage Cookies

- Save and load cookies across sessions
- Supports multiple profiles and switching between profiles
