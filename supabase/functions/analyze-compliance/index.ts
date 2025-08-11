
declare const Deno: any;

// Import compatible con Deno (Supabase Edge Functions) usando specifier npm:
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// --- Configuración de logging controlado por LOG_LEVEL ---
// Niveles: debug < info < warn < error < silent
const LOG_LEVEL = (Deno.env.get('LOG_LEVEL') || 'debug').toLowerCase();
const levelOrder: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const currentLevel = levelOrder[LOG_LEVEL] ?? 10;
const originalLog = console.log.bind(console);
if (currentLevel > levelOrder.debug) {
  console.log = () => {}; // Silenciar logs de nivel debug (los existentes usan console.log)
}
function logInfo(...a: any[]) { if (currentLevel <= levelOrder.info) originalLog('[INFO]', ...a); }
function logWarn(...a: any[]) { if (currentLevel <= levelOrder.warn) console.warn('[WARN]', ...a); }
function logError(...a: any[]) { if (currentLevel <= levelOrder.error) console.error('[ERROR]', ...a); }

// --- Cache ligera en memoria (vive mientras el contenedor esté caliente) ---
interface CacheEntry { ts: number; data: any; }
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_SECONDS = Number(Deno.env.get('CACHE_TTL_SECONDS') || '600'); // por defecto 10 min
async function hashQuery(q: string): Promise<string> {
  const data = new TextEncoder().encode(q.toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Validación básica de JWT (exp y role) ---
const ENFORCE_JWT = (Deno.env.get('ENFORCE_JWT') || 'true').toLowerCase() === 'true';
const ALLOWED_ROLES = (Deno.env.get('ALLOWED_ROLES') || 'anon,authenticated').split(',').map(r => r.trim());
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const json = atob(payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4));
    return JSON.parse(json);
  } catch { return null; }
}

// Define Type enum to use in responseSchema
enum Type {
  OBJECT = "object",
  ARRAY = "array",
  STRING = "string"
}

// Standard CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

// Define the expected JSON schema for the response from Gemini
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "Un resumen conciso del análisis de la normativa solicitada." },
        obligations: {
            type: Type.ARRAY,
            description: "Una lista de obligaciones específicas derivadas de la normativa.",
            items: {
                type: Type.OBJECT,
                properties: {
                    obligation: { type: Type.STRING, description: "Descripción detallada de la obligación." },
                    source: { type: Type.STRING, description: "La ley, artículo o fuente específica de la obligación." },
                    category: { type: Type.STRING, description: "Categoría de la obligación (ej. Laboral, Fiscal, Académica, Protección Civil)." },
                    requiredDocuments: {
                        type: Type.ARRAY,
                        description: "Lista de documentos o evidencias necesarias para cumplir con la obligación.",
                        items: { type: Type.STRING }
                    }
                },
                required: ['obligation', 'source', 'category']
            }
        },
        recommendations: {
            type: Type.ARRAY,
            description: "Acciones o pasos recomendados para asegurar el cumplimiento.",
            items: { type: Type.STRING }
        }
    },
    required: ['summary', 'obligations', 'recommendations']
};

