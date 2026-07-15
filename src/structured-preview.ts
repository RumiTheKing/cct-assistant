import { sheets_v4 } from 'googleapis';
import { parseSheetTimeHour } from './time';
import { loadRows } from './sheets';
import { DogRow, PreviewResult } from './types';

const STRUCTURED_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',
  '2026-07-24',
  '2026-09-07',
  '2026-10-12',
  '2026-11-11',
  '2026-11-26',
  '2026-12-25',
]);

export async function loadStructuredPreview(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<PreviewResult> {
  const preview = await loadRows(sheets, spreadsheetId, {
    requireEmail: false,
    trackingColumns: {
      status: 'Structured Status',
      docUrl: 'Structured Doc URL',
    },
  });

  const warnings = {
    multiDogRows: [] as Array<{ rowNumber: number; dogName: string; reason: string }>,
    trainingRows: [] as Array<{ rowNumber: number; dogName: string; detail: string }>,
  };
  const previewSkipped = [...preview.skipped];
  const readyRows: DogRow[] = [];

  for (const row of preview.rows) {
    const dogName = row.dogName?.trim() || '';
    const multiDogDetected = /,|&|\/|\band\b/i.test(dogName);
    const optionalText = (row.optionalAdventures || '').toLowerCase();
    const trainingDetail = (row.trainingDetails || '').trim();
    const trainingSelected = optionalText.includes('training') || Boolean(trainingDetail);
    const holidayDays = getHolidayDays(row);

    row.structuredPreview = {
      holidayDetected: holidayDays > 0,
      holidayDaysLabel: holidayDays > 0 ? formatHolidayDaysLabel(holidayDays) : 'No holiday detected',
    };

    if (multiDogDetected) {
      warnings.multiDogRows.push({
        rowNumber: row.rowNumber,
        dogName: row.dogName?.trim() || 'Unknown',
        reason: 'Multiple dogs detected in one row, will be marked for manual review',
      });
    }

    readyRows.push(row);

    if (trainingSelected) {
      warnings.trainingRows.push({
        rowNumber: row.rowNumber,
        dogName: row.dogName?.trim() || 'Unknown',
        detail: trainingDetail || 'Training selected',
      });
    }
  }

  return {
    ...preview,
    rows: readyRows,
    skipped: previewSkipped,
    warnings,
  };
}

function getHolidayDays(row: DogRow): number {
  const checkInDate = parseSheetDate(row.checkInDate);
  const checkOutDate = parseSheetDate(row.checkOutDate);
  const checkInHour = parseSheetTimeHour(row.checkInTime);
  const checkOutHour = parseSheetTimeHour(row.checkOutTime);

  if (!checkInDate || !checkOutDate) return 0;

  const days: Date[] = [];
  const cursor = new Date(checkInDate.getTime());
  while (cursor <= checkOutDate) {
    days.push(new Date(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }

  let holidayDays = 0;

  for (let i = 0; i < days.length; i++) {
    const current = days[i];
    let billedDays = 1;

    if (i === 0 && checkInHour !== null && checkInHour >= 15) {
      billedDays = 0.5;
    }
    if (i === days.length - 1 && checkOutHour !== null && checkOutHour < 12) {
      billedDays = Math.min(billedDays, 0.5);
    }

    if (STRUCTURED_HOLIDAYS.has(toIsoDate(current))) {
      holidayDays += billedDays;
    }
  }

  return holidayDays;
}

function formatHolidayDaysLabel(value: number): string {
  return Number.isInteger(value)
    ? `${value} holiday day${value === 1 ? '' : 's'} detected`
    : `${value.toFixed(1)} holiday days detected`;
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

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}
