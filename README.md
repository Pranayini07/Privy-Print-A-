# Privy Print

Privy Print lets users upload documents, generate a temporary access code, and print the documents from another device without sharing the files permanently.

## Features

- Upload multiple PDF, Word, and image files
- Generate a six-digit, time-limited access code
- View and print documents from the `/print` page
- Select individual files when an upload contains multiple documents
- Expire an uploaded document early
- Find nearby print shops with Google Maps and Places
- Keep a local upload history in the browser

## Requirements

- Node.js 18 or later
- npm
- A Google Maps JavaScript API key with the Maps and Places APIs enabled, if the nearby-shop map is needed

## Getting Started

Install dependencies:

```bash
npm install
```

For the nearby-shop map, create `.env.local` in the project root:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Usage

1. Open the home page and upload one or more supported files.
2. Choose a preset expiry time or enter a custom value from 1 to 1,440 minutes.
3. Share the generated six-digit access code with the person operating the printer.
4. Open `/print`, enter the code, select a file if needed, and choose **Print Document**.
5. Use the document history on the home page to expire an active upload early.

Supported file types are `.pdf`, `.doc`, `.docx`, `.png`, `.jpg`, and `.jpeg`.

## Limits and Storage

- Each file is limited to 10 MB.
- Each upload can contain up to 20 files.
- Local development stores metadata in `data/db.json` and files in `data/uploads/`.
- Expired files are cleaned up during application activity.
- On Vercel, storage uses `/tmp`, which is ephemeral and not shared reliably between serverless instances. For production use, replace the local filesystem storage with durable object storage and a shared database.

## Scripts

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Serve the production build
npm run lint     # Run Next.js linting
```

## API Routes

- `POST /api/upload` - Upload files and create an access code
- `GET /api/meta/:code` - Read metadata for an access code
- `GET /api/view/:code` - Stream a document for inline viewing and printing
- `POST /api/expire/:code` - Expire a document immediately
