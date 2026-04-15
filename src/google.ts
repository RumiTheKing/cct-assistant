import { google } from 'googleapis';
import { createOAuthClient, loadSavedTokens } from './auth';

export async function getOAuth2Client() {
  const client = createOAuthClient();
  const savedTokens = await loadSavedTokens();

  if (!savedTokens) {
    throw new Error('Google is not connected yet. Use the Connect Google flow first.');
  }

  client.setCredentials(savedTokens);
  return client;
}

export async function getGoogleClients() {
  const auth = await getOAuth2Client();
  return {
    auth,
    sheets: google.sheets({ version: 'v4', auth }),
    gmail: google.gmail({ version: 'v1', auth }),
    docs: google.docs({ version: 'v1', auth }),
    drive: google.drive({ version: 'v3', auth }),
  };
}
