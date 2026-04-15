import { docs_v1, drive_v3, gmail_v1, sheets_v4 } from 'googleapis';
import { COLUMN_NAMES, YELLOW_RGB } from './config';
import { columnToLetter, ensureTrackingColumns, loadRows } from './sheets';
import { buildEmailBody, buildEmailSubject, buildPrintSection } from './templates';
import { RunResult } from './types';

export async function runDraftAndPrint(
  sheets: sheets_v4.Sheets,
  gmail: gmail_v1.Gmail,
  docs: docs_v1.Docs,
  drive: drive_v3.Drive,
  spreadsheetId: string
): Promise<RunResult> {
  const preview = await loadRows(sheets, spreadsheetId);
  const trackingColumns = await ensureTrackingColumns(sheets, spreadsheetId, preview.title);
  const statusColIndex = trackingColumns[COLUMN_NAMES.status];

  const now = new Date();
  const docTitle = `PRINT - ${now.toISOString().replace(/[:T]/g, '-').slice(0, 16)}`;
  const draftedStatus = `Drafted ${now.toISOString().slice(0, 10)}`;

  const processed: RunResult['processed'] = [];
  const skipped = [...preview.skipped];
  const printSections: string[] = [];

  for (const row of preview.rows) {
    try {
      const subject = await buildEmailSubject(row);
      const body = await buildEmailBody(row);

      const rawMessage = [
        `To: ${row.email}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        '',
        body,
      ].join('\n');

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const draft = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: { message: { raw: encodedMessage } },
      });

      printSections.push(buildPrintSection(row));

      processed.push({
        rowNumber: row.rowNumber,
        dogName: row.dogName || 'Unknown',
        email: row.email || '',
        draftId: draft.data.id || undefined,
        status: draftedStatus,
      });
    } catch (error) {
      skipped.push({
        rowNumber: row.rowNumber,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  let printDocId: string | undefined;
  let printDocUrl: string | undefined;

  if (printSections.length > 0) {
    const doc = await docs.documents.create({ requestBody: { title: docTitle } });
    printDocId = doc.data.documentId || undefined;
    if (!printDocId) throw new Error('Failed to create print document');

    const fullText = printSections.join('\n');

    await docs.documents.batchUpdate({
      documentId: printDocId,
      requestBody: {
        requests: [
          {
            insertText: {
              endOfSegmentLocation: {},
              text: fullText,
            },
          },
        ],
      },
    });

    printDocUrl = `https://docs.google.com/document/d/${printDocId}/edit`;

    for (const item of processed) {
      item.printDocUrl = printDocUrl;
      await writeTrackingValues(
        sheets,
        spreadsheetId,
        preview.title,
        item.rowNumber,
        trackingColumns,
        {
          status: item.status,
          draftId: item.draftId,
          printDocUrl,
        }
      );
    }
  } else {
    for (const item of processed) {
      await writeTrackingValues(
        sheets,
        spreadsheetId,
        preview.title,
        item.rowNumber,
        trackingColumns,
        {
          status: item.status,
          draftId: item.draftId,
        }
      );
    }
  }

  return {
    printDocTitle: printDocId ? docTitle : undefined,
    printDocId,
    printDocUrl,
    processed,
    skipped,
    summary: {
      processedCount: processed.length,
      skippedCount: skipped.length,
      alreadyCompletedCount: skipped.filter((item) =>
        item.reason.startsWith('Already completed:')
      ).length,
      duplicateProtectedCount: skipped.filter((item) =>
        item.reason.startsWith('Duplicate protected:')
      ).length,
    },
  };
}

async function writeTrackingValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  rowNumber: number,
  trackingColumns: Record<string, number>,
  values: { status?: string; draftId?: string; printDocUrl?: string }
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined) return;

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!1:1`,
  });
  const header = headerRes.data.values?.[0] || [];
  const emailColIndex = header.indexOf(COLUMN_NAMES.email) + 1;

  const updates: Array<{ colIndex: number; value: string }> = [];
  if (values.status && trackingColumns[COLUMN_NAMES.status]) {
    updates.push({ colIndex: trackingColumns[COLUMN_NAMES.status], value: values.status });
  }
  if (values.draftId && trackingColumns[COLUMN_NAMES.draftId]) {
    updates.push({ colIndex: trackingColumns[COLUMN_NAMES.draftId], value: values.draftId });
  }
  if (values.printDocUrl && trackingColumns[COLUMN_NAMES.printDocUrl]) {
    updates.push({ colIndex: trackingColumns[COLUMN_NAMES.printDocUrl], value: values.printDocUrl });
  }

  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!${columnToLetter(update.colIndex)}${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[update.value]] },
    });
  }

  const requests = [];

  if (trackingColumns[COLUMN_NAMES.status]) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: trackingColumns[COLUMN_NAMES.status] - 1,
          endColumnIndex: trackingColumns[COLUMN_NAMES.status],
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: YELLOW_RGB,
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  if (emailColIndex > 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: emailColIndex - 1,
          endColumnIndex: emailColIndex,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: YELLOW_RGB,
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    });
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}
