import { DogRow } from './types';
import { loadTemplateSettings, renderTemplate } from './template-settings';

export async function buildEmailSubject(row: DogRow): Promise<string> {
  const settings = await loadTemplateSettings();
  return renderTemplate(settings.subjectTemplate, row) || 'Dog Board and Train Info';
}

export async function buildEmailBody(row: DogRow): Promise<string> {
  const settings = await loadTemplateSettings();
  return renderTemplate(settings.bodyTemplate, row);
}

export function buildPrintSection(row: DogRow): string {
  const dogAge = row.dogAge?.trim() || findFallbackValue(row, ['dog age', "dog's age", 'your dogs age', 'how old is your dog?', 'pup age']) || 'N/A';

  return [
    `Dog Name: ${row.dogName?.trim() || 'N/A'}`,
    `Breed: ${row.dogBreed?.trim() || 'N/A'}`,
    `Age: ${dogAge}`,
    `Goals: ${row.goals?.trim() || 'N/A'}`,
    `Issues: ${row.issues?.trim() || 'N/A'}`,
    '',
  ].join('\n');
}

function findFallbackValue(row: DogRow, headerHints: string[]): string | undefined {
  const headers = row.headerValues || [];
  const values = row.rawValues || [];

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim().toLowerCase();
    if (!headerHints.some((hint) => header.includes(hint))) continue;
    const value = String(values[i] || '').trim();
    if (value) return value;
  }

  return undefined;
}
