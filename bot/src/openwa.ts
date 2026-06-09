import axios from 'axios';
import { config } from './config';

const api = axios.create({
  baseURL: config.openwaUrl + '/api',
  headers: { 'X-API-Key': config.openwaApiKey, 'Content-Type': 'application/json' },
  timeout: 10_000,
});

export async function sendMessage(chatId: string, text: string): Promise<void> {
  await api.post(`/sessions/${config.openwaSessionId}/messages/send-text`, { chatId, text });
}

export { api as openwaApi };
