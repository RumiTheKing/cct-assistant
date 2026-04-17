import fs from 'fs/promises';
import path from 'path';
import { DogRow } from './types';

export type TemplateSettings = {
  subjectTemplate: string;
  bodyTemplate: string;
};

export type StructuredTemplateSettings = {
  bodyTemplate: string;
  fullDayPrice: number;
  halfDayPrice: number;
};

const SETTINGS_DIR = path.join(process.cwd(), 'state');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'template-settings.json');
const STRUCTURED_SETTINGS_PATH = path.join(SETTINGS_DIR, 'structured-template-settings.json');

const DEFAULT_SETTINGS: TemplateSettings = {
  subjectTemplate: '{{dogName}} Board and Train Info',
  bodyTemplate: [
    '<p>I can’t wait to have {{dogName}}!</p>',
    '<p><strong>Check in: {{checkIn}}.</strong> This takes 5-10 minutes typically!</p>',
    '<p><strong>Check out: {{checkOut}}.</strong> Please plan on {{recapMinutes}} minutes for a recap of everything we work on!</p>',
    '<p>*Let us know if you\'re running early OR late, it\'s important that all other dogs are put away prior to your arrival.</p>',
    '<p><strong>Text me when you arrive and I’ll come out and help with any items :)</strong> 385-214-9853</p>',
    '<p><strong>My address is: 14719 S Oak Point Dr Bluffdale, UT 84065</strong></p>',
    '<p>Here’s a virtual tour of where your dog will be staying! - <a href="https://drive.google.com/file/d/1q9gt9CoXtwfjPe46QBZgb_o8HLtdJ7pm/view?usp=drivesdk">https://drive.google.com/file/d/1q9gt9CoXtwfjPe46QBZgb_o8HLtdJ7pm/view?usp=drivesdk</a></p>',
    '<p>Packing list:</p>',
    '<ul><li>Collar with ID</li><li>Food individually packed per meal OR per day</li><li>Leash on at drop off</li><li>Ecollar and Remote (I do NOT need the charger)</li><li>Anything else your pup just can’t live without!</li></ul>',
    '<p>We have dog beds, toys, treats, crates, leashes, poop bags, etc. Please only bring an item if it\'s crucial to their happiness in my home.</p>',
    '<p><strong>Before check in:</strong></p>',
    '<ul><li>Please fill out the health assessment and the board agreement. Those will come as a separate email from adobe acrobat.</li><li>Please pay the full amount at or before check in. Cash, Zelle or venmo accepted. My Venmo is <a href="https://venmo.com/u/cohesivecanine">https://venmo.com/u/cohesivecanine</a></li></ul>',
    '<p>From Assessment:</p>',
    '<p>Name, age and breed - {{dogSummary}}</p>',
    '<p>Top three issues - {{issues}}</p>',
    '<p>Goals - {{goals}}</p>',
    '<p>Let me know if you have any questions at all! Thanks!</p>',
  ].join(''),
};

const DEFAULT_STRUCTURED_SETTINGS: StructuredTemplateSettings = {
  bodyTemplate: [
    '{{dogName}} BOARD INFO!',
    '',
    'Check in: {{checkIn}}',
    'Check out: {{checkOut}}',
    '',
    'Please text me when you\'re on your way! For safety, all dogs need to be secured before you arrive, so if you\'re running early or late, please let me know. Exact ETAs are super helpful! (Example: "Arriving at 8:04pm!")',
    '',
    'We treat all check-in/check-out times like appointments, so please be on time. If you\'re running late, we require at least 30 minutes’ notice, otherwise, a $25 fee will apply.',
    '',
    'My address is: 14719 S Oak Point Dr Bluffdale, UT 84065',
    'Please pack - Ecollar, remote, flat collar with ID & food packed per meal/day',
    '',
    'Total Calendar Days Billed: {{totalCalendarDays}}',
    '{{addOnsLine}}',
    'Holiday Days Charged: {{holidayDaysCharged}}',
    '',
    'Total Invoice: {{totalInvoice}}',
    '',
    'Please send full payment 1+ day before check in. :)',
    '10% cancellation fee if cancelled with less than 7 day notice',
    'Let me know if you have any questions!',
    'Here’s my venmo - {{venmoUrl}}',
    '',
  ].join('\n'),
  fullDayPrice: 80,
  halfDayPrice: 40,
};

