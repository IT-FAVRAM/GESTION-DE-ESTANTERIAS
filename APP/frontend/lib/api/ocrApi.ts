import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/index.js';

export interface CloudOcrResult {
  ok: boolean;
  text: string;
  lines: string[];
  confidence: number;
}

/**
 * Envía una imagen (dataURL o base64 crudo) a Cloud Vision vía la Cloud Function
 * `ocrImage` y devuelve el texto reconocido. Lee impreso y manuscrito con mucha
 * mayor calidad que el OCR local (Tesseract).
 */
export const recognizeImage = async (imageBase64OrDataUrl: string): Promise<CloudOcrResult> => {
  const callable = httpsCallable(functions, 'ocrImage');
  const result = await callable({ imageBase64: imageBase64OrDataUrl });
  const data = (result?.data || {}) as Partial<CloudOcrResult>;
  return {
    ok: !!data.ok,
    text: String(data.text || ''),
    lines: Array.isArray(data.lines) ? data.lines : [],
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
  };
};
