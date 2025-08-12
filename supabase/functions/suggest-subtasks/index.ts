declare const Deno: any;

import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// CORS headers
import { buildCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = buildCorsHeaders({ 'Access-Control-Allow-Methods': 'POST,OPTIONS' });

// Helper to parse JSON from model text
const parseAiJson = (raw: string) => {
    const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
    let obj = tryParse(raw);
    if (!obj) {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) obj = tryParse(m[0]);
    }
    return obj;
};

Deno.serve(async (req: Request) => {
    // Preflight
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
            return new Response(JSON.stringify({ error: 'Server configuration error: API key is missing.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Parse body
        let obligation = '';
        let category = '';
        const ct = req.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            try {
                const j = await req.json();
                obligation = j?.obligation || '';
                category = j?.category || '';
            } catch (_) {}
        }
        if (!obligation || !category) {
            return new Response(JSON.stringify({ error: "Invalid request: 'obligation' and 'category' fields are required." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Call Gemini
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Genera SOLO JSON válido con la forma { "subTasks": string[] }.
Subdivide la tarea en 3 a 5 sub-tareas concretas y accionables.
Tarea Principal: "${obligation}"
Categoría: "${category}"`;
        const result = await model.generateContent(prompt);
        const text = await result.response.text();

        const json = parseAiJson(text);
        if (!json || !Array.isArray(json.subTasks)) {
            return new Response(JSON.stringify({ error: 'Respuesta IA inválida', raw: text.slice(0, 1000) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Normalize to strings only and limit 3-5
        const subTasks = json.subTasks.filter((x: any) => typeof x === 'string').slice(0, 5);
        return new Response(JSON.stringify({ subTasks }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[suggest-subtasks] error:`, message, error);
        return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