Deno.serve(async (req: Request) => {
  logInfo('[analyze-compliance] Nueva solicitud', req.method, req.url);
  // Handle CORS preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log('[analyze-compliance] Respondiendo preflight OPTIONS');
    return new Response('ok', { headers: corsHeaders });
  }

  // Control de autenticación: se puede desactivar estableciendo DISABLE_AUTH=true en variables de entorno.
  const disableAuth = (Deno.env.get('DISABLE_AUTH') === 'true');
  if (!disableAuth && ENFORCE_JWT) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace(/Bearer\s+/i,'').trim();
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const nowSec = Math.floor(Date.now()/1000);
    if (payload.exp && payload.exp < nowSec) {
      return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (payload.role && !ALLOWED_ROLES.includes(payload.role)) {
      return new Response(JSON.stringify({ error: 'Role not allowed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } else if (disableAuth) {
    logWarn('[analyze-compliance] Auth deshabilitada por DISABLE_AUTH');
  }

  try {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  logInfo('[analyze-compliance] GEMINI_API_KEY presente:', !!apiKey);
    if (!apiKey) {
      console.error("Critical Error: GEMINI_API_KEY environment variable not set.");
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta: falta la API key de Gemini.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Logging de entrada para depuración y parseo robusto
    let query: string | undefined;
    let bodyRaw = '';
    const ct = req.headers.get('content-type') || '';
    const clen = req.headers.get('content-length') || '(sin header)';
  logInfo('[analyze-compliance] content-type:', ct, 'content-length:', clen);
    const urlObj = new URL(req.url);
    const qsQuery = urlObj.searchParams.get('query');
    if (qsQuery) {
  logInfo('[analyze-compliance] query recibida por querystring');
      query = qsQuery;
    }
    if (!query) {
  // (x-query header eliminado para simplificar CORS)
    }
    // Intentar primero req.json() si es JSON
    if (!query && ct.includes('application/json')) {
      try {
        const jsonBody = await req.json();
  logInfo('[analyze-compliance] req.json() keys:', Object.keys(jsonBody || {}));
        bodyRaw = JSON.stringify(jsonBody);
        query = jsonBody?.query;
      } catch (e) {
  logWarn('[analyze-compliance] req.json() falló, fallback a text()', e);
      }
    }
    // Si aún no tenemos body o query, leer como texto
    if (!bodyRaw) {
      try {
        bodyRaw = await req.text();
      } catch (e) {
  logWarn('[analyze-compliance] req.text() falló:', e);
      }
      if (bodyRaw) {
  logInfo('[analyze-compliance] Body texto length:', bodyRaw.length);
        if (!query) {
          try {
            const parsed = JSON.parse(bodyRaw);
            logInfo('[analyze-compliance] Parsed desde texto keys:', Object.keys(parsed || {}));
            query = parsed?.query;
          } catch (e) {
            logWarn('[analyze-compliance] JSON.parse fallo sobre texto, no crítico si ya hay query:', e);
          }
        }
      }
    }
    if (!query) {
      return new Response(
        JSON.stringify({
          error: "No se recibió 'query'. Enviar JSON { query: 'texto' } o parámetro ?query=",
          debug: { ct, clen, bodyPresent: !!bodyRaw, bodySample: bodyRaw.slice(0,120), url: req.url }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!query || typeof query !== 'string' || !query.trim()) {
  logWarn('[analyze-compliance] Query inválida luego de parseo:', query);
      return new Response(
        JSON.stringify({ error: "El campo 'query' es obligatorio y no puede estar vacío." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the prompt and call the Gemini API
    // Cache lookup
    try {
      const key = await hashQuery(query);
      const cached = CACHE.get(key);
      if (cached && (Date.now() - cached.ts)/1000 < CACHE_TTL_SECONDS) {
        logInfo('[analyze-compliance] Sirviendo desde cache');
        return new Response(JSON.stringify(cached.data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } });
      }
    } catch(_cErr) {}
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Eres un asistente experto en cumplimiento normativo educativo en México.
Devuelve EXCLUSIVAMENTE un JSON válido con la forma:
{
  "summary": string,
  "obligations": [
     { "obligation": string, "source": string, "category": string, "requiredDocuments": string[] }
  ],
  "recommendations": string[]
}
Reglas:
1. Incluye de 5 a 10 obligaciones concretas (NO genéricas). Cada obligación debe indicar claramente una acción o requisito verificable.
2. Cada obligación debe tener 2 a 6 elementos en requiredDocuments: evidencias/documentos específicos (ejemplos: "Programa Interno de Protección Civil actualizado 2025", "Bitácora de mantenimiento de extintores", "Reglamento Interno firmado", "Acta de constitución del Comité de Seguridad e Higiene", "Registro de capacitación en primeros auxilios (fecha)"). NO repitas la misma frase genérica.
3. category debe ser una de: "Protección Civil", "Seguridad", "Salud", "Gestión Ambiental", "Gestión Académica", "Seguridad Laboral", u otra breve si ninguna aplica.
4. source debe citar la norma o referencia (ej: "Ley General de Protección Civil Art. X", "NOM-002-STPS-2010", "Lineamientos SEP", etc.).
5. recommendations: 5 a 10 acciones accionables, distintas de las obligaciones, enfocadas en implementación, mejora continua o gobernanza.
6. No incluyas texto fuera del JSON. No uses claves en español distintas a las definidas.
Consulta: "${query}"`;
  logInfo('[analyze-compliance] Prompt length:', prompt.length);

    // Llama a la API de Gemini
    let text = '';
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      text = await response.text();
  logInfo('[analyze-compliance] Respuesta de Gemini length:', text?.length);
    } catch (aiError) {
      console.error('Error al invocar Gemini:', aiError);
      return new Response(
        JSON.stringify({ error: 'Error al invocar el modelo de IA. Intente de nuevo más tarde o revise la configuración de la API key.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Funciones auxiliares para parsing y normalización reutilizable (permiten reintento)
    const parseAiJson = (raw: string) => {
      const tryParse = (candidate: string) => { try { return JSON.parse(candidate); } catch { return null; } };
      let obj = tryParse(raw);
      if (!obj) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) obj = tryParse(match[0]);
      }
      return obj;
    };

    const normalize = (aiObj: any) => {
      const source = aiObj?.query_analysis || aiObj || {};
      const keys = Object.keys(source || {});
      const pickFirst = (...names: string[]) => {
        for (const n of names) if (n in source) return source[n];
        return undefined;
      };
      const obligationsRaw = pickFirst('obligations','key_obligations','obligaciones','obligaciones_clave','obligaciones_principales','items','puntos_clave');
      const recommendationsRaw = pickFirst('recommendations','actionable_recommendations','recomendaciones','sugerencias','acciones_recomendadas');
      const summaryVal = pickFirst('summary','resumen','abstract') || '';
      const obligations: any[] = Array.isArray(obligationsRaw) ? obligationsRaw.map((o: any) => ({
        obligation: o.obligation || o.title || o.titulo || o.descripcion || o.description || '',
        source: o.source || o.fuente || o.origen || '',
        category: o.category || o.categoria || 'General',
        requiredDocuments: o.requiredDocuments || o.documentosRequeridos || o.documentos || []
      })) : [];
      const recommendations: string[] = Array.isArray(recommendationsRaw) ? recommendationsRaw : [];
      return {
        summary: summaryVal,
        obligations,
        recommendations,
        meta: { raw_keys: keys, model: 'gemini-2.5-flash' }
      };
    };

    let aiJson: any = parseAiJson(text);
    if (!aiJson) {
  logWarn('[analyze-compliance] No se pudo parsear JSON inicial, devolviendo salida raw.');
      return new Response(JSON.stringify({ raw_output: text, error: 'AI output not valid JSON' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    let normalized = normalize(aiJson);
    const MIN_OBLIGATIONS = 5;
    const MIN_RECOMMENDATIONS = 5;
    const MIN_DOCS_PER_OBLIGATION = 2;
    const missingDocsCount = normalized.obligations.filter(o => !o.requiredDocuments || o.requiredDocuments.length < MIN_DOCS_PER_OBLIGATION).length;
    const needsRetry = (
      normalized.obligations.length < MIN_OBLIGATIONS ||
      normalized.recommendations.length < MIN_RECOMMENDATIONS ||
      missingDocsCount > Math.floor(normalized.obligations.length / 2)
    );
    if (needsRetry) {
  logInfo('[analyze-compliance] Resultado incompleto (obligations:', normalized.obligations.length, 'recomm:', normalized.recommendations.length, ') intentando reintento con prompt reforzado');
      const reinforcedPrompt = `REINTENTO. Genera SOLO JSON estricto:
{
  "summary": string,
  "obligations": [ { "obligation": string, "source": string, "category": string, "requiredDocuments": string[] } ],
  "recommendations": string[]
}
Requisitos obligatorios:
- 5 a 10 obligaciones.
- Cada obligación con fuente (source) específica (ley, NOM, lineamiento, reglamento) y category breve.
- Cada requiredDocuments: 2 a 6 documentos/evidencias reales y accionables, sin repeticiones triviales (NO usar genéricos como "Documentación de cumplimiento" o "Registros" a secas).
- 5 a 10 recommendations diferentes de obligations, orientadas a implementación, mejora o monitoreo.
- No añadir explicaciones fuera del JSON.
Consulta: "${query}"`;
      try {
        const retryResult = await model.generateContent(reinforcedPrompt);
        const retryResponse = await retryResult.response;
        const retryText = await retryResponse.text();
        const retryJson = parseAiJson(retryText);
        if (retryJson) {
          const retryNorm = normalize(retryJson);
          if (retryNorm.obligations.length >= normalized.obligations.length && retryNorm.recommendations.length >= normalized.recommendations.length) {
            logInfo('[analyze-compliance] Reintento mejoró resultados');
            normalized = retryNorm;
          } else {
            logInfo('[analyze-compliance] Reintento no mejoró, se mantiene versión inicial');
          }
        } else {
          logWarn('[analyze-compliance] JSON del reintento inválido, se mantiene versión inicial');
        }
      } catch (retryErr) {
  logWarn('[analyze-compliance] Error durante reintento IA:', retryErr);
      }
    }
  logInfo('[analyze-compliance] Enviando respuesta OK normalizada obligaciones:', normalized.obligations.length, 'recomendaciones:', normalized.recommendations.length);
  // Cache store
  try { const key = await hashQuery(query); CACHE.set(key, { ts: Date.now(), data: normalized }); } catch(_s) {}
    return new Response(JSON.stringify(normalized), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    // Generic error handler for cualquier otro fallo
    const isClientError = error instanceof SyntaxError;
    const status = isClientError ? 400 : 500;
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado en el servidor.';
    console.error(`Function error in 'analyze-compliance' (Status: ${status}):`, errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
