# Comment Extractor

A web application that uses Google's Gemini API to extract comments from social media screenshots (Instagram, Twitter, Facebook, etc.) and export them to CSV.

## Features

- 📸 **Bulk Image Upload**: Drag and drop multiple screenshot images at once
- 🤖 **AI-Powered Extraction**: Uses Gemini API to intelligently extract comments from screenshots
- 📊 **CSV Export**: Export all extracted comments to a well-organized CSV file
- 🎨 **Modern UI**: Built with shadcn/ui components for a beautiful, accessible interface
- 🔒 **Local Storage**: API key is stored securely in your browser (never sent to servers)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. **Enter API Key**: Click the settings icon and enter your Gemini API key
2. **Upload Images**: Drag and drop or select screenshot images containing social media comments
3. **Process**: Click "Process Images" to extract comments using AI
4. **Export**: Click "Export CSV" to download all extracted comments

## How It Works

The app uses Google's Gemini 2.5 Flash model to analyze screenshot images and extract:
- Username (if visible)
- Comment text
- Timestamp (if visible)
- Like count (if visible)

All extracted data is organized and exported to CSV format for easy analysis.

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Google Gemini API** - AI image analysis
- **react-dropzone** - File upload handling

## Project Structure

```
├── app/
│   ├── api/
│   │   └── process-images/    # API route for processing images
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main page
├── components/
│   ├── ui/                    # shadcn/ui components
│   └── file-upload.tsx        # File upload component
└── lib/
    ├── csv-export.ts          # CSV generation utilities
    └── utils.ts               # Utility functions
```

## License

MIT

