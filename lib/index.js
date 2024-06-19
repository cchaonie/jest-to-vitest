const simpleGit = require('simple-git');
const fs = require('fs-extra');
const readlineSync = require('readline-sync');
const { execSync } = require('child_process');
const path = require('path');

const git = simpleGit();

async function run() {
  try {
    // Switch to main branch and pull latest changes
    await git.checkout('main');
    await git.pull();

    // Create new branch
    await git.checkoutLocalBranch('vitest');

    // Set Yarn logFilters
    execSync(
      'yarn config set logFilters --json \'[{"code":"YN0076","level":"discard"}]\''
    );

    // Add Vitest config
    const vitestConfig = `// eslint-disable-next-line import/no-unresolved
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: 'vitest.setup.ts',
  },
});`;
    fs.writeFileSync('vitest.config.ts', vitestConfig);

    // Add Vitest setup
    const vitestSetup = `import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
afterEach(() => {
  cleanup();
});`;
    fs.writeFileSync('vitest.setup.ts', vitestSetup);

    // Update npm scripts
    execSync('npm pkg delete scripts.jest');
    execSync('npm pkg set scripts.unit="vitest run"');

    let testScript = execSync('npm pkg get scripts.test').toString();
    testScript = testScript.replace(/jest/g, 'unit').replace(/"/g, '');
    execSync(`npm pkg set scripts.test=${testScript}`);

    // Install Vitest and remove Babel and Jest packages
    execSync('npm install vitest jsdom --dev');
    fs.removeSync('.babelrc');
    fs.removeSync('jest.config.js');
    execSync(
      'npm remove @babel/core @babel/preset-env @babel/preset-react @babel/preset-typescript @types/jest jest jest-environment-jsdom'
    );
    execSync('npm dedupe');

    // Process test files
    const testFiles = execSync(
      'find src -type f \\( -name "*.spec.js" -o -name "*.spec.ts" -o -name "*.spec.jsx" -o -name "*.spec.tsx" -o -name "*.test.js" -o -name "*.test.ts" -o -name "*.test.jsx" -o -name "*.test.tsx" \\) | grep -v "node_modules"'
    )
      .toString()
      .split('\n')
      .filter(file => file);

    testFiles.forEach(file => {
      console.log(`Processing ${file}`);

      const content = fs.readFileSync(file, 'utf8');
      if (/from ['"]vitest['"]/.test(content)) {
        console.log(
          '  Test file appears to have already been migrated to Vitest. Skipping'
        );
        return;
      }
      if (/from ['"]@playwright\/test['"]/.test(content)) {
        console.log('  Test file appears to be using Playwright. Skipping');
        return;
      }

      let newContent = content
        .replace(/jest\.clearAllMocks/g, 'vi.clearAllMocks')
        .replace(/jest\.fn/g, 'vi.fn')
        .replace(/jest\.mocked/g, 'vi.mocked')
        .replace(/jest\.resetAllMocks/g, 'vi.resetAllMocks')
        .replace(/jest\.resetModules/g, 'vi.resetModules')
        .replace(/jest\.spyOn/g, 'vi.spyOn')
        .replace(/jest\.useFakeTimers/g, 'vi.useFakeTimers')
        .replace(/jest\.useRealTimers/g, 'vi.useRealTimers')
        .replace(
          /advanceTimers: jest.advanceTimersByTime/g,
          'advanceTimers: vi.advanceTimersByTime.bind(vi)'
        );

      if (/jest\.mock\(/.test(content)) {
        console.log(
          `  Warning: ${file} contained jest.mock(). You'll likely need to manually fix vi.mock() implementation.`
        );
        newContent = newContent.replace(/jest\.mock/g, 'vi.mock');
      }
      if (/jest\.requireActual\(/.test(content)) {
        console.log(
          `  Warning: ${file} contained jest.requireActual(). You'll likely need to manually fix vi.importActual() implementation.`
        );
        newContent = newContent.replace(
          /jest\.requireActual/g,
          'vi.importActual'
        );
      }

      const imports = ['describe', 'expect', 'it'];
      if (/afterEach/.test(content)) imports.push('afterEach');
      if (/beforeEach/.test(content)) imports.push('beforeEach');
      if (/vi\./.test(content)) imports.push('vi');

      const importStatement = `import { ${imports.join(
        ', '
      )} } from 'vitest';\n`;
      newContent = importStatement + newContent;

      fs.writeFileSync(file, newContent, 'utf8');
      console.log('  Done');
    });

    // Update CI configuration
    const ciPath = path.join('.github', 'workflows', 'ci.yml');
    if (fs.existsSync(ciPath)) {
      const ciContent = fs.readFileSync(ciPath, 'utf8');
      const newCiContent = ciContent.replace(/yarn jest/g, 'yarn unit');
      fs.writeFileSync(ciPath, newCiContent, 'utf8');
    }

    // Run Prettier, unit tests, and linting
    execSync('npx prettier --write .');
    execSync('npm run unit');
    execSync('npm run lint');

    // Commit and push changes
    await git.add('.');
    await git.commit('Migrate from Jest to Vitest');
    await git.push(['-u', 'origin', 'vitest']);

    // Create a pull request
    execSync('gh pr create --title "Migrate from Jest to Vitest" --body ""');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

run();