export async function loadTemplateSettings(): Promise<TemplateSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TemplateSettings>;
    return {
      subjectTemplate: parsed.subjectTemplate || DEFAULT_SETTINGS.subjectTemplate,
      bodyTemplate: parsed.bodyTemplate || DEFAULT_SETTINGS.bodyTemplate,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveTemplateSettings(settings: TemplateSettings): Promise<TemplateSettings> {
  const next: TemplateSettings = {
    subjectTemplate: settings.subjectTemplate || DEFAULT_SETTINGS.subjectTemplate,
    bodyTemplate: settings.bodyTemplate || DEFAULT_SETTINGS.bodyTemplate,
  };

  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function getDefaultTemplateSettings(): TemplateSettings {
  return { ...DEFAULT_SETTINGS };
}

export async function loadStructuredTemplateSettings(): Promise<StructuredTemplateSettings> {
  try {
    const raw = await fs.readFile(STRUCTURED_SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StructuredTemplateSettings>;
    return {
      bodyTemplate: parsed.bodyTemplate || DEFAULT_STRUCTURED_SETTINGS.bodyTemplate,
      fullDayPrice: normalizePrice(parsed.fullDayPrice, DEFAULT_STRUCTURED_SETTINGS.fullDayPrice),
      halfDayPrice: normalizePrice(parsed.halfDayPrice, DEFAULT_STRUCTURED_SETTINGS.halfDayPrice),
    };
  } catch {
    return DEFAULT_STRUCTURED_SETTINGS;
  }
}

export async function saveStructuredTemplateSettings(
  settings: StructuredTemplateSettings
): Promise<StructuredTemplateSettings> {
  const next: StructuredTemplateSettings = {
    bodyTemplate: settings.bodyTemplate || DEFAULT_STRUCTURED_SETTINGS.bodyTemplate,
    fullDayPrice: normalizePrice(settings.fullDayPrice, DEFAULT_STRUCTURED_SETTINGS.fullDayPrice),
    halfDayPrice: normalizePrice(settings.halfDayPrice, DEFAULT_STRUCTURED_SETTINGS.halfDayPrice),
  };

  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(STRUCTURED_SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function getDefaultStructuredTemplateSettings(): StructuredTemplateSettings {
  return { ...DEFAULT_STRUCTURED_SETTINGS };
}

export function renderTemplate(template: string, row: DogRow, extraValues: Record<string, string> = {}): string {
  const values = { ...getTemplateValues(row), ...extraValues };
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => values[key] ?? '');
}

function getTemplateValues(row: DogRow): Record<string, string> {
  const dogName = row.dogName?.trim() || 'your dog';
  const checkIn = joinDateTime(row.checkInDate, row.checkInTime) || 'N/A';
  const checkOut = joinDateTime(row.checkOutDate, row.checkOutTime) || 'N/A';
  const recapMinutes = String(getRecapMinutes(row.checkInDate, row.checkOutDate));

  return {
    dogName: escapeHtml(dogName),
    clientName: escapeHtml(row.clientName?.trim() || 'N/A'),
    email: escapeHtml(row.email?.trim() || 'N/A'),
    checkIn: escapeHtml(checkIn),
    checkOut: escapeHtml(checkOut),
    recapMinutes,
    dogSummary: escapeHtml(
      [row.dogName?.trim(), row.dogAge?.trim(), row.dogBreed?.trim()].filter(Boolean).join(', ') || 'N/A'
    ),
    dogAge: escapeHtml(row.dogAge?.trim() || 'N/A'),
    dogBreed: escapeHtml(row.dogBreed?.trim() || 'N/A'),
    issues: escapeHtml(row.issues?.trim() || 'N/A'),
    goals: escapeHtml(row.goals?.trim() || 'N/A'),
    totalCalendarDays: 'N/A',
    addOnsSummary: 'None',
    addOnsLine: 'Add-ons: None',
    holidayYN: 'n',
    holidayDaysCharged: '0',
    totalInvoice: 'N/A',
    venmoUrl: 'https://venmo.com/u/cohesivecanine',
  };
}

function joinDateTime(date?: string, time?: string): string | undefined {
  const parts = [date?.trim(), time?.trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

function getRecapMinutes(checkInDate?: string, checkOutDate?: string): number {
  const checkIn = parseDateOnly(checkInDate);
  const checkOut = parseDateOnly(checkOutDate);

  if (!checkIn || !checkOut) return 30;

  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) return 30;
  if (diffDays <= 13) return 45;
  if (diffDays <= 20) return 60;
  return 90;
}

function parseDateOnly(value?: string): Date | null {
  if (!value?.trim()) return null;
  const parts = value.trim().split('/');
  if (parts.length !== 3) return null;

  const month = Number(parts[0]);
  const day = Number(parts[1]);
  const year = Number(parts[2]);

  if (!month || !day || !year) return null;
  return new Date(year, month - 1, day);
}

function normalizePrice(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
