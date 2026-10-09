// Runs the business-logic test suite with tsx (already a project dependency).
import { execSync } from 'node:child_process';
execSync('node --check public/sw.js', { stdio: 'inherit' });
execSync('npx tsx --test tests/store.test.mjs tests/server-prod.test.mjs tests/persist.test.mjs tests/restart.test.mjs tests/ordertaker.test.mjs tests/flow.test.mjs tests/ai.test.mjs tests/auth.test.mjs tests/offline.test.mjs', { stdio: 'inherit' });
