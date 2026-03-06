/**
 * OCR Service — Multi-provider text recognition.
 *
 * Provider priority:
 *   1. Google Cloud Vision (if GCP billing is active)
 *   2. OCR.space free API (no signup, no billing — works immediately)
 *
 * Works on all platforms (Web, iOS, Android) and inside Expo Go —
 * no native modules required.
 */

import * as ImageManipulator from 'expo-image-manipulator';

// ── Google Cloud Vision ─────────────────────────────────────────────
const VISION_API_KEY = 'AIzaSyCogyzEhPaUR1JDAAHpYanWTjoSzHeNUSs';
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;

// ── OCR.space free tier (no signup needed, 25 k reqs/month) ────────
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const OCR_SPACE_KEY = 'K85672888788957'; // public free-tier demo key

/**
 * Prepare the image: resize to 1280px wide + JPEG base64.
 */
async function prepareImage(imageUri: string) {
  const manipulated = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1280 } }],
    { base64: true, compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  if (!manipulated.base64) {
    throw new Error('Failed to encode image as base64');
  }
  return manipulated.base64;
}

// ── Provider 1: Google Cloud Vision ─────────────────────────────────
async function recognizeWithCloudVision(base64: string): Promise<string> {
  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
      },
    ],
  };

  const response = await fetch(VISION_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloud Vision ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0]?.textAnnotations;
  return annotations?.[0]?.description ?? '';
}

// ── Provider 2: OCR.space (free, no billing) ────────────────────────
async function recognizeWithOCRSpace(base64: string): Promise<string> {
  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2'); // Engine 2 is better for photos

  const response = await fetch(OCR_SPACE_URL, {
    method: 'POST',
    headers: { apikey: OCR_SPACE_KEY },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR.space HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage?.[0] || 'OCR.space processing error');
  }

  const text = data.ParsedResults
    ?.map((r: any) => r.ParsedText)
    .join('\n')
    .trim();

  return text || '';
}

// ── Public API: try providers in order ──────────────────────────────
/**
 * Recognize text in an image. Tries Google Cloud Vision first, then
 * falls back to the free OCR.space API if Cloud Vision is unavailable.
 */
export async function recognizeText(imageUri: string): Promise<string> {
  const base64 = await prepareImage(imageUri);

  // Try Cloud Vision first (faster & more accurate)
  try {
    const text = await recognizeWithCloudVision(base64);
    if (text) return text;
  } catch (err: any) {
    console.warn('Cloud Vision unavailable, falling back to OCR.space:', err.message);
  }

  // Fallback: OCR.space free API
  try {
    const text = await recognizeWithOCRSpace(base64);
    if (text) return text;
  } catch (err: any) {
    console.error('OCR.space also failed:', err.message);
    throw new Error(
      'Could not recognize text. Please check your internet connection and try again.',
    );
  }

  return '';
}
