import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

process.env.NODE_ENV = 'production';
process.env.SUPER_ADMIN_PASSWORD = 'A-very-Strong-Passw0rd!';
const { serverDb } = await import('../src/server/db.ts');
const { verifyPassword } = await import('../src/server/auth.ts');

test('production seeds only the Super Admin, with the password from the environment', () => {
  assert.equal(serverDb.users.length, 1);
  assert.equal(serverDb.users[0].role, 'SUPER_ADMIN');
  assert.equal(serverDb.dealers.length, 0);
  assert.equal(serverDb.orders.length, 0);
  const u = serverDb.findUserByLogin('superadmin');
  assert.ok(verifyPassword('A-very-Strong-Passw0rd!', u.passwordHash, u.passwordSalt));
  assert.ok(!verifyPassword('SuperAdminPassword123!', u.passwordHash, u.passwordSalt), 'demo password must not work');
});

test('production refuses to start without a strong SUPER_ADMIN_PASSWORD', () => {
  const r = spawnSync('npx tsx -e "import(\'./src/server/db.ts\').catch((e) => { console.error(e.message); process.exit(1); })"', {
    env: { ...process.env, SUPER_ADMIN_PASSWORD: '' },
    encoding: 'utf8',
    shell: true,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /SUPER_ADMIN_PASSWORD/);
});
