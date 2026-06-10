import { defineSecret } from 'firebase-functions/params';

export const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
export const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
export const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');
