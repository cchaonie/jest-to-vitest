#!/usr/bin/env node

import run from '../lib/index.js';

try {
  await run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
