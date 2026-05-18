# RxDecode

RxDecode is a final-year project style prescription intelligence workspace for extracting handwritten prescription details, organizing medication schedules, translating patient instructions, and exporting reports.

## What is implemented

- React + TanStack Start frontend and server functions
- Gemini-powered structured extraction and translation
- Medication overview, raw text, daily schedule, PDF/JSON export, and history

## Academic presentation structure

This repository also includes a `research/` area to document the team's proposed computer-vision and ML pipeline. Those folders are intentionally documentation-first placeholders for presentation, methodology writeups, and future implementation work. They are not part of the current runtime path.

## Current stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Start
- AI integration: Gemini 2.5 Flash API
- Deployment target: Cloudflare-compatible build output

## Proposed research pipeline

- OpenCV-based preprocessing for denoising, contrast normalization, and region isolation
- OCR benchmarking for handwritten and printed prescription text
- TensorFlow/Keras experiments for prescription layout and medicine-token classification
- NumPy/Pandas analysis workflows for dataset curation and result tracking
- Scikit-learn baselines for confidence scoring and comparative evaluation

## Project structure

- `src/`: production application code
- `public/`: brand assets
- `docs/`: architecture and project notes
- `research/`: presentation-friendly proposed ML pipeline and experiment placeholders

## Running locally

```bash
npm run dev
```

Set `GEMINI_API_KEY` in `.env.local` before using analysis features.
