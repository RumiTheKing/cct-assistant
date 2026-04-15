export const COLUMN_NAMES = {
  paid: 'Paid',
  timestamp: 'Timestamp',
  email: 'Email Address',
  clientName: 'Your Name',
  checkInDate: 'Check in date - ',
  checkInTime: 'Check in time - ',
  checkOutDate: 'Check out date - ',
  checkOutTime:
    'Check out time - \n(Please plan on 30-90 minutes for a recap, depending on duration of board. Kierra will notify you.)',
  dogName: 'Dogs Name',
  dogAge: 'Dogs Age',
  dogBreed: 'Dogs Breed',
  issues: "Top three issues you're having with your dog",
  goals: 'Goals with your dog',
  status: 'Status',
  draftId: 'Draft ID',
  printDocUrl: 'PRINT Doc URL',
} as const;

export const YELLOW_RGB = { red: 1, green: 0.996, blue: 0 };
export const KEYCHAIN_SERVICE = 'cohesive-canine-assistant-google-oauth';
export const LEGACY_TOKENS_PATH = 'state/google-oauth.json';
