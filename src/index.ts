import * as events from 'events';

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

// PuppeteerPro
let interceptions = 0;
export class Plugin {
  protected browser: Puppeteer.Browser | null = null;
  private initialized = false;
  private startCounter = 0;
  private turnOffOnClose: (() => void)[] = [];
  protected dependencies: Plugin[] = [];
  protected requiresInterception = false;

  get isInitialized() { return this.initialized; }
  get isStopped() { return this.startCounter === 0; }

  protected async addDependency(plugin: Plugin) {
    this.dependencies.push(plugin);
  }

  async init(browser: Puppeteer.Browser) {
    if (this.initialized) return;

    this.browser = browser;

    browserEvents.once('close', async () => {
      this.turnOffOnClose.forEach(fn => fn());

      this.browser = null;
      this.initialized = false;
      this.startCounter = 0;

      await this.onClose();
    });

    this.startCounter++;

    const thisOnTargetCreated = this.onTargetCreated.bind(this);
    browser.on('targetcreated', thisOnTargetCreated);
    this.turnOffOnClose.push(() => browser.off('targetcreated', thisOnTargetCreated));

    this.initialized = true;

    this.dependencies.forEach(x => x.init(browser));

    return this.afterLaunch(browser);
  }

  protected async afterLaunch(_browser: Puppeteer.Browser) { }
  protected async onClose() { }

  protected async onTargetCreated(target: Puppeteer.Target) {
    if (this.isStopped) return;

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

      pages.filter(x => !x.isClosed()).forEach(async (page: Puppeteer.Page) => {
        await page.setRequestInterception(false);
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
export function addPlugin(plugin: Plugin) { plugins.push(plugin); }
export async function clearPlugins() {
  plugins.forEach(async plugin => {
    await plugin.stop();
  });

  plugins = [];
}

import { AnonymizeUserAgentPlugin } from './plugins/anonymize.user.agent/index';
export function anonymizeUserAgent(): AnonymizeUserAgentPlugin {
  const plugin = new AnonymizeUserAgentPlugin();
  plugins.push(plugin);
  return plugin;
}

import { AvoidDetectionPlugin } from './plugins/avoid.detection';
export function avoidDetection(): AvoidDetectionPlugin {
  const plugin = new AvoidDetectionPlugin();
  plugins.push(plugin);
  return plugin;
}

import { BlockResourcesPlugin, Resource } from './plugins/block.resources';
export function blockResources(...resources: Resource[]): BlockResourcesPlugin {
  const plugin = new BlockResourcesPlugin(resources);
  plugins.push(plugin);
  return plugin;
}

import { DisableDialogsPlugin } from './plugins/disable.dialogs';
export function disableDialogs(logMessages = false): DisableDialogsPlugin {
  const plugin = new DisableDialogsPlugin(logMessages);
  plugins.push(plugin);
  return plugin;
}

import { ManageCookiesPlugin, ManageCookiesOption } from './plugins/manage.cookies';
export function manageCookies(opts: ManageCookiesOption): ManageCookiesPlugin {
  const plugin = new ManageCookiesPlugin(opts);
  plugins.push(plugin);
  return plugin;
}