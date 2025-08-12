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

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
import { buildCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = buildCorsHeaders({ 'Access-Control-Allow-Methods': 'POST,OPTIONS' });

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
  if (req.method === 'OPTIONS') {
    log('debug','[generate-document] Preflight OPTIONS recibido');
    return new Response('ok',{headers:corsHeaders});
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

  const tryParse = (raw:string)=>{ try { return JSON.parse(raw); } catch { const m=raw.match(/\{[\s\S]*\}/); if(m) { try { return JSON.parse(m[0]); } catch { return null; } } return null; }; };
  const json = tryParse(text);
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
  return new Response(JSON.stringify(response),{status:200,headers:{...corsHeaders,'Content-Type':'application/json'}});
});
