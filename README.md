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

(async () => {
  const browser = await PuppeteerPro.launch();

  // Enable the 'avoidDetection' plugin to prevent headless detection
  browser.avoidDetection();

  // Enable the 'solveRecaptchas' plugin to solve Google's recaptchas (remember to provide a wit.api API access token)
  const solver = await browser.solveRecaptchas('WIT_AI_ACCESS_TOKEN');

  const page = await browser.newPage();
  
  console.log('Testing the 🐱‍👤 avoidDetection 🐱‍👤 plugin..')
  await page.goto('https://arh.antoinevastel.com/bots/areyouheadless');
  await page.screenshot({ path: 'are-you-headless.png' });
  
  console.log('Testing the recaptcha solver..')
  await page.goto('https://recaptcha-demo.appspot.com/recaptcha-v2-checkbox.php');
  await solver.waitForCaptcha(page); // Captcha script is deferred, so will load after page.goto completes
  await solver.solveRecaptcha(page);
  await page.screenshot({ path: 'is-recaptcha-solved.png' });

  await browser.close();
})();
```

## Passive Improvements

- There can be multiple request interception handlers for the same request. In such cases, the resulting response will prioritize [`respond`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#httprequestrespondresponse), followed by [`abort`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#httprequestaborterrorcode), followed by [`continue`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#httprequestcontinueoverrides). For example:
  - If amongst 5 handlers, respond is called 1 time, abort is called 2 times and continue is called 2 times, the result will be `respond`. This will occur after the first respond is called and not when all handlers are finished.
  - If amongst 5 handlers, abort is called 1 time and continue is called 4 times, the result will be `abort`. This will occur after all handlers are finished.
  - If amongst 5 handlers, all handlers call continue, the result will be `continue`. This will occur after all handlers are finished.
- New `page.waitAndClick` function that sequentially runs `page.waitForSelector` and `page.click`.

## Optional Built-in Plugins

### Anonymize User Agent

- Anonymize the user-agent across all pages

### Avoid Detection

- Multiple techniques to combat headless browser detection

### Block Resources

- Block any [resource type](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#httprequestresourcetype) from loading
- Can be used to speed up loading websites by blocking style sheets and images

### Disable Dialogs

- Block dialogs from popping up and stopping execution

### Manage Cookies

- Save and load cookies across sessions
- Supports multiple profiles and switching between profiles

### Manage Local Storage

- Save and load local storage across sessions
- Supports multiple profiles and switching between profiles

### Solve Recaptcha

- Solve Google's reCAPTCHA v2
- Requires a FREE [wit.ai](https://wit.ai/apps) access token
