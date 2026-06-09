import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Variable de entorno requerida: ${name}`);
  return val;
}

export const config = {
  openwaUrl: process.env.OPENWA_URL || 'http://localhost:2785',
  openwaApiKey: required('OPENWA_API_KEY'),
  openwaSessionId: process.env.OPENWA_SESSION_ID || 'favram-bot',
  openaiApiKey: required('OPENAI_API_KEY'),
  authorizedPhone: required('AUTHORIZED_PHONE'),
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '3001', 10),
  serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '../serviceAccount.json',
};
