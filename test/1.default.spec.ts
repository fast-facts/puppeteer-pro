import * as PuppeteerPro from '../src/index';

describe('Original methods', () => {
  ['connect', 'launch'].map(x => {
    it(`should have ${x}`, () => {
      expect(PuppeteerPro).toHaveProperty(x);
    });
  });
});

