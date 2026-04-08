import { createHash, randomBytes } from 'node:crypto';

export interface PublicTokenResult {
  rawToken: string;
  tokenHash: string;
}

export function generatePublicToken(): PublicTokenResult {
  const rawToken = randomBytes(24).toString('hex');
  const tokenHash = hashPublicToken(rawToken);

  return {
    rawToken,
    tokenHash,
  };
}

export function hashPublicToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
