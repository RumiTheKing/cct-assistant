import { sheets_v4 } from 'googleapis';
import { COLUMN_NAMES } from './config';
import { DogRow, PreviewResult, SheetHeaderInfo } from './types';

export type LoadRowsOptions = {
  requireEmail?: boolean;
  trackingColumns?: {
    status?: string;
    draftId?: string;
    docUrl?: string;
  };
};

export function extractSpreadsheetId(sheetUrlOrId: string): string {
  const match = sheetUrlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || sheetUrlOrId.trim();
}

export async function getSheetHeaderInfo(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SheetHeaderInfo> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!1:1`,
  });

  const header = res.data.values?.[0] || [];
  return { sheetTitle, header };
}

export async function loadRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  options: LoadRowsOptions = {}
): Promise<PreviewResult> {
  const { sheetTitle, header } = await getSheetHeaderInfo(sheets, spreadsheetId);

  if (!header.length) {
    return { title: sheetTitle, rows: [], skipped: [] };
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!A:${columnToLetter(header.length)}`,
  });

  const values = res.data.values || [];
  if (!values.length) {
    return { title: sheetTitle, rows: [], skipped: [] };
  }

  const headerIndex = new Map(header.map((name, i) => [normalizeHeaderName(name), i]));
  const rows: DogRow[] = [];
  const skipped: Array<{ rowNumber: number; reason: string }> = [];
  const statusColumn = options.trackingColumns?.status || COLUMN_NAMES.status;
  const draftIdColumn = options.trackingColumns?.draftId || COLUMN_NAMES.draftId;
  const docUrlColumn = options.trackingColumns?.docUrl || COLUMN_NAMES.printDocUrl;
  const requireEmail = options.requireEmail ?? true;

  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    const rowNumber = i + 1;
    const row: DogRow = {
      rowNumber,
      paid: pick(raw, headerIndex, COLUMN_NAMES.paid),
      timestamp: pick(raw, headerIndex, COLUMN_NAMES.timestamp),
      email: pick(raw, headerIndex, COLUMN_NAMES.email),
      clientName: pick(raw, headerIndex, COLUMN_NAMES.clientName),
      checkInDate: pick(raw, headerIndex, COLUMN_NAMES.checkInDate),
      checkInTime: pick(raw, headerIndex, COLUMN_NAMES.checkInTime),
      checkOutDate: pick(raw, headerIndex, COLUMN_NAMES.checkOutDate),
      checkOutTime: pick(raw, headerIndex, COLUMN_NAMES.checkOutTime),
      dogName: pick(raw, headerIndex, COLUMN_NAMES.dogName),
      dogAge: pick(raw, headerIndex, COLUMN_NAMES.dogAge),
      dogBreed: pick(raw, headerIndex, COLUMN_NAMES.dogBreed),
      goals: pick(raw, headerIndex, COLUMN_NAMES.goals),
      issues: pick(raw, headerIndex, COLUMN_NAMES.issues),
      confirmedDates: pick(raw, headerIndex, COLUMN_NAMES.confirmedDates),
      emergencyContact: pick(raw, headerIndex, COLUMN_NAMES.emergencyContact),
      feedingSchedule: pick(raw, headerIndex, COLUMN_NAMES.feedingSchedule),
      mealsPacked: pick(raw, headerIndex, COLUMN_NAMES.mealsPacked),
      alteredStatus: pick(raw, headerIndex, COLUMN_NAMES.alteredStatus),
      heatCyclePlan: pick(raw, headerIndex, COLUMN_NAMES.heatCyclePlan),
      bathRequest: pick(raw, headerIndex, COLUMN_NAMES.bathRequest),
      shampooAllergies: pick(raw, headerIndex, COLUMN_NAMES.shampooAllergies),
      dogWeight: pick(raw, headerIndex, COLUMN_NAMES.dogWeight),
      rabiesStatus: pick(raw, headerIndex, COLUMN_NAMES.rabiesStatus),
      dogReadiness: pick(raw, headerIndex, COLUMN_NAMES.dogReadiness),
      optionalAdventures: pick(raw, headerIndex, COLUMN_NAMES.optionalAdventures),
      etaAgreement: pick(raw, headerIndex, COLUMN_NAMES.etaAgreement),
      extraNotes: pick(raw, headerIndex, COLUMN_NAMES.extraNotes),
      trainingDetails: pick(raw, headerIndex, COLUMN_NAMES.trainingDetails),
      status: pick(raw, headerIndex, statusColumn),
      draftId: pick(raw, headerIndex, draftIdColumn),
      printDocUrl: pick(raw, headerIndex, docUrlColumn),
    };

    if (requireEmail && !row.email?.trim()) {
      skipped.push({ rowNumber, reason: 'Missing email address' });
      continue;
    }
    if (!row.dogName?.trim()) {
      skipped.push({ rowNumber, reason: 'Missing dog name' });
      continue;
    }
    if (row.status?.trim()) {
      skipped.push({ rowNumber, reason: `Already completed: ${row.status.trim()}` });
      continue;
    }
    if (row.draftId?.trim()) {
      skipped.push({ rowNumber, reason: `Duplicate protected: existing draft ID ${row.draftId.trim()}` });
      continue;
    }
    if (row.printDocUrl?.trim()) {
      skipped.push({ rowNumber, reason: 'Duplicate protected: existing PRINT doc URL' });
      continue;
    }
    rows.push(row);
  }

  return { title: sheetTitle, rows, skipped };
}

export async function ensureTrackingColumns(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string
): Promise<Record<string, number>> {
  return ensureCustomTrackingColumns(sheets, spreadsheetId, sheetTitle, [
    COLUMN_NAMES.status,
    COLUMN_NAMES.draftId,
    COLUMN_NAMES.printDocUrl,
  ]);
}

export async function ensureCustomTrackingColumns(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  neededColumns: string[]
): Promise<Record<string, number>> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  const sheetId = sheet?.properties?.sheetId;
  let gridColumnCount = sheet?.properties?.gridProperties?.columnCount || 0;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!1:1`,
  });
  const header = [...(res.data.values?.[0] || [])];

  const indexes: Record<string, number> = {};

  for (const columnName of neededColumns) {
    let existingIndex = header.indexOf(columnName);
    if (existingIndex >= 0) {
      indexes[columnName] = existingIndex + 1;
      continue;
    }

    const nextCol = header.length + 1;

    if (sheetId !== undefined && nextCol > gridColumnCount) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              appendDimension: {
                sheetId,
                dimension: 'COLUMNS',
                length: nextCol - gridColumnCount,
              },
            },
          ],
        },
      });
      gridColumnCount = nextCol;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!${columnToLetter(nextCol)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[columnName]] },
    });

    header.push(columnName);
    indexes[columnName] = nextCol;
  }

  return indexes;
}

function pick(row: string[], headerIndex: Map<string, number>, name: string): string | undefined {
  const idx = headerIndex.get(normalizeHeaderName(name));
  return idx === undefined ? undefined : row[idx];
}

function normalizeHeaderName(value: string | undefined): string {
  return (value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

function columnToLetter(col: number): string {
  let temp = col;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

export { columnToLetter };
