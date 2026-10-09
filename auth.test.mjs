import test from 'node:test';
import assert from 'node:assert/strict';

const a = await import('../src/server/auth.ts');
const user = (pw, role = 'DEALER') => { const h = a.hashPassword(pw); return { id: 'u1', username: 'bob', email: 'b@x.pk', name: 'Bob', role, dealerId: 'dA', active: true, passwordHash: h.hash, passwordSalt: h.salt }; };

test('sessions survive a restart and never store a usable token', () => {
  a.clearAllSessions();
  const s = a.createSession(user('old-password-1'));
  const saved = a.snapshotSessions();
  assert.ok(!saved.includes(s.token), 'raw token must not be saved');
  a.clearAllSessions();
  assert.equal(a.getSession(s.token), null); // gone after "restart"
  a.restoreSessions(saved);
  assert.equal(a.getSession(s.token)?.username, 'bob'); // restored
  assert.equal(a.getSession('Bearer ' + s.token)?.userId, 'u1');
  assert.equal(a.getSession(s.token + 'x'), null);
  a.invalidateSession(s.token);
  assert.equal(a.getSession(s.token), null);
});

test('expired sessions are not restored', () => {
  a.clearAllSessions();
  const s = a.createSession(user('old-password-1'));
  const rows = JSON.parse(a.snapshotSessions());
  rows[0][1].expiresAt = Date.now() - 1000;
  a.clearAllSessions();
  a.restoreSessions(JSON.stringify(rows));
  assert.equal(a.getSession(s.token), null);
});

test('password change: wrong current, weak, same, and success', () => {
  const u = user('old-password-1');
  assert.equal(a.checkPasswordChange(u, 'nope', 'new-password-9').code, 'WRONG_PASSWORD');
  assert.equal(a.checkPasswordChange(u, 'old-password-1', 'short').code, 'WEAK_PASSWORD');
  assert.equal(a.checkPasswordChange(u, 'old-password-1', 'old-password-1').code, 'SAME_PASSWORD');
  assert.equal(a.checkPasswordChange(u, undefined, 'new-password-9').code, 'VALIDATION_FAILED');
  const ok = a.checkPasswordChange(u, 'old-password-1', 'new-password-9');
  assert.equal(ok.ok, true);
  assert.ok(a.verifyPassword('new-password-9', ok.hash, ok.salt));
  assert.ok(!a.verifyPassword('old-password-1', ok.hash, ok.salt));
  // super admin needs 12+
  const sa = user('old-password-1', 'SUPER_ADMIN');
  assert.equal(a.checkPasswordChange(sa, 'old-password-1', 'only-10-chr').code, 'WEAK_PASSWORD');
  assert.equal(a.checkPasswordChange(sa, 'old-password-1', 'long-enough-12!').ok, true);
});

test('after a password change, other devices are logged out but this one stays', () => {
  a.clearAllSessions();
  const u = user('old-password-1');
  const phone = a.createSession(u);
  const laptop = a.createSession(u);
  const other = a.createSession({ ...u, id: 'u2', username: 'amy' });
  a.invalidateOtherUserSessions('u1', laptop.token);
  assert.equal(a.getSession(phone.token), null);
  assert.ok(a.getSession(laptop.token));
  assert.ok(a.getSession(other.token)); // other people are untouched
});

test('admin reset checks strength and does not need the old password', () => {
  assert.equal(a.checkPasswordReset('DEALER', 'short').code, 'WEAK_PASSWORD');
  assert.equal(a.checkPasswordReset('DEALER', undefined).ok, false);
  const r = a.checkPasswordReset('DEALER', 'brand-new-pass');
  assert.equal(r.ok, true);
  assert.ok(a.verifyPassword('brand-new-pass', r.hash, r.salt));
});
