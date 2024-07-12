# jest-to-vitest

A command line tool to convert jest tests to vitest tests

## What it does

1. Add `vitest.config.ts` and `vitest.setup.ts`
2. Install `vitest` related packages: `vitest` `jsdom` `@testing-library/jest-dom` `@testing-library/react`
3. Find all jest test files and update the content
4. Use prettier to format all files
5. Run new `vitest` unit tests

## Installation

Currently, it can only be used locally.

## How to use it

Go to the repository where you want to convert all jest tests file to vitest tests file, run command `jest-to-vitest`.

## links

[Migrating from Jest](https://vitest.dev/guide/migration.html#migrating-from-jest)
