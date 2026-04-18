export const COLUMN_NAMES = {
  paid: 'Paid',
  timestamp: 'Timestamp',
  confirmedDates: 'Have you confirmed dates with Kierra or Fox via text? ',
  clientName: 'Your Name',
  dogName: 'Your Dogs Name',
  dogAge: 'Your Dogs Age',
  emergencyContact:
    'In case of an emergency, please share emergency contact information, name and phone number',
  checkInDate: 'Check in date -',
  checkInTime: 'Check in time - ',
  checkOutDate: 'Check out date -',
  checkOutTime: 'Check out time - ',
  feedingSchedule: 'My dog is fed - ',
  mealsPacked: 'My dogs meals are packed -',
  alteredStatus: 'My dog - ',
  heatCyclePlan: 'If your female dog starts heat (their period) during their stay',
  bathRequest:
    'All boards longer than 10+ full days will receive a complimentary bath. \n\nIf your board is shorter than 10 days but would still like your dog bathed before check out it is $35 for dogs smaller than 30 pounds and $50 for dogs larger than 30 pounds. \n\n*We will not trim nails or cut fur*',
  shampooAllergies: 'If you selected yes, please tell us if your dog has any shampoo/conditioner allergies',
  dogWeight: 'If you selected yes, please tell us the weight of your dog.',
  rabiesStatus:
    'Is your dog up to date on rabies shot? New clients, please email proof to cohesivecanine@gmail.com or text 385.214.9853',
  dogReadiness: 'My dog is - ',
  optionalAdventures: 'Optional adventures (1+ hour) -',
  etaAgreement:
    'Please text us if you\'re running early or late for check-in or check-out. It’s important that every dog gets a proper, calm welcome into our home. Sharing your exact ETA (for example: “Arriving at 10:02 AM”) is extremely helpful.\nIf we aren\'t notified of changes to your scheduled time, a $25 fee will apply.',
  extraNotes:
    'Thank you for filling this out! I will be with you shortly to confirm check in/out times and send all additional information (contract if needed, invoice, address, etc). Please let me know if there\'s anything else I should know (any medicine needed, etc) - ',
  email: 'Your Email ',
  trainingDetails: 'If selected "training" please explain task you\'d like us to practice with your dog during their stay',
  status: 'Status',
  draftId: 'Draft ID',
  printDocUrl: 'PRINT Doc URL',
  dogBreed: 'Dogs Breed',
  issues: "Top three issues you're having with your dog",
  goals: 'Goals with your dog',
} as const;

export const COLUMN_ALIASES: Partial<Record<keyof typeof COLUMN_NAMES, string[]>> = {
  email: ['Email Address', 'Email', 'Your Email', 'Your Email ', 'Owner Email', 'Client Email'],
  dogName: [
    'Dog Name',
    'Dog name',
    'Name of Dog',
    'Dog\'s Name',
    'Dogs Name',
    'Your Dog\'s Name',
    'Your Dogs Name',
    'What is your dog\'s name?',
    'What is your dogs name?',
  ],
  clientName: ['Name', 'Your Name', 'Owner Name', 'Client Name'],
  dogAge: ['Dog Age', 'Your Dog\'s Age', 'Your Dogs Age', 'Age'],
  dogBreed: ['Dog Breed', 'Your Dog\'s Breed', 'Dogs Breed', 'Breed'],
  checkInDate: ['Check In Date', 'Check in date', 'Check in date -', 'Check-In Date', 'Checkin Date', 'Drop Off Date'],
  checkInTime: ['Check In Time', 'Check in time', 'Check in time - ', 'Check-In Time', 'Checkin Time', 'Drop Off Time'],
  checkOutDate: ['Check Out Date', 'Check out date', 'Check out date -', 'Check-Out Date', 'Checkout Date', 'Pick Up Date'],
  checkOutTime: ['Check Out Time', 'Check out time', 'Check out time - ', 'Check-Out Time', 'Checkout Time', 'Pick Up Time'],
};

export const YELLOW_RGB = { red: 1, green: 0.996, blue: 0 };
export const ORANGE_RGB = { red: 1, green: 0.6, blue: 0.2 };
export const RED_RGB = { red: 0.8, green: 0.2, blue: 0.2 };
export const WHITE_RGB = { red: 1, green: 1, blue: 1 };
export const BLACK_RGB = { red: 0, green: 0, blue: 0 };
export const KEYCHAIN_SERVICE = 'cohesive-canine-assistant-google-oauth';
export const LEGACY_TOKENS_PATH = 'state/google-oauth.json';
