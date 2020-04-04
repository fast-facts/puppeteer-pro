// import * as crypto from 'crypto';
import * as events from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Puppeteer Defaults
import * as Puppeteer from 'puppeteer';

import * as errors from 'puppeteer/Errors';
import * as devices from 'puppeteer/DeviceDescriptors';

export { errors, devices };

const browserEvents = new events.EventEmitter();

export async function connect(options?: Puppeteer.ConnectOptions): Promise<Puppeteer.Browser> {
  const browser = await Puppeteer.connect(options);

  for (const plugin of plugins) {
    await plugin.init(browser);
  }

  const _close = browser.close;
  browser.close = async () => {
    await _close.apply(browser);
    browserEvents.emit('close');
  };

  return browser;
}

/** The default flags that Chromium will be launched with */
export function defaultArgs(options?: Puppeteer.ChromeArgOptions): string[] {
  return Puppeteer.defaultArgs(options);
}

/** Path where Puppeteer expects to find bundled Chromium */
export function executablePath(): string {
  return Puppeteer.executablePath();
}

/** The method launches a browser instance with given arguments. The browser will be closed when the parent node.js process is closed. */
export async function launch(options?: Puppeteer.LaunchOptions): Promise<Puppeteer.Browser> {
  const browser = await Puppeteer.launch({ defaultViewport: null, ...options });

  for (const plugin of plugins) {
    await plugin.init(browser);
  }

  const _close = browser.close;
  browser.close = async () => {
    await _close.apply(browser);
    browserEvents.emit('close');
  };

  return browser;
}

/** This methods attaches Puppeteer to an existing Chromium instance. */
export function createBrowserFetcher(options?: Puppeteer.FetcherOptions): Puppeteer.BrowserFetcher {
  return Puppeteer.createBrowserFetcher(options);
}

// Added methods
const sleep = (time: number) => { return new Promise(resolve => { setTimeout(resolve, time); }); };

let interceptions = 0;
class Plugin {
  private browser: Puppeteer.Browser | null = null;
  private initialized = false;
  private startCounter = 0;
  private turnOffOnClose: (() => void)[] = [];
  protected dependencies: Plugin[] = [];
  protected requiresInterception = false;

  get isInitialized() { return this.initialized; }
  get isStopped() { return this.startCounter === 0; }

  async init(browser: Puppeteer.Browser) {
    if (this.initialized) return;

    this.browser = browser;

    browserEvents.once('close', () => {
      this.turnOffOnClose.forEach(fn => fn());

      this.onClose();

      this.initialized = false;
      this.startCounter = 0;
    });

    this.startCounter++;

    const thisOnTargetCreated = this.onTargetCreated.bind(this);
    browser.on('targetcreated', thisOnTargetCreated);
    this.turnOffOnClose.push(() => browser.off('targetcreated', thisOnTargetCreated));

    this.initialized = true;

    return this.afterLaunch(browser);
  }
  async afterLaunch(_browser: Puppeteer.Browser) { }
  async onClose() { }

  async onTargetCreated(target: Puppeteer.Target) {
    if (target.type() !== 'page') return;
    const page = await target.page();
    if (page.isClosed()) return;

    if (this.requiresInterception) {
      await page.setRequestInterception(true);

      const thisOnRequest = this.onRequest.bind(this);
      page.on('request', thisOnRequest);
      this.turnOffOnClose.push(() => page.off('request', thisOnRequest));
    }

    const thisOnDialog = this.onDialog.bind(this);
    page.on('dialog', thisOnDialog);
    this.turnOffOnClose.push(() => page.off('dialog', thisOnDialog));

    await this.onPageCreated(page);
  }
  async onPageCreated(_page: Puppeteer.Page) { }

  async onRequest(request: Puppeteer.Request) {
    const interceptionHandled = (request as any)._interceptionHandled;
    if (interceptionHandled) return;
    if (this.isStopped) return request.continue();

    await this.processRequest(request);
  }
  async processRequest(_request: Puppeteer.Request) { }

  async onDialog(dialog: Puppeteer.Dialog) {
    const handled = (dialog as any)._handled;

    if (handled) return;
    if (this.isStopped) return;

    await this.processDialog(dialog);
  }
  async processDialog(_dialog: Puppeteer.Dialog) { }

  async beforeRestart() { }
  async restart() {
    await this.beforeRestart();

    this.startCounter++;
    if (this.requiresInterception) interceptions++;

    this.dependencies.forEach(x => x.restart());

    await this.afterRestart();
  }
  async afterRestart() { }

