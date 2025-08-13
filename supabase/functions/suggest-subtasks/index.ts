declare const Deno: any;

import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// CORS headers
import { buildCorsHeadersForRequest } from "../_shared/cors.ts";

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

// Helper to extract fields from various formats
async function extractFields(req: Request) {
    const url = new URL(req.url);
    let obligation = url.searchParams.get('obligation') ?? '';
    let category = url.searchParams.get('category') ?? '';

    if (obligation && category) return { obligation, category };

    const ct = req.headers.get('content-type') || '';
    const lc = ct.toLowerCase();

    try {
        if (lc.includes('application/json')) {
            const j = await req.json();
            obligation = j?.obligation ?? j?.obligacion ?? j?.task ?? '';
            category = j?.category ?? j?.categoria ?? j?.type ?? '';
        } else if (lc.includes('application/x-www-form-urlencoded')) {
            const body = await req.text();
            const p = new URLSearchParams(body);
            obligation = p.get('obligation') ?? p.get('obligacion') ?? p.get('task') ?? '';
            category = p.get('category') ?? p.get('categoria') ?? p.get('type') ?? '';
        } else if (lc.includes('text/plain')) {
            const body = await req.text();
            try {
                const j = JSON.parse(body);
                obligation = j?.obligation ?? j?.obligacion ?? j?.task ?? '';
                category = j?.category ?? j?.categoria ?? j?.type ?? '';
            } catch {
                // Ignore if not JSON
            }
        }
    } catch {
        // Ignore parsing errors
    }

    return { obligation: obligation?.toString().trim(), category: category?.toString().trim() };
}

Deno.serve(async (req: Request) => {
    const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' });

    // Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Healthcheck (optional)
    if (req.method === 'GET') {
        const url = new URL(req.url);
        if (url.searchParams.get('health') === '1') {
            return new Response('ok', { status: 200, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

        // Parse body (improved)
        const { obligation, category } = await extractFields(req);
        if (!obligation || !category) {
            return new Response(JSON.stringify({
                error: "Invalid request: 'obligation' and 'category' fields are required.",
                hint: "Send JSON with { obligation, category } or query params ?obligation=...&category=..."
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Call Gemini
        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Genera SOLO JSON válido con la forma { "subTasks": string[] }.
Subdivide la tarea en 3 a 5 sub-tareas concretas y accionables.
Tarea Principal: "${obligation}"
Categoría: "${category}"`;
        
        const result = await model.generateContent(prompt);
        // text() returns a string in @google/generative-ai
        const text = result.response.text();
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