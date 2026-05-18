# Architecture Overview

## Runtime flow

1. The user uploads a prescription image in the React frontend.
2. The app compresses the image client-side for faster transfer.
3. Server functions call the Gemini API to extract structured medication data.
4. The same workspace formats the output into schedule, summary, translation, JSON, and PDF views.

## Presentation flow for academic discussion

The current working prototype uses Gemini for the extraction step. Alongside that, the repository includes a proposed research pipeline for a more traditional CV + OCR + ML stack:

1. OpenCV preprocessing
2. OCR text-region extraction
3. TensorFlow/Keras post-processing or classification experiments
4. Pandas-based evaluation sheets
5. Scikit-learn confidence and comparison baselines

This split keeps the live product working while still documenting the team's broader project direction honestly.