  async beforeStop() { }
  async stop() {
    await this.beforeStop();

    this.startCounter--;
    if (this.requiresInterception) interceptions--;

    if (interceptions === 0 && this.browser) {
      const pages = await this.browser.pages();

      pages.filter(x => !x.isClosed()).forEach((page: Puppeteer.Page) => {
        page.setRequestInterception(false);
      });
    }

    this.dependencies.forEach(x => x.stop());

    await this.afterStop();
  }
  async afterStop() { }
}

let plugins: Plugin[] = [];
export function clearPlugins() {
  plugins = [];
}

interface PageUserAgent {
  target: Puppeteer.Page;
  userAgent: string;
  newUserAgent: string;
}
class AnonymizeUserAgentPlugin extends Plugin {
  private pages: PageUserAgent[] = [];

  async afterLaunch(browser: Puppeteer.Browser) {
    const _newPage = browser.newPage;
    browser.newPage = async (): Promise<Puppeteer.Page> => {
      const page = await _newPage.apply(browser);
      await sleep(100); // Sleep to allow user agent to set
      return page;
    };
  }

  async onClose() {
    this.pages = [];
  }

  async onPageCreated(page: Puppeteer.Page) {
    const userAgent = await page.browser().userAgent();
    const newUserAgent = userAgent
      .replace('HeadlessChrome/', 'Chrome/')
      .replace(/\(([^)]+)\)/, '(Windows NT 10.0; Win64; x64)');

    this.pages.push({ target: page, userAgent, newUserAgent });

    await page.setUserAgent(newUserAgent);
  }

  async beforeRestart() {
    for (const page of this.pages) {
      if (page.target.isClosed()) continue;

      await page.target.setUserAgent(page.newUserAgent);
    }
  }

  async afterStop() {
    for (const page of this.pages) {
      if (page.target.isClosed()) continue;

      await page.target.setUserAgent(page.userAgent);
    }
  }
}

let anonymizeUserAgentPlugin: AnonymizeUserAgentPlugin;
export function anonymizeUserAgent(): AnonymizeUserAgentPlugin {
  const plugin = anonymizeUserAgentPlugin || new AnonymizeUserAgentPlugin();
  anonymizeUserAgentPlugin = plugin;

  if (!plugins.includes(plugin)) {
    plugins.push(plugin);
  }

  return plugin;
}

class AvoidDetectionPlugin extends Plugin {
  dependencies = [anonymizeUserAgent()];
  injectionsFolder = path.resolve(`${__dirname}/injections`);
  injections = fs.readdirSync(this.injectionsFolder).map(fileName => require(`${this.injectionsFolder}/${fileName}`));

  async onPageCreated(page: Puppeteer.Page) {
    await page.exposeFunction('isStopped', () => this.isStopped);

    for (const injection of this.injections) {
      await page.evaluateOnNewDocument(injection);
    }
  }
}

let avoidDetectionPlugin: AvoidDetectionPlugin;
export function avoidDetection(): AvoidDetectionPlugin {
  const plugin = avoidDetectionPlugin || new AvoidDetectionPlugin();
  avoidDetectionPlugin = plugin;

  if (!plugins.includes(plugin)) {
    plugins.push(plugin);
  }

  return plugin;
}

type Resource = 'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'eventsource' | 'websocket' | 'manifest' | 'other';
class BlockResourcesPlugin extends Plugin {
  requiresInterception = true;
  blockResources: Resource[];

  constructor(resources: Resource[] = []) {
    super();

    this.blockResources = resources;
  }

  async processRequest(request: Puppeteer.Request) {
    if (this.blockResources.includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  }
}

let blockResourcesPlugin: BlockResourcesPlugin;
export function blockResources(...resources: Resource[]): BlockResourcesPlugin {
  const plugin = blockResourcesPlugin || new BlockResourcesPlugin(resources);
  blockResourcesPlugin = plugin;

  if (!plugins.includes(plugin)) {
    plugins.push(plugin);
  }

  return plugin;
}

class DisableDialogsPlugin extends Plugin {
  async processDialog(dialog: Puppeteer.Dialog) {
    dialog.dismiss();
  }
}

let disableDialogsPlugin: DisableDialogsPlugin;
export function disableDialogs(): DisableDialogsPlugin {
  const plugin = disableDialogsPlugin || new DisableDialogsPlugin();
  disableDialogsPlugin = plugin;

  if (!plugins.includes(plugin)) {
    plugins.push(plugin);
  }

  return plugin;
}
