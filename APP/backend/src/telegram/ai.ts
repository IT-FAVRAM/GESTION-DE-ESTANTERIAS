import { buscarArticulo, verUbicacion, resumenSeccion, resumenGeneral } from './queries';

const SYSTEM_PROMPT = `Eres el asistente WMS de Favram, un almacén de piezas industriales.
Responde en español de forma breve y clara.

Secciones del almacén:
- MEC / MECANIZADO → Estantería MEC
- PRE / PRENSAS → Estantería PRE
- PRENSAS_MECANIZADO → Ambas estanterías MEC y PRE
- SOL / RSO / SXP → SOLDADURA
- REP / ZIN → REPASADO
- PIN → PINTURA
- CAL → CALIDAD
- PLE → PLEGADORA
- LASER → LASER

Usa las herramientas disponibles para buscar artículos y ubicaciones.
Si no encuentras algo, di "No encontrado" directamente.`;

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'buscar_articulo',
      description: 'Buscar un artículo por código o número de orden de fabricación',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Código del artículo o número de OF' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'ver_ubicacion',
      description: 'Ver el contenido de una posición concreta del almacén',
      parameters: {
        type: 'object',
        properties: {
          shelfCode: { type: 'string', description: 'Código de estantería (MEC, PRE, SOL, etc.)' },
          position: { type: 'string', description: 'Posición (001, 002, E1-01, etc.)' },
        },
        required: ['shelfCode', 'position'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'resumen_seccion',
      description: 'Ver resumen de artículos en una sección',
      parameters: {
        type: 'object',
        properties: {
          seccion: { type: 'string', description: 'Nombre de la sección' },
        },
        required: ['seccion'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'resumen_general',
      description: 'Ver resumen general del almacén con todas las estanterías',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export async function processMessage(text: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 500,
    }),
  });

  const data = await response.json() as any;
  const choice = data.choices?.[0];

  if (!choice) {
    return 'Error al procesar el mensaje.';
  }

  // Si el modelo quiere usar una herramienta
  if (choice.message.tool_calls) {
    const results: string[] = [];

    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      let result = '';

      switch (toolCall.function.name) {
        case 'buscar_articulo':
          result = await buscarArticulo(args.query);
          break;
        case 'ver_ubicacion':
          result = await verUbicacion(args.shelfCode, args.position);
          break;
        case 'resumen_seccion':
          result = await resumenSeccion(args.seccion);
          break;
        case 'resumen_general':
          result = await resumenGeneral();
          break;
        default:
          result = `Herramienta "${toolCall.function.name}" no implementada.`;
      }

      results.push(result);
    }

    const toolMessages = choice.message.tool_calls.map((tc: any, i: number) => ({
      role: 'tool' as const,
      content: results[i],
      tool_call_id: tc.id,
    }));

    const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
          choice.message,
          ...toolMessages,
        ],
        max_tokens: 500,
      }),
    });

    const finalData = await finalResponse.json() as any;
    return finalData.choices?.[0]?.message?.content || results.join('\n\n');
  }

  // Respuesta directa sin herramientas
  return choice.message.content || 'No puedo procesar esa solicitud.';
}

export async function transcribeAudio(audioBuffer: Buffer, apiKey: string): Promise<string> {
  // Convertir OGG a texto usando gpt-4o-mini-transcribe
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('language', 'es');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const data = await response.json() as any;
  return data.text || '';
}
