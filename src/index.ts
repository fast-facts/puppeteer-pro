/* eslint-disable prefer-rest-params */
import * as events from 'events';

// Puppeteer Defaults
import * as Puppeteer from 'puppeteer';

export async function connect(options?: Puppeteer.ConnectOptions): Promise<Browser> {
  const browser = await Puppeteer.connect(options || {});

  return createBrowser(browser);
}

export async function launch(options?: Puppeteer.LaunchOptions & Puppeteer.ConnectOptions): Promise<Browser> {
  if (!options) options = {};

  process.env.PUPPETEER_DISABLE_HEADLESS_WARNING = 'true';
  const browser = await Puppeteer.launch({ defaultViewport: undefined, ...options });

  return createBrowser(browser);
}

async function createBrowser(puppeteerBrowser: Puppeteer.Browser): Promise<Browser> {
  const browser = puppeteerBrowser as Browser;

  const _close = browser.close;
  browser.close = async () => {
    await _close.apply(browser);
    browser.browserEvents.emit('close');
  };

  const _createBrowserContext = browser.createBrowserContext;
  browser.createBrowserContext = async (options?: Puppeteer.BrowserContextOptions) => {
    const context: Puppeteer.BrowserContext = await _createBrowserContext.apply(browser, options);

    return createBrowserContext(context);
  };

  const _newPage = browser.newPage;
  browser.newPage = async () => {
    const page: Puppeteer.Page = await _newPage.apply(browser);

    return newPage(page);
  };

  addPluginSupport(browser);

  return browser;
}

async function createBrowserContext(puppeteerBrowserContext: Puppeteer.BrowserContext): Promise<BrowserContext> {
  const browser = puppeteerBrowserContext as BrowserContext;

  const _close = browser.close;
  browser.close = async () => {
    await _close.apply(browser);
    browser.browserEvents.emit('close');
  };

  const _newPage = browser.newPage;
  browser.newPage = async () => {
    const page: Puppeteer.Page = await _newPage.apply(browser);

    return newPage(page);
  };

  addPluginSupport(browser);

  return browser;
}

function newPage(oldPage: Puppeteer.Page): Page {
  const page = oldPage as Page;

  page.waitAndClick = async (selector: string, options?: Readonly<Puppeteer.ClickOptions>): Promise<void> => {
    await page.waitForSelector(selector);
    await page.click(selector, options);
  };

  page.waitAndType = async (selector: string, text: string, options?: Readonly<Puppeteer.KeyboardTypeOptions>): Promise<void> => {
    await page.waitForSelector(selector);
    await page.type(selector, text, options);
  };

  return page;
}

