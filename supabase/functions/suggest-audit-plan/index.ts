declare const Deno: any;

import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// Standard CORS headers for all responses
import { buildCorsHeadersForRequest } from "../_shared/cors.ts";

// Define the expected JSON schema for the response from Gemini
const responseSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    scope_level: { type: "string" },
    scope_entity: { type: "string" },
    phase_activities: {
        type: "object",
        properties: {
            planificacion: { type: "object" },
            ejecucion: { type: "object" },
            evaluacion: { type: "object" },
            seguimiento: { type: "object" },
        }
    }
  },
  required: ["name", "scope_level", "scope_entity", "phase_activities"]
};

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'POST,OPTIONS' });
  // Handle CORS preflight requests immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.error("Critical Error: GEMINI_API_KEY environment variable not set.");
      throw new Error('Error de configuración del servidor: la clave de API está ausente.');
    }

    // Robustly parse and validate the request body
    const { description, name } = await req.json();
    if (!description || typeof description !== 'string' || !description.trim()) {
      return new Response(
        JSON.stringify({ error: "Solicitud inválida: el campo 'description' es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Construct the prompt and call the Gemini API
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Como un experto auditor de cumplimiento para instituciones educativas en México, analiza la siguiente descripción y extrae un plan de auditoría conciso.
Descripción de la auditoría solicitada: "${description}"
${name ? `El nombre de la auditoría es "${name}".` : ''}

Responde exclusivamente en formato JSON con la siguiente estructura:
{
  "name": "<nombre de la auditoría>",
  "scope_level": "<General | Campus | Nivel Educativo | Facultad/Escuela>",
  "scope_entity": "<nombre de la entidad si aplica, si no, string vacío>",
  "phase_activities": {
    "planificacion": {
      "activities": [
        { "key": "<clave_corta>", "title": "<título de la actividad>" },
        { "key": "<clave_corta_2>", "title": "<título de la actividad_2>" }
      ]
    },
    "ejecucion": {
      "activities": [
        { "key": "<clave_corta>", "title": "<título de la actividad>" }
      ]
    },
    "evaluacion": {
      "activities": [
        { "key": "<clave_corta>", "title": "<título de la actividad>" }
      ]
    },
    "seguimiento": {
      "activities": [
        { "key": "<clave_corta>", "title": "<título de la actividad>" }
      ]
    }
  }
}
Genera entre 3 y 5 actividades para cada fase. Las claves ('key') deben ser cortas, en snake_case y únicas.`

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    // Try to parse AI output and normalize shape
    const tryParse = (raw: string) => {
      try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } } return null; }
    };
    const raw = tryParse(text);
    // Accept shapes like { name, scope_level, scope_entity } or { plan: { ... } } or { data: { ... } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extract = (obj: any) => {
      if (!obj || typeof obj !== 'object') return null;
      const candidate = obj.plan || obj.data || obj;
      const name = candidate?.name;
      const scope_level = candidate?.scope_level || candidate?.scopeLevel || 'General';
      const scope_entity = candidate?.scope_entity || candidate?.scopeEntity || '';
      const phase_activities = candidate?.phase_activities;

      if (typeof name === 'string' && typeof scope_level === 'string') {
        const res: any = {
            name,
            scope_level,
            scope_entity: typeof scope_entity === 'string' ? scope_entity : '',
        };
        if (phase_activities && typeof phase_activities === 'object') {
            res.phase_activities = phase_activities;
        }
        return res;
      }
      return null;
    };
    const normalized = extract(raw);
    if (!normalized) {
      // Return a 200 with a minimal suggestion to avoid hard failures in UI, but mark as uncertain
      const fallback = { name: (typeof text === 'string' && text.slice(0,80)) || 'Auditoría', scope_level: 'General', scope_entity: '' };
      return new Response(JSON.stringify(fallback), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
    return new Response(JSON.stringify(normalized), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    // Generic error handler for any failure in the try block
    const isClientError = error instanceof SyntaxError;
    const status = isClientError ? 400 : 500;
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido en el servidor.';
    
    console.error(`Function error in 'suggest-audit-plan' (Status: ${status}):`, errorMessage, error);

  return new Response(JSON.stringify({ error: errorMessage }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});