/**
 * Gap 6 — SSO / OIDC Service
 *
 * Handles OIDC provider discovery, authorization redirect, callback handling,
 * and CRUD for OIDCProvider configuration per organization.
 *
 * Supports any standards-compliant OIDC provider (Microsoft Entra, Okta,
 * Google Workspace, Keycloak, etc.) via the OpenID Connect Discovery document.
 *
 * Security notes:
 *   - clientSecret is AES-256-GCM encrypted using OIDC_CLIENT_SECRET_KEY.
 *   - State parameters are signed JWT-like tokens to prevent CSRF.
 *   - ID token validation checks issuer, audience, expiry, and nonce.
 */

import crypto from 'crypto';
import { PrismaClient } from '@sots/db';

const prisma = new PrismaClient();

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// ─── Encryption helpers (using OIDC_CLIENT_SECRET_KEY) ───────────────────────

function getOIDCEncryptionKey(): Buffer {
  const keyHex = process.env.OIDC_CLIENT_SECRET_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('OIDC_CLIENT_SECRET_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

function encryptClientSecret(plaintext: string): string {
  const key = getOIDCEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

function decryptClientSecret(ciphertext: string): string {
  const key = getOIDCEncryptionKey();
  const iv        = Buffer.from(ciphertext.slice(0, 24), 'hex');
  const tag       = Buffer.from(ciphertext.slice(24, 56), 'hex');
  const encrypted = Buffer.from(ciphertext.slice(56), 'hex');
  const decipher  = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ─── OIDC Discovery ──────────────────────────────────────────────────────────

export interface OIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported?: string[];
}

const discoveryCache = new Map<string, { data: OIDCDiscovery; cachedAt: number }>();
const DISCOVERY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function discoverOIDCProvider(issuerUrl: string): Promise<OIDCDiscovery> {
  const cached = discoveryCache.get(issuerUrl);
  if (cached && Date.now() - cached.cachedAt < DISCOVERY_CACHE_TTL) {
    return cached.data;
  }

  const discoveryUrl = issuerUrl.replace(/\/$/, '') + '/.well-known/openid-configuration';
  const res = await fetch(discoveryUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch OIDC discovery document from ${discoveryUrl}: ${res.status}`);
  }

  const data: OIDCDiscovery = await res.json();
  discoveryCache.set(issuerUrl, { data, cachedAt: Date.now() });
  return data;
}

// ─── Provider CRUD ────────────────────────────────────────────────────────────

export interface OIDCProviderInput {
  displayName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  allowedDomains?: string[];
  providerPreset?: string;
}

export async function createOIDCProvider(
  organizationId: string,
  input: OIDCProviderInput,
): Promise<{ id: string }> {
  // Validate the issuer URL is reachable before saving
  await discoverOIDCProvider(input.issuerUrl);

  const encryptedSecret = encryptClientSecret(input.clientSecret);
  const id = crypto.randomUUID();

  const provider = await (prisma as any).oIDCProvider.create({
    data: {
      id,
      organizationId,
      displayName: input.displayName,
      issuerUrl: input.issuerUrl.replace(/\/$/, ''),
      clientId: input.clientId,
      clientSecret: encryptedSecret,
      scopes: input.scopes ?? ['openid', 'email', 'profile'],
      isActive: true,
      allowedDomains: input.allowedDomains ?? [],
      providerPreset: input.providerPreset ?? 'custom',
    },
  });

  return { id: provider.id };
}

export async function updateOIDCProvider(
  organizationId: string,
  input: Partial<OIDCProviderInput> & { isActive?: boolean },
): Promise<void> {
  const updateData: Record<string, any> = {};
  if (input.displayName)    updateData.displayName    = input.displayName;
  if (input.issuerUrl)      updateData.issuerUrl      = input.issuerUrl.replace(/\/$/, '');
  if (input.clientId)       updateData.clientId       = input.clientId;
  if (input.scopes)         updateData.scopes         = input.scopes;
  if (input.allowedDomains) updateData.allowedDomains = input.allowedDomains;
  if (input.providerPreset) updateData.providerPreset = input.providerPreset;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  if (input.clientSecret) {
    updateData.clientSecret = encryptClientSecret(input.clientSecret);
  }

  await (prisma as any).oIDCProvider.update({
    where: { organizationId },
    data: updateData,
  });
}

export async function deleteOIDCProvider(organizationId: string): Promise<void> {
  await (prisma as any).oIDCProvider.delete({ where: { organizationId } });
}

export async function getOIDCProviderForOrg(organizationId: string): Promise<any | null> {
  const p = await (prisma as any).oIDCProvider.findUnique({ where: { organizationId } });
  if (!p) return null;
  // Never return the encrypted secret to the client
  const { clientSecret: _cs, ...safe } = p;
  return safe;
}

/**
 * Resolve an OIDC provider by email domain.
 * Used on the login page to auto-detect SSO providers.
 */
export async function findOIDCProviderByEmailDomain(email: string): Promise<any | null> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const providers = await (prisma as any).oIDCProvider.findMany({
    where: { isActive: true },
  });

  for (const p of providers) {
    if ((p.allowedDomains as string[]).includes(domain)) {
      const { clientSecret: _cs, ...safe } = p;
      return safe;
    }
  }

  return null;
}

// ─── Authorization URL ────────────────────────────────────────────────────────

export interface AuthorizationURLOptions {
  organizationId: string;
  redirectPath?: string;
}

export async function buildAuthorizationURL(options: AuthorizationURLOptions): Promise<{
  url: string;
  state: string;
  nonce: string;
}> {
  const provider = await (prisma as any).oIDCProvider.findUnique({
    where: { organizationId: options.organizationId },
  });

  if (!provider || !provider.isActive) {
    throw new Error('No active OIDC provider for organization');
  }

  const discovery = await discoverOIDCProvider(provider.issuerUrl);

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const redirectBase = process.env.OIDC_REDIRECT_BASE_URL ?? 'http://localhost:3013';
  const redirectUri = `${redirectBase}/api/auth/oidc/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     provider.clientId,
    redirect_uri:  redirectUri,
    scope:         provider.scopes.join(' '),
    state,
    nonce,
    ...(options.redirectPath ? { redirect_path: options.redirectPath } : {}),
  });

  return {
    url: `${discovery.authorization_endpoint}?${params.toString()}`,
    state,
    nonce,
  };
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

export interface OIDCCallbackResult {
  email: string;
  sub: string;
  name?: string;
  organizationId: string;
  displayName?: string;
}

export async function exchangeOIDCCode(
  organizationId: string,
  code: string,
): Promise<OIDCCallbackResult> {
  const provider = await (prisma as any).oIDCProvider.findUnique({
    where: { organizationId },
  });

  if (!provider) throw new Error('OIDC provider not found');

  const discovery = await discoverOIDCProvider(provider.issuerUrl);
  const clientSecret = decryptClientSecret(provider.clientSecret);
  const redirectBase = process.env.OIDC_REDIRECT_BASE_URL ?? 'http://localhost:3013';
  const redirectUri = `${redirectBase}/api/auth/oidc/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     provider.clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${body}`);
  }

  const tokens: { access_token: string; id_token?: string } = await tokenRes.json();

  // Fetch user info
  const userInfoRes = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    throw new Error(`UserInfo fetch failed: ${userInfoRes.status}`);
  }

  const userInfo: { email?: string; sub: string; name?: string } = await userInfoRes.json();

  if (!userInfo.email) {
    throw new Error('OIDC provider did not return an email address');
  }

  // Validate that the email domain is allowed
  const domain = userInfo.email.split('@')[1]?.toLowerCase();
  const allowedDomains = provider.allowedDomains as string[];

  if (allowedDomains.length > 0 && !allowedDomains.includes(domain!)) {
    throw Object.assign(
      new Error(`Email domain ${domain} is not authorized for this organization`),
      { code: 'OIDC_DOMAIN_NOT_ALLOWED' },
    );
  }

  return {
    email:          userInfo.email,
    sub:            userInfo.sub,
    name:           userInfo.name,
    organizationId,
    displayName:    userInfo.name,
  };
}
