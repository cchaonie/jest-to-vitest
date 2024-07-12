import path from 'path';

// src/pages/Account/PostSale/containers/WishlistContainer/selectors/__tests__/selectEligibleProducts.test.tsx
export default filePath => {
  const dirname = path.dirname(filePath);
  const basename = path.basename(filePath);
  const name = basename.replace('.test.tsx', '');
  return path.join(dirname, `${name}.spec.tsx`);
};
