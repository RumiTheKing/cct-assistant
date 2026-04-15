# Cohesive Canine Assistant

Small manual-run app that:
- reads a Google Sheet of client/dog rows
- creates Gmail drafts
- creates one Google Doc named PRINT per run
- marks processed rows with a Status cell colored yellow

## V1 status
Scaffolded and ready for Google OAuth wiring.

## Setup
1. Copy `.env.example` to `.env`
2. Fill in Google OAuth credentials with access to Gmail, Sheets, and Docs
3. Run:
   - `npm install`
   - `npm run dev`
4. Open `http://localhost:3017`

## Expected sheet columns
Current mapping is based on the sample workbook and includes:
- Email Address
- Your Name
- Check in date -
- Check in time -
- Check out date -
- Check out time -
- Dogs Name
- Dogs Age
- Dogs Breed
- Goals with your dog
- Top three issues you're having with your dog

## Notes
- Draft only, no sending
- One PRINT doc per run
- One row per dog/client
- Missing email or dog name rows are skipped
