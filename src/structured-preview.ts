import { sheets_v4 } from 'googleapis';
import { loadRows } from './sheets';
import { DogRow, PreviewResult } from './types';

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
