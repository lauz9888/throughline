import { setWorldConstructor, World as CucumberWorld, IWorldOptions } from '@cucumber/cucumber';
import { JSDOM } from 'jsdom';

export class World extends CucumberWorld {
  dom: JSDOM;
  document: Document;

  constructor(options: IWorldOptions) {
    super(options);
    this.dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost/',
    });
    this.document = this.dom.window.document;
  }
}

setWorldConstructor(World);
