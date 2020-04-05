import * as crypto from 'crypto';
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
  protected browser: Puppeteer.Browser | null = null;
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

      this.browser = null;
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
  protected async afterLaunch(_browser: Puppeteer.Browser) { }
  protected async onClose() { }

  protected async onTargetCreated(target: Puppeteer.Target) {
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
  protected async onPageCreated(_page: Puppeteer.Page) { }

  protected async onRequest(request: Puppeteer.Request) {
    const interceptionHandled = (request as any)._interceptionHandled;
    if (interceptionHandled) return;
    if (this.isStopped) return request.continue();

    await this.processRequest(request);
  }
  protected async processRequest(_request: Puppeteer.Request) { }

  protected async onDialog(dialog: Puppeteer.Dialog) {
    const handled = (dialog as any)._handled;

    if (handled) return;
    if (this.isStopped) return;

    await this.processDialog(dialog);
  }
  protected async processDialog(_dialog: Puppeteer.Dialog) { }

  protected async beforeRestart() { }
  async restart() {
    await this.beforeRestart();

    this.startCounter++;
    if (this.requiresInterception) interceptions++;

    this.dependencies.forEach(x => x.restart());

    await this.afterRestart();
  }
  protected async afterRestart() { }

  protected async beforeStop() { }
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
  protected async afterStop() { }

  protected async getFirstPage() {
    if (!this.browser) return null;

    const pages = await this.browser.pages();
    const openPages = pages.filter(x => !x.isClosed());
    const activePages = pages.filter(x => x.url() !== 'about:blank');

    return activePages[0] || openPages[0];
  }
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

  protected async afterLaunch(browser: Puppeteer.Browser) {
    const _newPage = browser.newPage;
    browser.newPage = async (): Promise<Puppeteer.Page> => {
      const page = await _newPage.apply(browser);
      await sleep(100); // Sleep to allow user agent to set
      return page;
    };
  }

  protected async onClose() {
    this.pages = [];
  }

  protected async onPageCreated(page: Puppeteer.Page) {
    const userAgent = await page.browser().userAgent();
    const newUserAgent = userAgent
      .replace('HeadlessChrome/', 'Chrome/')
      .replace(/\(([^)]+)\)/, '(Windows NT 10.0; Win64; x64)');

    this.pages.push({ target: page, userAgent, newUserAgent });

    await page.setUserAgent(newUserAgent);
  }

  protected async beforeRestart() {
    for (const page of this.pages) {
      if (page.target.isClosed()) continue;

      await page.target.setUserAgent(page.newUserAgent);
    }
  }

  protected async afterStop() {
    for (const page of this.pages) {
      if (page.target.isClosed()) continue;

      await page.target.setUserAgent(page.userAgent);
    }
  }
}

export function anonymizeUserAgent(): AnonymizeUserAgentPlugin {
  const plugin = new AnonymizeUserAgentPlugin();
  plugins.push(plugin);
  return plugin;
}

class AvoidDetectionPlugin extends Plugin {
  dependencies = [anonymizeUserAgent()];
  injectionsFolder = path.resolve(`${__dirname}/injections`);
  injections = fs.readdirSync(this.injectionsFolder).map(fileName => require(`${this.injectionsFolder}/${fileName}`));

  protected async onPageCreated(page: Puppeteer.Page) {
    await page.exposeFunction('isStopped', () => this.isStopped);

    for (const injection of this.injections) {
      await page.evaluateOnNewDocument(injection);
    }
  }
}

