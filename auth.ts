import crypto from 'node:crypto';
import { UserRole, SubscriptionStatus } from '../types';

export interface AuthSession {
  token: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  dealerId?: string; // Strictly set for DEALER and ORDER_TAKER; undefined for SUPER_ADMIN
  orderTakerId?: string; // Set for ORDER_TAKER
  active: boolean;
  subscriptionStatus?: SubscriptionStatus;
  createdAt: number;
  expiresAt: number;
}

export interface StoredUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  dealerId?: string;
  orderTakerId?: string;
  active: boolean;
  subscriptionStatus?: SubscriptionStatus;
}

// In-memory sessions store (token -> AuthSession)
// Keyed by a SHA-256 of the token, so saved sessions never contain a usable token
const activeSessions = new Map<string, AuthSession>();
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

// PBKDF2 Password Hashing (Salted & Multi-Iteration)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, passSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: passSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const checkHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
  } catch {
    return false;
  }
}

// Generate Secure Cryptographic Session Token
export function createSession(user: StoredUser): AuthSession {
  const token = `msf_sec_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const session: AuthSession = {
    token,
    userId: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    dealerId: user.dealerId,
    orderTakerId: user.orderTakerId,
    active: user.active,
    subscriptionStatus: user.subscriptionStatus,
    createdAt: now,
    // Field order takers may be without signal for days, so their phone stays signed in longer
    expiresAt: now + (user.role === 'ORDER_TAKER' ? 30 : 1) * 24 * 60 * 60 * 1000,
  };
  activeSessions.set(hashToken(token), session);
  return session;
}

export function getSession(token?: string): AuthSession | null {
  if (!token) return null;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const key = hashToken(cleanToken);
  const session = activeSessions.get(key);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(key);
    return null;
  }
  return session;
}

export function invalidateSession(token?: string): boolean {
  if (!token) return false;
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  return activeSessions.delete(hashToken(cleanToken));
}

export function invalidateAllUserSessions(userId: string) {
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(token);
    }
  }
}

// Log the user out everywhere except the device they are using now (used after a password change)
export function invalidateOtherUserSessions(userId: string, keepToken?: string) {
  const keep = keepToken ? hashToken(keepToken.startsWith('Bearer ') ? keepToken.slice(7).trim() : keepToken.trim()) : '';
  for (const [key, session] of activeSessions.entries()) {
    if (session.userId === userId && key !== keep) activeSessions.delete(key);
  }
}

// Sessions are saved with the database so a server restart does not log everyone out.
export function snapshotSessions(): string {
  const now = Date.now();
  const rows: [string, Omit<AuthSession, 'token'>][] = [];
  for (const [key, { token: _t, ...rest }] of activeSessions.entries()) {
    if (rest.expiresAt > now) rows.push([key, rest]);
  }
  return JSON.stringify(rows);
}

export function restoreSessions(json: string) {
  const now = Date.now();
  for (const [key, rest] of JSON.parse(json) as [string, Omit<AuthSession, 'token'>][]) {
    if (rest.expiresAt > now) activeSessions.set(key, { ...rest, token: '' } as AuthSession);
  }
}

export function clearAllSessions() {
  activeSessions.clear();
}

export type PasswordChange = { ok: true; hash: string; salt: string } | { ok: false; status: number; error: string; code: string };

// Checks the current password and the rules for the new one (pure: the caller saves the result)
export function checkPasswordChange(user: { passwordHash: string; passwordSalt: string; role: string }, current: unknown, next: unknown): PasswordChange {
  if (typeof current !== 'string' || typeof next !== 'string') {
    return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: 'Enter your current and new password.' };
  }
  if (!verifyPassword(current, user.passwordHash, user.passwordSalt)) {
    return { ok: false, status: 401, code: 'WRONG_PASSWORD', error: 'Your current password is not correct.' };
  }
  const min = user.role === 'SUPER_ADMIN' ? 12 : 8;
  if (next.length < min || next.length > 200) {
    return { ok: false, status: 400, code: 'WEAK_PASSWORD', error: `New password must be at least ${min} characters.` };
  }
  if (next === current) {
    return { ok: false, status: 400, code: 'SAME_PASSWORD', error: 'New password must be different from the current one.' };
  }
  const h = hashPassword(next);
  return { ok: true, hash: h.hash, salt: h.salt };
}

// Admin reset (no current password needed): only checks the new password's strength
export function checkPasswordReset(role: string, next: unknown): PasswordChange {
  const min = role === 'SUPER_ADMIN' ? 12 : 8;
  if (typeof next !== 'string' || next.length < min || next.length > 200) {
    return { ok: false, status: 400, code: 'WEAK_PASSWORD', error: `New password must be at least ${min} characters.` };
  }
  const h = hashPassword(next);
  return { ok: true, hash: h.hash, salt: h.salt };
}
