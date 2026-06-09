import OpenAI from 'openai';
import { config } from './config';
import { buscarArticulo, type ArticleLocation } from './firestore';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const SYSTEM_PROMPT = `Eres el asistente del almacén WMS de Favram.
Puedes responder SOLO dos tipos de preguntas:
- ¿Dónde está el artículo X? → estantería y posición
- ¿Cuánto tiempo lleva el artículo X ahí? → tiempo desde que se ubicó

Si te preguntan algo distinto, responde: "Solo puedo ayudarte a localizar artículos en el almacén."
Responde siempre en español, de forma concisa. No uses markdown, solo texto plano.`;

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_articulo',
      description: 'Busca en qué estantería y posición está un artículo y cuánto tiempo lleva ahí',
      parameters: {
        type: 'object',
        properties: {
          articleCode: {
            type: 'string',
            description: 'Código del artículo (número o alfanumérico, ej: 12345 o ABC-001)',
          },
          orderFab: {
            type: 'string',
            description: 'Número de OF u orden de fabricación si se menciona explícitamente',
          },
        },
        required: ['articleCode'],
      },
    },
  },
];

function formatLocations(locations: ArticleLocation[]): string {
  if (locations.length === 0) {
    return JSON.stringify({ found: false });
  }
  return JSON.stringify({ found: true, total: locations.length, locations });
}

export async function processMessage(userText: string): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userText },
  ];

  const first = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools,
    tool_choice: 'auto',
    max_tokens: 200,
    temperature: 0,
  });

  const choice = first.choices[0];

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
    const call = choice.message.tool_calls[0];
    const args = JSON.parse(call.function.arguments) as { articleCode: string; orderFab?: string };

    const locations = await buscarArticulo(args.articleCode, args.orderFab);
    const toolResult = formatLocations(locations);

    messages.push(choice.message);
    messages.push({ role: 'tool', tool_call_id: call.id, content: toolResult });

    const second = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0,
    });

    return second.choices[0].message.content?.trim() || 'Sin respuesta';
  }

  return choice.message.content?.trim() ||
    'No he entendido la consulta. Puedo decirte dónde está un artículo o cuánto tiempo lleva ubicado.';
}
