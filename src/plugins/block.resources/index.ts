import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';

export type Resource = 'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'eventsource' | 'websocket' | 'manifest' | 'other';
export class BlockResourcesPlugin extends Plugin {
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
