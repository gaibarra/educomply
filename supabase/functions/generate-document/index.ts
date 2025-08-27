// Edge Function: generate-document
// Generates an authentic AI-crafted compliance document based on a requested document name and task context.
// Returns structured content plus cited sources (model-generated). No external crawling performed.

// deno-lint-ignore-file no-explicit-any
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
// @ts-ignore: Deno global for edge runtime
declare const Deno: any;

const LOG_LEVEL = (Deno.env.get('LOG_LEVEL') || 'info').toLowerCase();
const levelOrder: Record<string, number> = { debug:10, info:20, warn:30, error:40, silent:100 };
const currentLevel = levelOrder[LOG_LEVEL] ?? 20;
const log = (lvl: keyof typeof levelOrder, ...a:any[]) => { if (currentLevel <= levelOrder[lvl]) console.log(`[${lvl.toUpperCase()}]`, ...a); };

// No se usa el helper de CORS compartido para que la lógica sea más clara y autocontenida.

interface GenDocRequest {
  docName: string;
  taskDescription?: string;
  category?: string;
  source?: string;
  language?: 'es' | 'en';
}

function decodeJwt(token:string){
  try { const p = token.split('.')[1]; return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));} catch { return null; }
}

Deno.serve(async (req: Request) => {
  const requestOrigin = req.headers.get('origin') || '';

  // --- Manejo de CORS ---
  // Esta lógica es crucial para el desarrollo local, donde el puerto del frontend
  // (p. ej., 5173, 5175) puede ser diferente del configurado en las variables de entorno.
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '';
  if (allowedOrigin === '*') {
    corsHeaders['Access-Control-Allow-Origin'] = '*';
  } else if (requestOrigin.includes('localhost')) {
    // Para desarrollo local, siempre se hace eco del origen para evitar problemas de puertos.
    corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
  } else if (allowedOrigin) {
    // Para producción, se usa el origen específico configurado.
    corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  if (req.method === 'OPTIONS') {
    log('debug', '[generate-document] Preflight OPTIONS recibido, respondiendo con cabeceras:', corsHeaders);
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({error:'Use POST'}),{status:405,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  const disableAuth = (Deno.env.get('DISABLE_AUTH') || 'false').toLowerCase()==='true';
  let payload = null as any;
  if (!disableAuth) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({error:'Missing authorization header'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
    payload = decodeJwt(authHeader.replace(/Bearer\s+/i,''));
    if (!payload) return new Response(JSON.stringify({error:'Invalid JWT'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
  } else {
    log('warn','[generate-document] Auth deshabilitada por DISABLE_AUTH');
  }

  let body: GenDocRequest | null = null;
  try { body = await req.json(); } catch { /* ignore */ }
  if (!body || !body.docName) {
    return new Response(JSON.stringify({error:"Se requiere 'docName'"}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
  const { docName, taskDescription='', category='', source='', language='es' } = body;
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({error:'Servidor sin configuración IA'}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Eres un asistente experto en cumplimiento educativo y normativo en México.
Genera el contenido COMPLETO y profesional para el documento: "${docName}".
Contexto de la tarea / obligación: "${taskDescription}".
Categoría: ${category || 'General'}
Fuente principal citada (si se proporcionó): ${source || 'No específica'}

Formato de salida: Devuelve SOLO JSON válido con la forma:
{
  "filename": string, // nombre sugerido (sin espacios raros) con extension .md
  "title": string,
  "summary": string, // resumen ejecutivo de 3-5 líneas
  "body_markdown": string, // contenido completo en Markdown organizado en secciones
  "sources": [ { "citation": string, "url": string | null } ],
  "disclaimer": string // nota aclaratoria de uso y verificación
}
Reglas:
1. El body_markdown debe incluir secciones: Introducción, Fundamento Legal, Requisitos / Contenido, Procedimiento, Responsables, Evidencias / Registros, Control de Versiones.
2. Usa listas y tablas Markdown cuando sea útil.
3. Cita normas oficiales (Ley General de Educación, acuerdos, NOM aplicables) solo si pertinentes; NO inventes códigos inexistentes. Si no estás seguro, marca la fuente como "(verificación manual)".
4. Incluye fuentes con URLs oficiales (sep.gob.mx, dof.gob.mx, gob.mx, stps.gob.mx) SI conoces la ruta general; si no, pon url null.
5. No añadas explicación fuera del JSON.
Idioma: ${language === 'en' ? 'English' : 'Español'}.
`;

  let text='';
  try {
    const result = await model.generateContent(prompt);
    text = await result.response.text();
    log('info','[generate-document] AI raw length', text.length);
  } catch (e) {
    log('error','AI error', e);
    return new Response(JSON.stringify({error:'Fallo al generar documento'}),{status:502,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  const tryParse = (raw: string) => {
    try { return JSON.parse(raw); } catch { /* continue to heuristics */ }
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* ignore */ }
    }
    return null;
  };

  // Strip common fenced code blocks and attempt parsing
  const stripped = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  let json: any = tryParse(stripped) || null;
  if (!json) {
    const mJsonFence = text.match(/```json\s*([\s\S]*?)```/i);
    if (mJsonFence) json = tryParse(mJsonFence[1]);
  }
  if (!json) json = tryParse(text);

  // If the model returned markdown-like text (no JSON), accept it as body_markdown
  const looksLikeMarkdown = /(^\s?#\s+|^\s?##\s+|\bIntroducci[oó]n\b|\bFundamento\b|\bProcedimiento\b)/im.test(text);
  if (!json && looksLikeMarkdown) {
    const filenameSafe = docName.toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') + '.md';
    const response = {
      filename: filenameSafe,
      title: docName,
      summary: '',
      body_markdown: stripped.trim() || text.trim(),
      sources: [],
      disclaimer: 'Este documento es generado por IA y debe ser validado contra fuentes oficiales antes de su uso formal.'
    };
    return new Response(JSON.stringify(response),{status:200,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  // Map alternative fields to body_markdown if present
  if (json && !json.body_markdown) {
    json.body_markdown = json.body || json.markdown || json.content || json.text || null;
  }

  if (!json || !json.body_markdown) {
    return new Response(JSON.stringify({error:'Salida IA inválida', raw:text.slice(0,4000)}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }

  const filenameSafe = (json.filename || docName).toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'') + '.md';
  const response = {
    filename: filenameSafe,
    title: json.title || docName,
    summary: json.summary || '',
    body_markdown: json.body_markdown,
    sources: Array.isArray(json.sources) ? json.sources.slice(0,10) : [],
    disclaimer: json.disclaimer || 'Este documento es generado por IA y debe ser validado contra fuentes oficiales antes de su uso formal.'
  };
  // Debug: log cors headers when in debug level to help verify CORS during dev
  if (currentLevel <= levelOrder.debug) log('debug','[generate-document] returning with CORS headers', corsHeaders);
  return new Response(JSON.stringify(response),{status:200,headers:{...corsHeaders,'Content-Type':'application/json'}});
});
