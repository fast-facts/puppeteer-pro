/* eslint-disable prefer-rest-params */
import * as events from 'events';

// Puppeteer Defaults
import * as Puppeteer from 'puppeteer';

const browserEvents = new events.EventEmitter();

export async function connect(options?: Puppeteer.ConnectOptions): Promise<Puppeteer.Browser> {
  const browser = await Puppeteer.connect(options || {});

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

/** The method launches a browser instance with given arguments. The browser will be closed when the parent node.js process is closed. */
export async function launch(options?: Puppeteer.LaunchOptions & Puppeteer.BrowserLaunchArgumentOptions & Puppeteer.BrowserConnectOptions): Promise<Puppeteer.Browser> {
  if (!options) options = {};

  const browser = await Puppeteer.launch({ defaultViewport: undefined, ...options });

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

// PuppeteerPro
let interceptions = 0;
export class Plugin {
  protected browser: Puppeteer.Browser | null = null;
  private initialized = false;
  private startCounter = 0;
  protected dependencies: Plugin[] = [];
  protected requiresInterception = false;

  get isInitialized() { return this.initialized; }
  get isStopped() { return this.startCounter === 0; }

  async addDependency(plugin: Plugin) {
    this.dependencies.push(plugin);
  }

  async init(browser: Puppeteer.Browser) {
    if (this.initialized) return;

    this.browser = browser;

    const offOnClose: (() => void)[] = [];
    browserEvents.once('close', async () => {
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

  protected async afterLaunch(_browser: Puppeteer.Browser) { null; }
  protected async onClose() { null; }

  protected async onTargetCreated(target: Puppeteer.Target) {
    if (this.isStopped) return;

    if (target.type() !== 'page') return;
    const page = await target.page() as Puppeteer.Page;
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
  protected async onPageCreated(_page: Puppeteer.Page) { null; }

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

      dialog.handled = true;
      await _dismiss.apply(dialog);
    };

    await this.processDialog(dialog);
  }
  protected async processDialog(_dialog: Dialog) { null; }

  protected async beforeRestart() { null; }
  async restart() {
    await this.beforeRestart();

    this.startCounter++;
    if (this.requiresInterception) interceptions++;

    this.dependencies.forEach(x => x.restart());

    await this.afterRestart();
  }
  protected async afterRestart() { null; }

  protected async beforeStop() { null; }
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
  protected async afterStop() { null; }

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

import { SolveRecaptchaPlugin } from './plugins/solve.recaptcha';
export function solveRecaptchas(accessToken: string): SolveRecaptchaPlugin {
  const plugin = new SolveRecaptchaPlugin(accessToken);
  plugins.push(plugin);
  return plugin;
}

interface Dialog extends Puppeteer.Dialog {
  handled: boolean;
}