// @deno-types="https://deno.land/x/types/deno.d.ts"

// Declare Deno global for TypeScript
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get(key: string): string | undefined;
  };
};

Deno.serve(async (req: Request) => {
  // Get the origin from the request
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:15867'];

  // Check if the origin is allowed
  const isAllowedOrigin = allowedOrigins.includes(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request from:', origin);
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    const body = await req.json();
    console.log('Request body:', body);
    const { description } = body;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable');
    }

    const prompt = `Genera una lista de 3 a 5 sub-actividades para la siguiente actividad de auditoría. Cada sub-actividad debe ser una acción concreta y medible. Incluye una fecha de inicio y fin para cada una, asumiendo que la fecha de inicio es hoy y que cada sub-actividad dura entre 5 y 10 días. Formatea la respuesta como un JSON con una clave "subActivities" que contenga un array de objetos, donde cada objeto tiene "description", "start_date", y "end_date".\n\nActividad: "${description}"`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('Gemini API Error:', errorBody);
      throw new Error(`Error con la API de Gemini: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Respuesta de la IA vacía o con formato inesperado.");
    }

    // Robustly parse the JSON, stripping markdown code fences if present.
    const jsonText = rawText.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(jsonText);
    const subActivities = parsedData.subActivities;

    return new Response(
      JSON.stringify({ subActivities }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'http://localhost:5173',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
        }
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'http://localhost:5173',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
      status: 400,
    });
  }
});