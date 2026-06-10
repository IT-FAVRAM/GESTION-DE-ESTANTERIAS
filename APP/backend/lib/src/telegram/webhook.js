"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWebhook = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ai_1 = require("./ai");
const TELEGRAM_API = 'https://api.telegram.org/bot';
async function sendMessage(chatId, text, token) {
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        }),
    });
}
async function sendChatAction(chatId, action, token) {
    await fetch(`${TELEGRAM_API}${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action }),
    });
}
async function getFile(fileId, token) {
    var _a;
    const res = await fetch(`${TELEGRAM_API}${token}/getFile?file_id=${fileId}`);
    const data = await res.json();
    return ((_a = data.result) === null || _a === void 0 ? void 0 : _a.file_path) || null;
}
async function downloadFile(filePath, token) {
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
async function isAuthorized(chatId) {
    var _a;
    const db = admin.firestore();
    const configDoc = await db.collection('config').doc('telegram').get();
    if (!configDoc.exists) {
        functions.logger.warn('config/telegram document not found');
        return false;
    }
    const allowedChatIds = ((_a = configDoc.data()) === null || _a === void 0 ? void 0 : _a.allowedChatIds) || [];
    return allowedChatIds.includes(chatId);
}
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    // Validar secret token
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret && secretToken !== webhookSecret) {
        res.status(403).send('Forbidden');
        return;
    }
    if (req.method !== 'POST') {
        res.status(200).send('OK');
        return;
    }
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const openaiKey = process.env.OPENAI_API_KEY || '';
    if (!token || !openaiKey) {
        functions.logger.error('Missing TELEGRAM_BOT_TOKEN or OPENAI_API_KEY');
        res.status(500).send('Missing secrets');
        return;
    }
    const update = req.body;
    // Comando /id - retorna el chat ID para facilitar altas
    if (((_a = update.message) === null || _a === void 0 ? void 0 : _a.text) === '/id') {
        const chatId = update.message.chat.id;
        await sendMessage(chatId, `Tu chat ID: <code>${chatId}</code>`, token);
        res.status(200).send('OK');
        return;
    }
    // Comando /start
    if (((_b = update.message) === null || _b === void 0 ? void 0 : _b.text) === '/start') {
        const chatId = update.message.chat.id;
        await sendMessage(chatId, '🏭 <b>WMS Favram Bot</b>\n\n' +
            'Envíame una pregunta sobre artículos del almacén.\n\n' +
            'Ejemplos:\n' +
            '• ¿Dónde está el artículo ABC123?\n' +
            '• Muéstrame la ubicación MEC-005\n' +
            '• Resumen de la sección Prensas\n' +
            '• Resumen general\n\n' +
            'También puedes enviar notas de voz.', token);
        res.status(200).send('OK');
        return;
    }
    // Verificar que es un mensaje
    if (!update.message) {
        res.status(200).send('OK');
        return;
    }
    const chatId = update.message.chat.id;
    // Verificar autorización
    if (!(await isAuthorized(chatId))) {
        await sendMessage(chatId, '⛔ No autorizado. Contacta al administrador.', token);
        res.status(200).send('OK');
        return;
    }
    try {
        await sendChatAction(chatId, 'typing', token);
        let userText = '';
        // Nota de voz
        if (update.message.voice) {
            const voice = update.message.voice;
            const filePath = await getFile(voice.file_id, token);
            if (filePath) {
                const audioBuffer = await downloadFile(filePath, token);
                userText = await (0, ai_1.transcribeAudio)(audioBuffer, openaiKey);
                if (!userText) {
                    await sendMessage(chatId, '❌ No pude transcribir el audio.', token);
                    res.status(200).send('OK');
                    return;
                }
                await sendMessage(chatId, `🎙️ <i>${userText}</i>`, token);
            }
        }
        else if (update.message.text) {
            userText = update.message.text;
        }
        if (!userText) {
            res.status(200).send('OK');
            return;
        }
        // Procesar con IA
        const response = await (0, ai_1.processMessage)(userText, openaiKey);
        await sendMessage(chatId, response, token);
    }
    catch (err) {
        functions.logger.error('Telegram webhook error:', err);
        await sendMessage(chatId, '❌ Error al procesar. Intenta de nuevo.', token);
    }
    res.status(200).send('OK');
});
//# sourceMappingURL=webhook.js.map