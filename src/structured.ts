import { docs_v1, sheets_v4 } from 'googleapis';
import { COLUMN_NAMES, YELLOW_RGB } from './config';
import { columnToLetter, ensureCustomTrackingColumns, loadRows } from './sheets';
import { RunResult } from './types';

const STRUCTURED_STATUS_COLUMN = 'Structured Status';
const STRUCTURED_DOC_URL_COLUMN = 'Structured Doc URL';

export async function runStructuredBoardTool(
  sheets: sheets_v4.Sheets,
  docs: docs_v1.Docs,
  spreadsheetId: string
): Promise<RunResult> {
  const preview = await loadRows(sheets, spreadsheetId, {
    requireEmail: false,
    trackingColumns: {
      status: STRUCTURED_STATUS_COLUMN,
      docUrl: STRUCTURED_DOC_URL_COLUMN,
    },
  });

  const trackingColumns = await ensureCustomTrackingColumns(sheets, spreadsheetId, preview.title, [
    STRUCTURED_STATUS_COLUMN,
    STRUCTURED_DOC_URL_COLUMN,
  ]);

  const now = new Date();
  const docTitle = `STRUCTURED BOARD - ${now.toISOString().replace(/[:T]/g, '-').slice(0, 16)}`;
  const completedStatus = `Structured Print Created ${now.toISOString().slice(0, 10)}`;

  const processed: RunResult['processed'] = [];
  const skipped = [...preview.skipped];
  const sections: string[] = [];

  for (const row of preview.rows) {
    try {
      sections.push(buildStructuredSection(row));
      processed.push({
        rowNumber: row.rowNumber,
        dogName: row.dogName || 'Unknown',
        email: row.email || '',
        status: completedStatus,
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

  if (sections.length > 0) {
    const doc = await docs.documents.create({ requestBody: { title: docTitle } });
    printDocId = doc.data.documentId || undefined;
    if (!printDocId) throw new Error('Failed to create structured board document');

    await docs.documents.batchUpdate({
      documentId: printDocId,
      requestBody: {
        requests: [
          {
            insertText: {
              endOfSegmentLocation: {},
              text: sections.join('\n'),
            },
          },
        ],
      },
    });

    printDocUrl = `https://docs.google.com/document/d/${printDocId}/edit`;

    for (const item of processed) {
      item.printDocUrl = printDocUrl;
      await writeStructuredTrackingValues(
        sheets,
        spreadsheetId,
        preview.title,
        item.rowNumber,
        trackingColumns,
        completedStatus,
        printDocUrl
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

function buildStructuredSection(row: { [key: string]: string | number | undefined }): string {
  return [
    `Dog Name: ${row.dogName || 'N/A'}`,
    `Client Name: ${row.clientName || 'N/A'}`,
    `Check In: ${joinDateTime(asString(row.checkInDate), asString(row.checkInTime)) || 'N/A'}`,
    `Check Out: ${joinDateTime(asString(row.checkOutDate), asString(row.checkOutTime)) || 'N/A'}`,
    `Breed: ${row.dogBreed || 'N/A'}`,
    `Age: ${row.dogAge || 'N/A'}`,
    `Goals: ${row.goals || 'N/A'}`,
    `Top Issues: ${row.issues || 'N/A'}`,
    '',
  ].join('\n');
}

function asString(value: string | number | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function joinDateTime(date?: string, time?: string): string | undefined {
  const parts = [date?.trim(), time?.trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

async function writeStructuredTrackingValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  rowNumber: number,
  trackingColumns: Record<string, number>,
  status: string,
  docUrl: string
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

  const updates = [
    { colIndex: trackingColumns[STRUCTURED_STATUS_COLUMN], value: status },
    { colIndex: trackingColumns[STRUCTURED_DOC_URL_COLUMN], value: docUrl },
  ].filter((item) => item.colIndex);

  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!${columnToLetter(update.colIndex)}${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[update.value]] },
    });
  }

  const requests = [];

  if (trackingColumns[STRUCTURED_STATUS_COLUMN]) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: trackingColumns[STRUCTURED_STATUS_COLUMN] - 1,
          endColumnIndex: trackingColumns[STRUCTURED_STATUS_COLUMN],
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
