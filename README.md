# Cohesive Canine Assistant

## Mac Quick Start

If you want the shortest possible fresh-machine setup:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
brew install git node
git clone git@github.com:RumiTheKing/cct-assistant.git
cd cct-assistant
npm install
cp .env.example .env
npm run dev
```

Then open `http://localhost:3017` and connect Google in the app.

Cohesive Canine Assistant is a small local web app for manual dog/client workflows.

It currently includes:
- **Board and Train Tool**
  - reads Google Sheet rows
  - creates Gmail drafts
  - creates one `PRINT` Google Doc per run
  - marks processed rows in Google Sheets
- **Structured Board Tool**
  - reads Google Sheet rows
  - creates one `SB TEXT DOCUMENT` Google Doc per run
  - supports pricing logic, half days, holidays, add-ons, training warnings, and multi-dog manual-review handling
  - marks processed rows in Google Sheets

## Current workflow style
- manual run only
- draft only for email flows
- one Google Doc per run
- local single-user workflow
- Google auth stored locally on the machine
- Structured Board is intended to avoid exposing client contact info in UI/output
- Board and Train uses email only for draft creation and should minimize visible email exposure in UI

---

# Fresh Machine Setup Guide

This section is for setting the app up on a **brand new Mac** that has basically nothing installed yet.

## 1. Install Homebrew
Open Terminal and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then follow the instructions it prints.

If it tells you to add Homebrew to your shell profile, run the command it gives you.

On Apple Silicon Macs, it is usually:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Check that Homebrew is installed:

```bash
brew --version
```

## 2. Install Git and Node.js (includes npm)
Run:

```bash
brew install git node
```

Check that they installed correctly:

```bash
git --version
node --version
npm --version
```

## 3. Clone the project from GitHub
If you are using HTTPS:

```bash
git clone https://github.com/RumiTheKing/cct-assistant.git
```

If you are using SSH:

```bash
git clone git@github.com:RumiTheKing/cct-assistant.git
```

Then move into the project:

```bash
cd cct-assistant
```

## 4. Install app dependencies
Run:

```bash
npm install
```

## 5. Create your local environment file
Copy the example file:

```bash
cp .env.example .env
```

Then open it in a text editor.

If you want to use TextEdit:

```bash
open -a TextEdit .env
```

If you use VS Code:

```bash
code .env
```

## 6. Fill in the Google OAuth values in `.env`
You will need:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Default local redirect URI:

```env
GOOGLE_REDIRECT_URI=http://localhost:3017/oauth2callback
```

`.env.example` currently looks like this:

```env
PORT=3017
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3017/oauth2callback
GOOGLE_REFRESH_TOKEN=
```

Note: the app now uses the browser OAuth flow and local token storage, so `GOOGLE_REFRESH_TOKEN` is not usually something you need to fill in manually.

## 7. Start the app
Run:

```bash
npm run dev
```

Then open:

```text
http://localhost:3017
```

## 8. Connect Google
Once the app is open:
- use the Google connect flow in the app
- sign in to the Google account you want to use
- approve Sheets, Docs, and Gmail access

## 9. Pull updates later
Whenever you want the latest version on that machine:

```bash
cd cct-assistant
git pull
npm install
npm run dev
```

---

# Recommended Mac setup notes

## If `git clone` fails over SSH
You may need to create an SSH key first.

Generate one:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Start the SSH agent:

```bash
eval "$(ssh-agent -s)"
```

Add the key:

```bash
ssh-add ~/.ssh/id_ed25519
```

Then copy the public key:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

Add that key to GitHub under:
- **GitHub → Settings → SSH and GPG keys**

Then test it:

```bash
ssh -T git@github.com
```

## If you want a simple app launcher later
You can keep using:

```bash
cd ~/path/to/cct-assistant && npm run dev
```

Or later we can make:
- a one-click startup script
- a LaunchAgent
- or a tiny packaged desktop wrapper

---

# Current app setup

## Main routes
- `/` → home/tool hub
- `/board-and-train.html` → Board and Train Tool
- `/structured-board.html` → Structured Board Tool
- `/settings.html` → settings

## Main API endpoints
- `GET /api/health`
- `POST /api/preview`
- `POST /api/run`
- `GET /api/template-settings`
- `POST /api/template-settings`
- `POST /api/template-settings/reset`
- `GET /api/structured-template-settings`
- `POST /api/structured-template-settings`
- `POST /api/structured-template-settings/reset`
- `POST /api/auth/disconnect`
- `POST /api/structured/preview`
- `POST /api/structured/run`

---

# Notes

- draft only, no automatic sending
- one document per run
- rows with missing required data are skipped
- Structured Board should not expose client email or phone details in generated output or normal UI flows
- Board and Train uses email for Gmail draft creation, but visible email display should stay minimized
- Google auth is local to each machine
- template settings are local to each machine unless you manually move/export them
- this app currently fits best as a **local app**, not a hosted Vercel-style app

If you want, the next useful step would be adding:
- a **settings export/import** feature
- or a **one-command machine setup script**
