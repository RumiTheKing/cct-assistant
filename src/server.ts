import 'dotenv/config';
import express from 'express';
import path from 'path';
import { getGoogleClients } from './google';
import { extractSpreadsheetId, loadRows } from './sheets';
import { runDraftAndPrint } from './run';
import { runStructuredBoardTool } from './structured';
import {
  clearSavedTokens,
  exchangeCodeForTokens,
  getAuthUrl,
  getTokenPath,
  hasSavedTokens,
} from './auth';
import {
  getDefaultTemplateSettings,
  loadTemplateSettings,
  saveTemplateSettings,
} from './template-settings';

const app = express();
const port = Number(process.env.PORT || 3017);

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, connected: await hasSavedTokens() });
});

app.get('/auth/google/start', (_req, res) => {
  try {
    res.redirect(getAuthUrl());
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Auth start failed');
  }
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) throw new Error('Missing OAuth code');
    await exchangeCodeForTokens(code);
    res.send(`Google connected successfully. Tokens saved to ${getTokenPath()}. You can close this tab.`);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'OAuth callback failed');
  }
});

app.post('/api/preview', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const { sheets } = await getGoogleClients();
    const preview = await loadRows(sheets, spreadsheetId);
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/run', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const { sheets, gmail, docs, drive } = await getGoogleClients();
    const result = await runDraftAndPrint(sheets, gmail, docs, drive, spreadsheetId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/structured/preview', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const { sheets } = await getGoogleClients();
    const preview = await loadRows(sheets, spreadsheetId, {
      requireEmail: false,
      trackingColumns: {
        status: 'Structured Status',
        docUrl: 'Structured Doc URL',
      },
    });
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/structured/run', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    const { sheets, docs } = await getGoogleClients();
    const result = await runStructuredBoardTool(sheets, docs, spreadsheetId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/template-settings', async (_req, res) => {
  try {
    res.json({ settings: await loadTemplateSettings(), defaults: getDefaultTemplateSettings() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/template-settings', async (req, res) => {
  try {
    const { subjectTemplate, bodyTemplate } = req.body || {};
    const settings = await saveTemplateSettings({
      subjectTemplate: String(subjectTemplate || ''),
      bodyTemplate: String(bodyTemplate || ''),
    });
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/template-settings/reset', async (_req, res) => {
  try {
    const settings = await saveTemplateSettings(getDefaultTemplateSettings());
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/auth/disconnect', async (_req, res) => {
  try {
    await clearSavedTokens();
    res.json({ ok: true, connected: false });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.use((_req, res) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  res.sendFile(indexPath, (error) => {
    if (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode || 404;
      res.status(statusCode).send('Not found');
    }
  });
});

app.listen(port, () => {
  console.log(`Cohesive Canine Assistant listening on http://localhost:${port}`);
});
