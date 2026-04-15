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
  return [
    `Dog Name: ${row.dogName?.trim() || 'N/A'}`,
    `Breed: ${row.dogBreed?.trim() || 'N/A'}`,
    `Age: ${row.dogAge?.trim() || 'N/A'}`,
    `Goals: ${row.goals?.trim() || 'N/A'}`,
    `Issues: ${row.issues?.trim() || 'N/A'}`,
    '',
  ].join('\n');
}
