import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { google } from 'googleapis';
import { KEYCHAIN_SERVICE, LEGACY_TOKENS_PATH } from './config';

const execFileAsync = promisify(execFile);
const TOKENS_PATH = path.join(process.cwd(), LEGACY_TOKENS_PATH);
const KEYCHAIN_ACCOUNT = 'default';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
];

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3017/oauth2callback';

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);
  return tokens;
}

export async function loadSavedTokens() {
  const keychainTokens = await loadTokensFromKeychain();
  if (keychainTokens) return keychainTokens;

  if (!fs.existsSync(TOKENS_PATH)) return null;
  const legacyTokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));
  await saveTokensToKeychain(legacyTokens);
  return legacyTokens;
}

export async function hasSavedTokens() {
  return Boolean(await loadSavedTokens());
}

export async function getConnectedAccountEmail(): Promise<string | null> {
  const tokens = await loadSavedTokens();
  if (!tokens) return null;

  const tokenEmail = getEmailFromTokens(tokens);
  if (tokenEmail) return tokenEmail;

  try {
    const client = createOAuthClient();
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    return me.data.email || null;
  } catch {
    return null;
  }
}

export async function clearSavedTokens() {
  try {
    await execFileAsync('security', [
      'delete-generic-password',
      '-a',
      KEYCHAIN_ACCOUNT,
      '-s',
      KEYCHAIN_SERVICE,
    ]);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw new Error(`Failed to remove Google tokens from macOS Keychain: ${formatExecError(error)}`);
    }
  }

  if (fs.existsSync(TOKENS_PATH)) {
    fs.unlinkSync(TOKENS_PATH);
  }
}

export function getTokenPath() {
  return `macOS Keychain (${KEYCHAIN_SERVICE})`;
}

async function saveTokens(tokens: unknown) {
  await saveTokensToKeychain(tokens);

  if (fs.existsSync(TOKENS_PATH)) {
    fs.unlinkSync(TOKENS_PATH);
  }
}

async function saveTokensToKeychain(tokens: unknown) {
  const payload = JSON.stringify(tokens);

  try {
    await execFileAsync('security', [
      'add-generic-password',
      '-a',
      KEYCHAIN_ACCOUNT,
      '-s',
      KEYCHAIN_SERVICE,
      '-U',
      '-w',
      payload,
    ]);
  } catch (error) {
    throw new Error(`Failed to save Google tokens to macOS Keychain: ${formatExecError(error)}`);
  }
}

async function loadTokensFromKeychain() {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-generic-password',
      '-a',
      KEYCHAIN_ACCOUNT,
      '-s',
      KEYCHAIN_SERVICE,
      '-w',
    ]);
    return JSON.parse(stdout);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw new Error(`Failed to load Google tokens from macOS Keychain: ${formatExecError(error)}`);
  }
}

function getEmailFromTokens(tokens: {
  id_token?: string | null;
  email?: string | null;
  account_email?: string | null;
  user_email?: string | null;
}): string | null {
  for (const candidate of [tokens.email, tokens.account_email, tokens.user_email]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const idToken = tokens.id_token;
  if (!idToken) return null;

  const parts = idToken.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      email?: unknown;
      email_address?: unknown;
      preferred_username?: unknown;
    };

    for (const candidate of [payload.email, payload.email_address, payload.preferred_username]) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

function isNotFoundError(error: unknown) {
  const stderr = formatExecError(error);
  return stderr.includes('could not be found') || stderr.includes('The specified item could not be found');
}

function formatExecError(error: unknown) {
  if (error && typeof error === 'object' && 'stderr' in error) {
    const stderr = String((error as { stderr?: string }).stderr || '').trim();
    if (stderr) return stderr;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}