export function avoidDetection(): AvoidDetectionPlugin {
  const plugin = new AvoidDetectionPlugin();
  plugins.push(plugin);
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

  protected async processRequest(request: Puppeteer.Request) {
    if (this.blockResources.includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  }
}

export function blockResources(...resources: Resource[]): BlockResourcesPlugin {
  const plugin = new BlockResourcesPlugin(resources);
  plugins.push(plugin);
  return plugin;
}

class DisableDialogsPlugin extends Plugin {
  protected async processDialog(dialog: Puppeteer.Dialog) {
    dialog.dismiss();
  }
}

export function disableDialogs(): DisableDialogsPlugin {
  const plugin = new DisableDialogsPlugin();
  plugins.push(plugin);
  return plugin;
}

interface ManageCookiesOption {
  saveLocation: string;
  mode: 'manual' | 'monitor';
  stringify?: (cookies: Puppeteer.Cookie[]) => string;
  parse?: (cookies: string) => Puppeteer.Cookie[];
  disableWarning?: boolean;
}

// https://gist.github.com/jeroenvisser101/636030fe66ea929b63a33f5cb3a711ad
class ManageCookiesPlugin extends Plugin {
  private saveLocation = '';
  private mode = '';
  private stringify = (cookies: Puppeteer.Cookie[]) => JSON.stringify(cookies);
  private parse = (cookies: string) => JSON.parse(cookies);
  private disableWarning = false;

  constructor(opts: ManageCookiesOption) {
    super();

    // Need to find a better typescript way of doing this
    this.saveLocation = opts.saveLocation || this.saveLocation;
    this.mode = opts.mode || this.mode;
    this.stringify = opts.stringify || this.stringify;
    this.parse = opts.parse || this.parse;
    this.disableWarning = opts.disableWarning || this.disableWarning;

    if (this.disableWarning !== true) {
      // tslint:disable-next-line: no-console
      console.warn('Warning: Exposing cookies in an unprotected manner can compromise your security. Add the `disableWarning` flag to remove this message.');
    }
  }

  protected async afterLaunch() {
    this.watchCookies();
  }

  protected async afterRestart() {
    this.watchCookies();
  }

  async save() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    const page = await this.getFirstPage();
    if (!page) return;

    const cookiesString = this.stringify(await this.getCookies());
    fs.writeFileSync(this.saveLocation, cookiesString);
  }

  async load() {
    if (this.isStopped) return;
    if (this.mode !== 'manual') return;

    const page = await this.getFirstPage();
    if (!page) return;

    const requiresRealPage = page.url() === 'about:blank';

    if (fs.existsSync(this.saveLocation)) {
      if (requiresRealPage) {
        await page.goto('http://www.google.com');
      }

      const cookies = this.parse(fs.readFileSync(this.saveLocation).toString() || '[]');
      await page.setCookie(...cookies);

      if (requiresRealPage) {
        await page.goBack();
      }
    }
  }

  async clear() {
    if (this.isStopped) return;

    const page = await this.getFirstPage();
    if (!page) return;

    await page.deleteCookie(...await this.getCookies());

    if (fs.existsSync(this.saveLocation)) {
      fs.unlinkSync(this.saveLocation);
    }
  }

  private async watchCookies() {
    if (this.isStopped) return;
    if (this.mode !== 'monitor') return;

    const page = await this.getFirstPage();
    if (!page) return;

    const hash = (x: string) => crypto.createHash('md5').update(x).digest('hex');

    let oldHash = '';
    while (!this.isStopped) {
      const cookiesString = this.stringify(await this.getCookies());
      const newHash = hash(cookiesString);

      if (oldHash !== newHash) {
        fs.writeFileSync(this.saveLocation, cookiesString);
        oldHash = newHash;
      }

      await sleep(300);
    }
  }

  private async getCookies() {
    const page = await this.getFirstPage();
    if (!page) return [];

    const client = await page.target().createCDPSession();
    const { cookies } = await client.send("Network.getAllCookies", {}) as { cookies: Puppeteer.Cookie[] };

    return cookies;
  }
}

export function manageCookies(opts: ManageCookiesOption): ManageCookiesPlugin {
  const plugin = new ManageCookiesPlugin(opts);
  plugins.push(plugin);
  return plugin;
}