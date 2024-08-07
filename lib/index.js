import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { glob } from 'glob';

import getVitestFileName from './utils/getVitestFileName.js';

export default async function run() {
  const cwd = process.cwd();
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);
  try {
    // Add Vitest config
    const vitestConfigPath = path.join(moduleDir, 'templates/vitest.config.ts');
    fs.copySync(vitestConfigPath, `${cwd}/vitest.config.ts`);
    console.log('Vitest config added to project.');
    // Add Vitest setup
    const vitestSetupPath = path.join(moduleDir, 'templates/vitest.setup.ts');
    fs.copySync(vitestSetupPath, `${cwd}/vitest.setup.ts`);
    console.log('Vitest setup added to project.');
    // Update npm scripts
    execSync('npm pkg set scripts.vitest="vitest -t *.spec.tsx"');

    // Install Vitest
    execSync(
      'npm install vitest jsdom @testing-library/jest-dom @testing-library/react -D'
    );
    execSync('npm dedupe');

    const unitTestFiles = await glob('**/*.test.tsx', {
      ignore: 'node_modules/**',
    });

    console.log(`Found ${unitTestFiles.length} unit test files.`);

    unitTestFiles
      .filter((f, i) => i === 0)
      .forEach(file => {
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

        fs.outputFileSync(getVitestFileName(file), newContent, 'utf8');
        console.log('  Done');
      });

    // Run Prettier, unit tests
    // execSync('npx prettier --write .');
    execSync('npm run vitest');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}
