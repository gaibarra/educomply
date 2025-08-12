declare const Deno: any;

import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// Standard CORS headers for all responses
import { buildCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = buildCorsHeaders({ 'Access-Control-Allow-Methods': 'POST,OPTIONS' });

// Define the expected JSON schema for the response from Gemini
const responseSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    scope_level: { type: "string" },
    scope_entity: { type: "string" }
  },
  required: ["name", "scope_level", "scope_entity"]
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const { description } = await req.json();
    if (!description || typeof description !== 'string' || !description.trim()) {
      return new Response(
        JSON.stringify({ error: "Solicitud inválida: el campo 'description' es obligatorio." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Construct the prompt and call the Gemini API
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Como un experto auditor de cumplimiento para instituciones educativas en México, analiza la siguiente descripción y extrae un plan de auditoría conciso. Responde exclusivamente en formato JSON. Descripción de la auditoría solicitada: "${description}"`;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    // Return the successful response from Gemini
    return new Response(text, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Generic error handler for any failure in the try block
    const isClientError = error instanceof SyntaxError;
    const status = isClientError ? 400 : 500;
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido en el servidor.';
    
    console.error(`Function error in 'suggest-audit-plan' (Status: ${status}):`, errorMessage, error);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});