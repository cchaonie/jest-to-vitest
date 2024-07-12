import { describe, it, expect } from 'vitest';

import getVitestFileName from '../getVitestFileName.js';

describe('getVitestFileName', () => {
  it('should return the correct vitest file path for a given Jest test file path', () => {
    const jestFilePath =
      '/src/pages/Account/PostSale/containers/WishlistContainer/selectors/__tests__/selectEligibleProducts.test.tsx';
    const expectedVitestFilePath =
      '/src/pages/Account/PostSale/containers/WishlistContainer/selectors/__tests__/selectEligibleProducts.spec.tsx';

    const vitestFilePath = getVitestFileName(jestFilePath);

    expect(vitestFilePath).toBe(expectedVitestFilePath);
  });
});
