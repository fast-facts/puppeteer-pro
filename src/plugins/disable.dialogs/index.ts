import * as Puppeteer from 'puppeteer';

import { Plugin } from '../../index';

export class DisableDialogsPlugin extends Plugin {
  protected async processDialog(dialog: Puppeteer.Dialog) {
    dialog.dismiss();
  }
}