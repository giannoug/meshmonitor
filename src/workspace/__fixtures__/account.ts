/**
 * You › Sign-in & security and API Token (Task 6.1): the signed-in user's
 * two-factor, passkeys, passkey-only state and API token, as today's routes
 * answer (`/api/mfa/*`, `/api/auth/passkey*`, `/api/token*`). The secrets are
 * fake and only ever shown in a one-time reveal.
 */
import type { FixtureHandler } from './fixtureApi';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);

export const TOTP_KEY = 'JBSWY3DPEHPKKQ2T6MZA';
export const BACKUP_CODES = ['k7m2x9qa', 'p3n8w4cr', 'h6t2bv5z', 'y9e5jlqf', 'r3m7ugkc', 'd8x4snpw', 'b2h6vtje', 'z5q9amlr', 'f7c3kwyu', 'n4l8pdxb'];
export const RECOVERY_CODES = ['7KQ2-M9XD', 'P4WN-8C3R', 'H6TB-2VZA', 'Y9EJ-5LQF', 'R3MU-7GKC', 'D8XS-4NPW', 'B2HV-6TJE', 'Z5QA-9RML', 'F7CK-3WYU', 'N4LP-8DXB'];
export const NEW_TOKEN_VALUE = 'mm_v1_3f9a7c2e4b81d6f05a9e3c7b2d4f8a16c0e9b75d3a2f';
/** A 1×1 PNG: the QR code's stand-in. */
const QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const PASSKEYS = [
  { id: 1, userId: 1, nickname: 'Work laptop', deviceType: 'multiDevice', backedUp: true, transports: ['internal'], rpId: 'mesh.example.org', createdAt: NOW - 250 * DAY, lastUsedAt: NOW - 3600_000 },
  { id: 2, userId: 1, nickname: 'Pixel 9', deviceType: 'multiDevice', backedUp: true, transports: ['hybrid'], rpId: 'mesh.example.org', createdAt: NOW - 155 * DAY, lastUsedAt: NOW - 2 * DAY },
];

const TOKEN_INFO = { id: 7, prefix: 'mm_v1_3f9a', createdAt: NOW, lastUsedAt: NOW - 600_000, isActive: true };

export interface AccountOptions {
  mfa?: boolean;
  token?: boolean;
  passkeys?: typeof PASSKEYS;
  passwordLoginDisabled?: boolean;
  recoveryCodesLeft?: number;
}

export function accountFixtures({ mfa = true, token = true, passkeys = PASSKEYS, passwordLoginDisabled = false, recoveryCodesLeft = 0 }: AccountOptions = {}): Record<string, FixtureHandler> {
  return {
    'GET /api/mfa/status': () => ({ enabled: mfa }),
    'POST /api/mfa/setup': () => ({ qrCodeDataUrl: QR, secret: TOTP_KEY, backupCodes: BACKUP_CODES }),
    'POST /api/mfa/verify-setup': () => ({ success: true }),
    'POST /api/mfa/disable': () => ({ success: true }),
    'GET /api/auth/passkey': () => ({ success: true, data: passkeys }),
    'GET /api/auth/passkey/password-login': () => ({ success: true, data: { disabled: passwordLoginDisabled, recoveryCodesLeft } }),
    'POST /api/auth/passkey/step-up/options': () => ({ success: true, data: { challenge: 'c2l0ZS1jaGFsbGVuZ2U', allowCredentials: [], rpId: 'localhost' } }),
    'POST /api/auth/passkey/password-login': () => ({ success: true, data: { disabled: true, recoveryCodes: RECOVERY_CODES } }),
    'PATCH /api/auth/passkey/:id': () => ({ success: true, data: passkeys[0] }),
    'DELETE /api/auth/passkey/:id': () => ({ success: true }),
    'GET /api/token': () => (token ? { hasToken: true, token: TOKEN_INFO } : { hasToken: false, token: null }),
    'POST /api/token/generate': () => ({ token: NEW_TOKEN_VALUE, tokenInfo: TOKEN_INFO }),
    'DELETE /api/token': () => ({ success: true }),
    'POST /api/auth/change-password': () => ({ success: true }),
  };
}