function addPluginSupport(browser: Browser | BrowserContext) {
  browser.plugins = [];
  browser.browserEvents = new events.EventEmitter();
  browser.interceptions = 0;

  browser.addPlugin = async (plugin: Plugin) => {
    browser.plugins.push(plugin);
    await plugin.init(browser);
  };

  browser.clearPlugins = () => {
    browser.plugins.forEach(async plugin => {
      await plugin.stop();
    });

    browser.plugins = [];
  };

  browser.anonymizeUserAgent = async (): Promise<AnonymizeUserAgentPlugin> => {
    const plugin = new AnonymizeUserAgentPlugin();
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.avoidDetection = async (): Promise<AvoidDetectionPlugin> => {
    const plugin = new AvoidDetectionPlugin();
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.blockResources = async (...resources: Resource[]): Promise<BlockResourcesPlugin> => {
    const plugin = new BlockResourcesPlugin(resources);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.disableDialogs = async (logMessages = false): Promise<DisableDialogsPlugin> => {
    const plugin = new DisableDialogsPlugin(logMessages);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.manageCookies = async (opts: ManageCookiesOption): Promise<ManageCookiesPlugin> => {
    const plugin = new ManageCookiesPlugin(opts);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.manageLocalStorage = async (opts: ManageLocalStorageOption): Promise<ManageLocalStoragePlugin> => {
    const plugin = new ManageLocalStoragePlugin(opts);
    await browser.addPlugin(plugin);
    return plugin;
  };

  browser.solveRecaptchas = async (accessToken: string): Promise<SolveRecaptchasPlugin> => {
    const plugin = new SolveRecaptchasPlugin(accessToken);
    await browser.addPlugin(plugin);
    return plugin;
  };
}

// PuppeteerPro
export interface Browser extends Puppeteer.Browser, Pluginable {
  createBrowserContext(options?: Puppeteer.BrowserContextOptions): Promise<BrowserContext>;
  newPage(): Promise<Page>;
}

export interface BrowserContext extends Puppeteer.BrowserContext, Pluginable {
  newPage(): Promise<Page>;
}

export interface Page extends Puppeteer.Page {
  waitAndClick(selector: string, options?: Readonly<Puppeteer.ClickOptions>): Promise<void>;
  waitAndType(selector: string, text: string, options?: Readonly<Puppeteer.KeyboardTypeOptions>): Promise<void>;
}

export class Plugin {
  protected browser: Browser | BrowserContext | null = null;
  private initialized = false;
  private startCounter = 0;
  protected dependencies: Plugin[] = [];
  protected requiresInterception = false;

  get isInitialized() { return this.initialized; }
  get isStopped() { return this.startCounter === 0; }

  async addDependency(plugin: Plugin) {
    this.dependencies.push(plugin);
  }

  async init(browser: Browser | BrowserContext) {
    if (this.initialized) return;

    this.browser = browser;

    const offOnClose: (() => void)[] = [];
    browser.browserEvents.once('close', async () => {
      offOnClose.forEach(fn => fn());

      this.browser = null;
      this.initialized = false;
      this.startCounter = 0;

      await this.onClose();
    });

    this.startCounter++;

    const thisOnTargetCreated = this.onTargetCreated.bind(this);
    browser.on('targetcreated', thisOnTargetCreated);
    offOnClose.push(() => browser.off('targetcreated', thisOnTargetCreated));

    this.initialized = true;

    this.dependencies.forEach(x => x.init(browser));

    return this.afterLaunch(browser);
  }

  protected async afterLaunch(_browser: Browser | BrowserContext) { null; }
  protected async onClose() { null; }

  protected async onTargetCreated(target: Puppeteer.Target) {
    if (this.isStopped) return;

    if (target.type() !== 'page') return;
    const page = newPage(await target.page() as Puppeteer.Page);
    if (page.isClosed()) return;

    const offOnClose: (() => void)[] = [];
    page.once('close', async () => {
      offOnClose.forEach(fn => fn());
    });

    const requestHandlers: ((request: any) => void)[] = [];
    page.on('request', request => {
      const _respond = request.respond;
      let responded = 0;
      let respondArgs: IArguments;

      const _abort = request.abort;
      let aborted = 0;
      let abortArgs: IArguments;

      const _continue = request.continue;
      let continued = 0;
      let continueArgs: IArguments;

      const handleRequest = async function () {
        const total = responded + aborted + continued;

        if (!(request as any)._interceptionHandled) {
          if (responded === 1) await _respond.apply(request, respondArgs);
          else if (responded === 0 && aborted >= 1 && total === requestHandlers.length) await _abort.apply(request, abortArgs);
          else if (continued === requestHandlers.length) await _continue.apply(request, continueArgs);
        }
      };

      request.respond = async function () { responded++; respondArgs = respondArgs || arguments; await handleRequest(); };
      request.abort = async function () { aborted++; abortArgs = abortArgs || arguments; await handleRequest(); };
      request.continue = async function () { continued++; continueArgs = continueArgs || arguments; await handleRequest(); };

      requestHandlers.forEach(handler => handler(request));
    });

    const _pageOn = page.on;
    page.on = function async(eventName, handler) {
      if (eventName === 'request') {
        requestHandlers.push(handler);

        return page;
      } else {
        return _pageOn.call(page, eventName, handler);
      }
    };

    if (this.requiresInterception) {
      await page.setRequestInterception(true);

      const thisOnRequest = this.onRequest.bind(this);
      page.on('request', thisOnRequest);
      offOnClose.push(() => page.off('request', thisOnRequest));
    }

    const thisOnDialog = this.onDialog.bind(this);
    page.on('dialog', thisOnDialog);
    offOnClose.push(() => page.off('dialog', thisOnDialog));

    await this.onPageCreated(page);
  }

  protected async onPageCreated(_page: Page) { null; }

  protected async onRequest(request: Puppeteer.HTTPRequest) {
    const interceptionHandled = (request as any)._interceptionHandled;
    if (interceptionHandled) return;
    if (this.isStopped) return request.continue();

    await this.processRequest(request);
  }

  protected async processRequest(_request: Puppeteer.HTTPRequest) { null; }

  protected async onDialog(dialog: Dialog) {
    if (this.isStopped) return;

    const _dismiss = dialog.dismiss;
    dialog.dismiss = async () => {
      if (dialog.handled) return;

      await _dismiss.apply(dialog);
    };

    await this.processDialog(dialog);
  }

  protected async processDialog(_dialog: Dialog) { null; }

  protected async beforeRestart() { null; }
  async restart() {
    await this.beforeRestart();

    this.startCounter++;
    if (this.requiresInterception && this.browser) this.browser.interceptions++;

    this.dependencies.forEach(x => x.restart());

    await this.afterRestart();
  }

  protected async afterRestart() { null; }

  protected async beforeStop() { null; }
  async stop() {
    await this.beforeStop();

    this.startCounter--;
    if (this.requiresInterception && this.browser) this.browser.interceptions--;

    if (this.browser && this.browser.interceptions === 0) {
      const pages = await this.browser.pages();

      pages.filter(x => !x.isClosed()).forEach(async (page: Puppeteer.Page) => {
        await page.setRequestInterception(false);
      });
    }

    this.dependencies.forEach(x => x.stop());

    await this.afterStop();
  }

  protected async afterStop() { null; }

  protected async getFirstPage() {
    if (!this.browser) return null;

    const pages = await this.browser.pages();
    const openPages = pages.filter(x => !x.isClosed());
    const activePages = pages.filter(x => x.url() !== 'about:blank');

    return activePages[0] || openPages[0];
  }
}

interface Pluginable {
  plugins: Plugin[];
  browserEvents: events.EventEmitter;
  interceptions: number;

  addPlugin: (plugin: Plugin) => Promise<void>;
  clearPlugins: () => void;
  anonymizeUserAgent: () => Promise<AnonymizeUserAgentPlugin>;
  avoidDetection: (options?: FingerprintGeneratorOptions) => Promise<AvoidDetectionPlugin>;
  blockResources: (...resources: Resource[]) => Promise<BlockResourcesPlugin>;
  disableDialogs: (logMessages?: boolean) => Promise<DisableDialogsPlugin>;
  manageCookies: (opts: ManageCookiesOption) => Promise<ManageCookiesPlugin>;
  manageLocalStorage: (opts: ManageLocalStorageOption) => Promise<ManageLocalStoragePlugin>;
  solveRecaptchas: (accessToken: string) => Promise<SolveRecaptchasPlugin>;
}

interface Dialog extends Puppeteer.Dialog {
  handled: boolean;
}

import { AnonymizeUserAgentPlugin } from './plugins/anonymize.user.agent';
import { AvoidDetectionPlugin } from './plugins/avoid.detection';
import { BlockResourcesPlugin, Resource } from './plugins/block.resources';
import { DisableDialogsPlugin } from './plugins/disable.dialogs';
import { ManageCookiesOption, ManageCookiesPlugin } from './plugins/manage.cookies';
import { ManageLocalStorageOption, ManageLocalStoragePlugin } from './plugins/manage.localstorage';
import { SolveRecaptchasPlugin } from './plugins/solve.recaptchas';

import type { newInjectedPage } from 'fingerprint-injector';
type FingerprintGeneratorOptions = Parameters<typeof newInjectedPage>[1];
