import { docs_v1, sheets_v4 } from 'googleapis';
import { COLUMN_NAMES, ORANGE_RGB, RED_RGB, WHITE_RGB, YELLOW_RGB } from './config';
import { columnToLetter, ensureCustomTrackingColumns, loadRows } from './sheets';
import { DogRow, RunResult } from './types';

const STRUCTURED_STATUS_COLUMN = 'Structured Status';
const STRUCTURED_DOC_URL_COLUMN = 'Structured Doc URL';
const US_BANK_HOLIDAYS = [
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',
  '2026-09-07',
  '2026-10-12',
  '2026-11-11',
  '2026-11-26',
  '2026-12-25',
];

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
  const docTitle = `SB TEXT DOCUMENT - ${now.toISOString().replace(/[:T]/g, '-').slice(0, 16)}`;
  const completedStatus = `Text Document Created ${now.toISOString().slice(0, 10)}`;

  const processed: RunResult['processed'] = [];
  const skipped = [...preview.skipped];
  const sections: string[] = [];
  const sectionTexts: string[] = [];
  const warnings = {
    multiDogRows: [...(preview.warnings?.multiDogRows || [])],
    trainingRows: [...(preview.warnings?.trainingRows || [])],
  };

  for (const row of preview.rows) {
    try {
      const analysis = analyzeStructuredRow(row);

      if (analysis.trainingSelected) {
        warnings.trainingRows.push({
          rowNumber: row.rowNumber,
          dogName: row.dogName?.trim() || 'Unknown',
          detail: analysis.trainingDetail,
        });
        await flagWholeRow(sheets, spreadsheetId, preview.title, row.rowNumber, ORANGE_RGB);
        await flagNamedCell(
          sheets,
          spreadsheetId,
          preview.title,
          row.rowNumber,
          COLUMN_NAMES.optionalAdventures,
          RED_RGB,
          WHITE_RGB
        );
      }

      if (analysis.multiDogDetected) {
        warnings.multiDogRows.push({
          rowNumber: row.rowNumber,
          dogName: row.dogName?.trim() || 'Unknown',
          reason: 'Multiple dogs detected in one row',
        });
        await flagNamedCell(
          sheets,
          spreadsheetId,
          preview.title,
          row.rowNumber,
          COLUMN_NAMES.dogName,
          RED_RGB,
          WHITE_RGB
        );
        skipped.push({ rowNumber: row.rowNumber, reason: 'Multiple dogs detected in one row' });
        continue;
      }

      const sectionText = buildStructuredSection(row, analysis);
      sections.push(sectionText);
      sectionTexts.push(sectionText);
      processed.push({
        rowNumber: row.rowNumber,
        dogName: row.dogName || 'Unknown',
        email: row.email || '',
        status: completedStatus,
        totalInvoice: analysis.totalInvoice,
        addOnsSummary: analysis.addOnsSummary,
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
    if (!printDocId) throw new Error('Failed to create text document');

    const requests: docs_v1.Schema$Request[] = [];
    let fullText = '';

    for (let i = 0; i < sectionTexts.length; i++) {
      const sectionText = sectionTexts[i];
      requests.push({
        insertText: {
          endOfSegmentLocation: {},
          text: sectionText,
        },
      });
      fullText += sectionText;

      if (i < sectionTexts.length - 1) {
        requests.push({
          insertPageBreak: {
            endOfSegmentLocation: {},
          },
        });
        fullText += '\n';
      }
    }

    requests.push(...buildTextDocumentStyleRequests(fullText));

    await docs.documents.batchUpdate({
      documentId: printDocId,
      requestBody: {
        requests,
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
    warnings,
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

type StructuredAnalysis = {
  totalCalendarDays: number;
  holidayChargeApplied: boolean;
  baseCharge: number;
  addOnsCharge: number;
  totalInvoice: number;
  addOnsSummary: string;
  multiDogDetected: boolean;
  trainingSelected: boolean;
  trainingDetail: string;
};

function analyzeStructuredRow(row: DogRow): StructuredAnalysis {
  const dogName = row.dogName?.trim() || '';
  const multiDogDetected = /,|&|\/|\band\b/i.test(dogName);
  const calendarCharges = calculateCalendarCharges(row);
  const optionalText = (row.optionalAdventures || '').toLowerCase();
  const bathRequest = (row.bathRequest || '').toLowerCase();
  const trainingDetail = (row.trainingDetails || '').trim();
  const trainingSelected = optionalText.includes('training') || Boolean(trainingDetail);

  const addOns: string[] = [];
  let addOnsCharge = 0;

  if (optionalText.includes('hike')) {
    addOns.push('Hike ($100)');
    addOnsCharge += 100;
  }
  if (optionalText.includes('field trip')) {
    addOns.push('Field Trip ($50)');
    addOnsCharge += 50;
  }
  if (optionalText.includes('dock diving')) {
    addOns.push('Dock Diving ($65)');
    addOnsCharge += 65;
  }
  if (trainingSelected) {
    addOns.push('Training selected, review manually');
  }

  const stayDays = calendarCharges.totalCalendarDays;
  const weight = Number.parseFloat((row.dogWeight || '').trim());
  const bathIncluded = stayDays >= 10 || optionalText.includes('hike') || bathRequest.includes('included');
  const bathRequested = bathRequest.includes('yes');

  if (bathIncluded) {
    addOns.push('Bath included ($0)');
  } else if (bathRequested) {
    const bathCharge = !Number.isNaN(weight) && weight < 30 ? 35 : 50;
    addOns.push(`Bath ($${bathCharge})`);
    addOnsCharge += bathCharge;
  }

  return {
    totalCalendarDays: calendarCharges.totalCalendarDays,
    holidayChargeApplied: calendarCharges.holidayChargeApplied,
    baseCharge: calendarCharges.totalCharge,
    addOnsCharge,
    totalInvoice: calendarCharges.totalCharge + addOnsCharge,
    addOnsSummary: addOns.length ? addOns.join(', ') : 'None',
    multiDogDetected,
    trainingSelected,
    trainingDetail: trainingDetail || 'Training selected',
  };
}

function calculateCalendarCharges(row: DogRow) {
  const checkInDate = parseSheetDate(row.checkInDate);
  const checkOutDate = parseSheetDate(row.checkOutDate);
  const checkInHour = parseSheetTimeHour(row.checkInTime);
  const checkOutHour = parseSheetTimeHour(row.checkOutTime);

  if (!checkInDate || !checkOutDate) {
    return { totalCalendarDays: 0, totalCharge: 0, holidayChargeApplied: false };
  }

  const days: Date[] = [];
  const cursor = new Date(checkInDate.getTime());
  while (cursor <= checkOutDate) {
    days.push(new Date(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }

  let totalCharge = 0;
  let holidayChargeApplied = false;

  for (let i = 0; i < days.length; i++) {
    const current = days[i];
    let dayCharge = 80;

    if (i === 0 && checkInHour !== null && checkInHour >= 15) {
      dayCharge = 40;
    }
    if (i === days.length - 1 && checkOutHour !== null && checkOutHour < 12) {
      dayCharge = Math.min(dayCharge, 40);
    }

    const iso = toIsoDate(current);
    if (US_BANK_HOLIDAYS.includes(iso)) {
      dayCharge *= 2;
      holidayChargeApplied = true;
    }

    totalCharge += dayCharge;
  }

  return {
    totalCalendarDays: days.length,
    totalCharge,
    holidayChargeApplied,
  };
}

function buildStructuredSection(row: DogRow, analysis: StructuredAnalysis): string {
  const dogName = row.dogName?.trim() || 'Dog';
  return [
    `${dogName} BOARD INFO!`,
    '',
    `Check in: ${joinDateTime(formatSheetDate(row.checkInDate), formatSheetTime(row.checkInTime)) || 'N/A'}`,
    `Check out: ${joinDateTime(formatSheetDate(row.checkOutDate), formatSheetTime(row.checkOutTime)) || 'N/A'}`,
    '',
    "Please text me when you're on your way! For safety, all dogs need to be secured before you arrive, so if you're running early or late, please let me know. Exact ETAs are super helpful! (Example: \"Arriving at 8:04pm!\")",
    '',
    'We treat all check-in/check-out times like appointments, so please be on time. If you\'re running late, we require at least 30 minutes’ notice, otherwise, a $25 fee will apply.',
    '',
    'My address is: 14719 S Oak Point Dr Bluffdale, UT 84065',
    'Please pack - Ecollar, remote, flat collar with ID & food packed per meal/day',
    '',
    'Total Calendar Days:',
    `${analysis.totalCalendarDays}`,
    'Add-ons:',
    analysis.addOnsSummary,
    `Holiday (y/n): ${analysis.holidayChargeApplied ? 'y' : 'n'}`,
    'Total Invoice:',
    `$${analysis.totalInvoice}`,
    '',
    'Please send full payment 1+ day before check in. :)',
    '10% cancellation fee if cancelled with less than 7 day notice',
    'Let me know if you have any questions!',
    'Here’s my venmo -',
    '',
  ].join('\n');
}

function buildTextDocumentStyleRequests(fullText: string): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];
  const boldTargets = [
    'Please text me when you\'re on your way!',
    'My address is: 14719 S Oak Point Dr Bluffdale, UT 84065',
    'Please send full payment 1+ day before check in. :)',
    'Check in:',
    'Check out:',
    'Total Calendar Days:',
    'Add-ons:',
    'Holiday (y/n):',
    'Total Invoice:',
  ];

  const titleRegex = /^.* BOARD INFO!$/gm;
  let titleMatch: RegExpExecArray | null;
  while ((titleMatch = titleRegex.exec(fullText)) !== null) {
    requests.push(makeBoldRequest(titleMatch.index, titleMatch.index + titleMatch[0].length, true, 14));
  }

  for (const target of boldTargets) {
    let fromIndex = 0;
    while (fromIndex < fullText.length) {
      const foundAt = fullText.indexOf(target, fromIndex);
      if (foundAt === -1) break;
      requests.push(makeBoldRequest(foundAt, foundAt + target.length));
      fromIndex = foundAt + target.length;
    }
  }

  return requests;
}

function makeBoldRequest(start: number, end: number, title = false, fontSize = 11): docs_v1.Schema$Request {
  return {
    updateTextStyle: {
      range: {
        startIndex: start + 1,
        endIndex: end + 1,
      },
      textStyle: {
        bold: true,
        weightedFontFamily: { fontFamily: 'Arial' },
        fontSize: { magnitude: fontSize, unit: 'PT' },
      },
      fields: title
        ? 'bold,weightedFontFamily,fontSize'
        : 'bold,weightedFontFamily,fontSize',
    },
  };
}

function parseSheetDate(value?: string): Date | null {
  if (!value?.trim()) return null;
  const raw = value.trim();

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = serial * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + millis);
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseSheetTimeHour(value?: string): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    if (numeric >= 0 && numeric < 1) return numeric * 24;
    return numeric;
  }

  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minutes = Number(match[2] || '0');
  const meridiem = (match[3] || '').toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return hour + minutes / 60;
}

function formatSheetDate(value?: string): string | undefined {
  const date = parseSheetDate(value);
  if (!date) return value?.trim() || undefined;
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatSheetTime(value?: string): string | undefined {
  const hour = parseSheetTimeHour(value);
  if (hour === null) return value?.trim() || undefined;
  const wholeHour = Math.floor(hour);
  const minutes = Math.round((hour - wholeHour) * 60);
  const suffix = wholeHour >= 12 ? 'PM' : 'AM';
  let displayHour = wholeHour % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function joinDateTime(date?: string, time?: string): string | undefined {
  const parts = [date?.trim(), time?.trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
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

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }
}

async function flagWholeRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  rowNumber: number,
  backgroundColor: { red: number; green: number; blue: number }
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  const sheetId = sheet?.properties?.sheetId;
  const columnCount = sheet?.properties?.gridProperties?.columnCount || 0;
  if (sheetId === undefined || columnCount <= 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 0,
              endColumnIndex: columnCount,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor,
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });
}

async function flagNamedCell(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  rowNumber: number,
  columnName: string,
  backgroundColor: { red: number; green: number; blue: number },
  foregroundColor?: { red: number; green: number; blue: number }
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
  const colIndex = header.indexOf(columnName) + 1;
  if (colIndex <= 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: colIndex - 1,
              endColumnIndex: colIndex,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor,
                textFormat: foregroundColor
                  ? {
                      foregroundColor,
                      bold: true,
                    }
                  : undefined,
              },
            },
            fields: foregroundColor
              ? 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold'
              : 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });
}
