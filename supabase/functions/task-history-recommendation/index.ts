// Edge Function: task-history-recommendation
// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
declare const Deno: any;
// Genera una recomendación resumida resaltando normativa a cumplir a partir de un listado
// cronológico de eventos de la tarea y sus subtareas.
// Entrada esperada (POST JSON): { events: Array<{ ts:string, type:string, title:string, detail?:string }>, context?: { description?:string, category?:string, source?:string } }
// Salida: { recommendation: string }

// Reusa CORS utilidades
import { buildCorsHeadersForRequest } from "../_shared/cors.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

interface IncomingEvent { ts: string; type: string; title: string; detail?: string; }

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = await req.json().catch(()=> ({}));
    const events: IncomingEvent[] = Array.isArray(body?.events) ? body.events : [];
    const ctx = body?.context || {};

    if (!events.length) {
      return new Response(JSON.stringify({ recommendation: 'Sin eventos registrados; verifique definición de subtareas y fuentes normativas antes de continuar.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Recortar para token control
    const trimmed = events.slice(-120);
    const timeline = trimmed.map(e => `- [${e.ts}] (${e.type}) ${e.title}${e.detail?`: ${e.detail.replace(/\s+/g,' ').slice(0,240)}`:''}`).join('\n');

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `Actúa como asesor experto en cumplimiento normativo. Debes producir UNA recomendación ejecutiva (<=130 palabras) que:\n1) Liste implícitamente las próximas acciones concretas (separa con punto y seguido).\n2) Destaque la(s) norma(s) / fuente(s) detectadas (cita abreviado: ej. "LGE Art 15", "NOM-XXX", "Ley Federal del Trabajo").\n3) Refuerce urgencia si hay tareas vencidas o proximidad de fecha.\n4) Use lenguaje accionable y profesional, sin viñetas ni enumeraciones explícitas.\n5) Si la tarea ya está completa: enfocarse en verificación documental y archivo de evidencias.\nContexto: descripcion="${ctx.description||''}" categoria="${ctx.category||''}" fuente="${ctx.source||''}".\nHeurística: detecta legislación buscando Ley, Reglamento, Norma, NOM-, Art., Decreto, Código, Resolución en eventos y cítalos.\nCronología (orden temporal):\n${timeline}\nGenera solo el párrafo final.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return new Response(JSON.stringify({ recommendation: text.slice(0, 1200) }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ error: e?.message || 'Error generando recomendación' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
