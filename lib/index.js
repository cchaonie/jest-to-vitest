import fs from 'fs-extra';
import readlineSync from 'readline-sync';
import { execSync } from 'child_process';
import path from 'path';

export default async function run() {
  const cwd = process.cwd();
  const moduleDir = path.dirname(new URL(import.meta.url).pathname);
  try {
    // Add Vitest config
    const vitestConfigPath = path.join(moduleDir, 'templates/vitest.config.ts');
    fs.copySync(vitestConfigPath, cwd);

    // Add Vitest setup
    const vitestSetupPath = path.join(moduleDir, 'templates/vitest.setup.ts');
    fs.copySync(vitestSetupPath, cwd);

    // Update npm scripts
    execSync('npm pkg set scripts.vitest="vitest run"');

    // Install Vitest
    execSync(
      'npm install vitest jsdom @testing-library/jest-dom @testing-library/react -D'
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

    // Run Prettier, unit tests, and linting
    execSync('npx prettier --write .');
    execSync('npm run vitest');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}
