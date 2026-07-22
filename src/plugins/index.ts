/* eslint-disable prefer-rest-params */

// Puppeteer Defaults
import * as Puppeteer from 'puppeteer';

import type { Browser, BrowserContext, Page } from '..';
import { Dialog, newPage } from './shared';

export class Plugin {
  protected browser: Browser | BrowserContext | null = null;
  private initialized = false;
  private startCounter = 0;
  private teardowns: (() => void)[] = [];
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

    const onBrowserClose = async () => {
      this.unbind();
      this.browser = null;
      this.initialized = false;
      this.startCounter = 0;
      await this.onClose();
    };
    browser.browserEvents.once('close', onBrowserClose);
    this.teardowns.push(() => browser.browserEvents.off('close', onBrowserClose));

    this.startCounter++;

    const thisOnTargetCreated = (...args: Parameters<Plugin['onTargetCreated']>) => {
      void Promise.resolve(this.onTargetCreated(...args)).catch(() => undefined);
    };
    browser.on('targetcreated', thisOnTargetCreated);
    this.teardowns.push(() => browser.off('targetcreated', thisOnTargetCreated));

    this.initialized = true;

    await Promise.all(this.dependencies.map(x => x.init(browser)));

    return this.afterLaunch(browser);
  }

  async remove() {
    await this.stop();
    await Promise.all(this.dependencies.map(x => x.remove()));
    this.unbind();
    this.browser = null;
    this.initialized = false;
    this.startCounter = 0;
  }

  private unbind() {
    for (const teardown of this.teardowns) teardown();
    this.teardowns = [];
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

      for (const handler of requestHandlers) {
        void (async () => {
          const before = responded + aborted + continued;
          try {
            await handler(request);
          } catch {
            null;
          }
          if (responded + aborted + continued === before) {
            await request.continue();
          }
        })();
      }
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
    if (!this.isStopped) return;
    if (!this.initialized || !this.browser) return;

    await this.beforeRestart();

    this.startCounter++;
    if (this.requiresInterception && this.browser) this.browser.interceptions++;

    await Promise.all(this.dependencies.map(x => x.restart()));

    await this.afterRestart();
  }

  protected async afterRestart() { null; }

  protected async beforeStop() { null; }
  async stop() {
    if (this.isStopped) return;

    await this.beforeStop();

    this.startCounter--;
    if (this.requiresInterception && this.browser) this.browser.interceptions--;

    if (this.browser && this.browser.interceptions === 0) {
      const pages = await this.browser.pages();

      pages.filter(x => !x.isClosed()).forEach(async (page: Puppeteer.Page) => {
        await page.setRequestInterception(false);
      });
    }

    await Promise.all(this.dependencies.map(x => x.stop()));

    await this.afterStop();
  }

  protected async afterStop() { null; }

  protected async getFirstPage() {
    if (!this.browser) return null;

    const pages = await this.browser.pages();
    const openPages = pages.filter(x => !x.isClosed());
    const activePages = openPages.filter(x => x.url() !== 'about:blank');

    return activePages[0] || openPages[0];
  }
}
