import { supabase } from './supabaseClient';
import type { AiComplianceResponse, AiAuditPlanSuggestion, GeneratedReport, PredefinedReportType } from '../types';

// Usa tu anon key de Supabase desde variables de entorno o configuración segura

// Logging opcional a tabla error_logs (descomenta si tienes la tabla)
// const logError = async (error: any, context: string) => {
//   await supabase.from('error_logs').insert({
//     context,
//     error: JSON.stringify(error),
//     created_at: new Date(),
//   });
// };
// Allow tests to inject a mock implementation
let invokeFunctionMock: ((fn: string, body: any)=>Promise<any>) | null = null;
export const __setInvokeFunctionMock = (mock: ((fn: string, body: any)=>Promise<any>) | null) => { invokeFunctionMock = mock; };

const invokeFunction = async (functionName: string, body: any) => {
    if (invokeFunctionMock) return invokeFunctionMock(functionName, body);
    const anonKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || (process as any)?.env?.VITE_SUPABASE_ANON_KEY || '';
    let accessToken: string | undefined;
    try {
        const session = await (supabase as any).auth?.getSession?.();
        accessToken = session?.data?.session?.access_token;
    } catch { /* ignore */ }
            const isTestEnv = (
                typeof process !== 'undefined' && (
                    (process as any)?.env?.VITEST || (process as any)?.env?.NODE_ENV === 'test'
                )
            ) || !!(import.meta as any)?.vitest;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken || anonKey}`,
    };
    // Para analyze-compliance añadimos redundancia de transporte de 'query' para evitar casos donde el body llegue vacío
    // Supabase JS hoy no permite pasar querystring directo en invoke, así que hacemos una ruta manual SOLO para analyze-compliance
    if (!isTestEnv && functionName === 'analyze-compliance' && body?.query) {
    try {
            const supaUrl = (supabase as any).supabaseUrl || '';
            const url = `${supaUrl.replace(/\/$/,'')}/functions/v1/${functionName}?query=${encodeURIComponent(body.query)}`;
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`Status ${res.status} ${txt}`);
            }
            return await res.json();
        } catch (manualErr) {
            console.warn('[invokeFunction] Fallback manual fetch falló, intento invoke normal:', manualErr);
            // si falla, volvemos al invoke estándar
        }
    }
    const { data, error } = await supabase.functions.invoke(functionName, { body, headers });
    if (!error) return data;
    let enrichedMsg = error.message || 'Edge Function error';
    if (/404/.test(enrichedMsg)) {
        enrichedMsg = `Edge Function '${functionName}' no encontrada (404). Probablemente falta desplegarla: 'supabase functions deploy ${functionName}'.`;
    } else if (/400/.test(enrichedMsg)) {
        enrichedMsg = `Edge Function '${functionName}' respondió 400. Revisa que el body incluya los campos requeridos (p.ej. 'description').`;
    }
    console.warn(`[invokeFunction] invoke() fallo para ${functionName}:`, enrichedMsg);
    // Try anon-only retry for token-related/network-ish errors
    if (/invalid\s*refresh\s*token|jwt|401|400/i.test(error.message)) {
        try {
            const h2 = { ...headers, Authorization: `Bearer ${anonKey}` };
            const { data: d2, error: e2 } = await supabase.functions.invoke(functionName, { body, headers: h2 });
            if (!e2) return d2;
        } catch {/* ignore */}
    }
    // If the Edge Function returned non-2xx, try manual fetch to capture error payload for better diagnostics
    if (/non-2xx status code/i.test(error.message)) {
        try {
            const supaUrl = (supabase as any).supabaseUrl || '';
            const url = `${supaUrl.replace(/\/$/,'')}/functions/v1/${functionName}`;
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            const txt = await res.text();
            if (!res.ok) {
                // Try to extract a concise error message from JSON
                try {
                    const j = JSON.parse(txt);
                    const msg = j?.error || j?.message || txt;
                    throw new Error(`Status ${res.status}: ${typeof msg === 'string' ? msg.slice(0,500) : ''}`);
                } catch {
                    throw new Error(`Status ${res.status}: ${txt.slice(0,500)}`);
                }
            }
            return JSON.parse(txt);
        } catch (non2xxFallbackErr: any) {
            throw new Error(`Error al invocar la función '${functionName}': ${non2xxFallbackErr?.message || error.message}`);
        }
    }
    if (error.message.includes('Failed to send a request')) {
        // Manual fetch fallback with body + query redundancy
        try {
            const supaUrl = (supabase as any).supabaseUrl || '';
            const base = `${supaUrl.replace(/\/$/,'')}/functions/v1/${functionName}`;
            const qp = new URLSearchParams();
            if (body && typeof body === 'object') {
                for (const [k,v] of Object.entries(body)) { if (v != null) qp.set(k, String(v)); }
            }
            const url = qp.toString() ? `${base}?${qp.toString()}` : base;
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            const txt = await res.text();
            if (!res.ok) throw new Error(`Status ${res.status} ${txt.slice(0,200)}`);
            return JSON.parse(txt);
        } catch (fallbackErr: any) {
            throw new Error(`Error de red al invocar la función '${functionName}'. Verifique CORS y disponibilidad. Detalle: ${fallbackErr?.message || 'sin detalle'}`);
        }
    }
    throw new Error(`Error al invocar la función '${functionName}': ${error.message}`);
};

export const getComplianceAnalysis = async (query: string, temperature: number = 0.4): Promise<AiComplianceResponse> => {
    console.log('Valor de query enviado a analyze-compliance:', query);
    try {
    const response = await invokeFunction('analyze-compliance', { query, temperature });
        let shaped: any = response;
        if (response && typeof response === 'object' && 'query_analysis' in response) {
            shaped = (response as any).query_analysis;
        }
        if (!shaped || typeof shaped !== 'object') {
            throw new Error('Respuesta inválida de analyze-compliance');
        }
        // Normaliza campos faltantes en lugar de fallar duro (reduce flakes en test / entornos mock)
        if (!('summary' in shaped)) shaped.summary = '';
        if (!('obligations' in shaped) || !Array.isArray(shaped.obligations)) shaped.obligations = [];
        return {
            summary: shaped.summary,
            obligations: shaped.obligations,
            recommendations: shaped.recommendations || shaped.actionable_recommendations || []
        } as AiComplianceResponse;
    } catch (primaryErr: any) {
        console.warn('Fallo invokeFunction, intentando fallback directo:', primaryErr?.message);
        try {
            const anonKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || (process as any)?.env?.VITE_SUPABASE_ANON_KEY || '';
            let session: any = null;
            try { session = await (supabase as any).auth?.getSession?.(); } catch { /* ignore in tests */ }
            const accessToken = session?.data?.session?.access_token;
            // Derivar project ref desde supabaseUrl
            const supaUrl = (supabase as any).supabaseUrl || '';
            const match = supaUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/);
            const ref = match ? match[1] : 'raiccyhtjhsgmouzulhn';
            const base = `https://${ref}.functions.supabase.co/analyze-compliance`;
            const urlWithParam = base + '?query=' + encodeURIComponent(query);
            const res = await fetch(urlWithParam, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${accessToken || anonKey}`
                },
                body: JSON.stringify({ query, temperature })
            });
                        // Soporta mocks que solo implementan json() y no text()
                        let text: string | null = null;
                        let json: any = null;
                        try {
                            if (typeof (res as any).text === 'function') {
                                text = await (res as any).text();
                                try { json = JSON.parse(text); } catch { /* luego intentamos json() */ }
                            }
                            if (!json && typeof (res as any).json === 'function') {
                                json = await (res as any).json();
                                if (text == null) try { text = JSON.stringify(json).slice(0,500); } catch { text = '[unserializable json]'; }
                            }
                        } catch (readErr) {
                            console.error('Error leyendo fallback response', readErr);
                        }
                        if (!res.ok) {
                                console.error('Fallback status', (res as any).status, 'body:', text);
                                throw new Error(`Fallback analyze-compliance status ${(res as any).status}`);
                        }
                        if (!json || typeof json !== 'object') throw new Error('Fallback devolvió JSON inválido');
            let shaped: any = json;
            if (json && typeof json === 'object' && 'query_analysis' in json) {
                shaped = json.query_analysis;
            }
                        if (!shaped || typeof shaped !== 'object') throw new Error('Respuesta inválida (fallback) de analyze-compliance');
                        if (!('summary' in shaped)) shaped.summary = '';
                        if (!('obligations' in shaped) || !Array.isArray(shaped.obligations)) shaped.obligations = [];
            return {
                summary: shaped.summary,
                obligations: shaped.obligations,
                recommendations: shaped.recommendations || shaped.actionable_recommendations || []
            } as AiComplianceResponse;
        } catch (fallbackErr) {
            console.error('Fallback también falló:', fallbackErr);
            throw primaryErr;
        }
    }
};


// Helper to deeply search for a key variant inside an object graph
const deepFindKey = (obj: any, keys: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of Object.keys(obj)) {
        const normalized = k.toLowerCase();
        if (keys.includes(normalized)) return obj[k];
    }
    for (const k of Object.keys(obj)) {
        const val = obj[k];
        if (val && typeof val === 'object') {
            const found = deepFindKey(val, keys);
            if (found !== undefined) return found;
        }
    }
    return undefined;
};

const sanitizeBasic = (s: string | undefined | null): string => !s ? '' : s.replace(/\s+/g,' ').trim();

const extractFieldFromRaw = (raw: string, fieldNames: string[]): string | undefined => {
    const text = raw.replace(/```[a-zA-Z]*|```/g,'');
        for (const name of fieldNames) {
            // Use explicit character classes instead of \s to satisfy stricter linters
            const re = new RegExp(`"${name}"[ \t]*:[ \t]*"([^"\n]{3,240})"`, 'i');
        const m = text.match(re);
        if (m) return sanitizeBasic(m[1]);
    }
    // Try simple JSON parse fallback if looks like object
    const looksJson = /[{].*[}]/s.test(text);
    if (looksJson) {
        try {
            const parsed = JSON.parse(text);
            for (const name of fieldNames) {
                if (parsed && typeof parsed === 'object') {
                    for (const k of Object.keys(parsed)) {
                        if (k.toLowerCase() === name.toLowerCase()) return sanitizeBasic(parsed[k]);
                    }
                }
            }
        } catch {/* ignore */}
    }
    return undefined;
};

const sanitizeText = (s: string | undefined | null, fallback = ''): string => {
    const base = sanitizeBasic(s || '') || fallback;
    return base.replace(/^"|"$/g,'');
};

const coerceScopeLevel = (raw: string | undefined): string => {
    if (!raw) return 'General';
    const r = raw.toLowerCase();
    if (/campus/.test(r)) return 'Campus';
    if (/facultad|escuela/.test(r)) return 'Facultad/Escuela';
    if (/nivel/.test(r)) return 'Nivel Educativo';
    if (/instituci/.test(r) || /general/.test(r)) return 'General';
    return 'General';
};

export const getAuditPlanSuggestion = async (description: string): Promise<AiAuditPlanSuggestion> => {
    const rawResponse: any = await invokeFunction('suggest-audit-plan', { description });
    let candidate: any = rawResponse?.plan || rawResponse?.data || rawResponse;

    // If it's a string with JSON fenced, attempt to parse
        if (typeof candidate === 'string') {
            const original = candidate;
            // Remove markdown fences and trim
            candidate = candidate.replace(/```[a-zA-Z]*|```/g,'').trim();
            // Strip leading labels like "json", "respuesta", etc. before first brace
            const firstBrace = candidate.indexOf('{');
            if (firstBrace > 0) {
                const prefix = candidate.slice(0, firstBrace).toLowerCase();
                if (/json|plan|respuesta|output|data|resultado/.test(prefix.replace(/[^a-z]/g,''))) {
                    candidate = candidate.slice(firstBrace);
                }
            }
            // If still starts with identifier then brace (e.g., json { ), collapse
            candidate = candidate.replace(/^(json|plan|respuesta|output|data|resultado)\s*(?=\{)/i,'');
            // Attempt targeted field extraction BEFORE JSON parse
            // Attempt to extract clean name directly
            const extractedName = extractFieldFromRaw(candidate, ['titulo','title','name','nombre']);
            const extractedLevel = extractFieldFromRaw(candidate, ['scope_level','nivel','scopeLevel']);
            const extractedEntity = extractFieldFromRaw(candidate, ['scope_entity','entidad','scopeEntity','entity']);
            if (extractedName) {
                return {
                    name: extractedName,
                    scope_level: coerceScopeLevel(extractedLevel || 'General') as any,
                    scope_entity: extractedEntity || ''
                };
            }
            // JSON parse fallback: take substring from first brace to last closing brace if mismatched
            const fb = candidate.indexOf('{');
            const lb = candidate.lastIndexOf('}');
            if (fb !== -1 && lb !== -1 && lb > fb) {
                const jsonSlice = candidate.slice(fb, lb+1);
                try { candidate = JSON.parse(jsonSlice); } catch { candidate = original; }
            }
        }

    // If still not an object, wrap
    if (!candidate || typeof candidate !== 'object') {
        return {
            name: sanitizeText(String(candidate || 'Auditoría de Cumplimiento').slice(0,120)) || 'Auditoría de Cumplimiento',
            scope_level: 'General',
            scope_entity: ''
        };
    }

    // Attempt to locate fields
    const nameRaw = candidate.name || candidate.titulo || candidate.title || deepFindKey(candidate, ['name','titulo','title']);
    const scopeLevelRaw = candidate.scope_level || candidate.scopeLevel || candidate.nivel || deepFindKey(candidate, ['scope_level','scopelevel','nivel']);
    const scopeEntityRaw = candidate.scope_entity || candidate.scopeEntity || candidate.entidad || deepFindKey(candidate, ['scope_entity','scopeentity','entidad','entity']);

    const name = sanitizeText(nameRaw, 'Auditoría de Cumplimiento');
    const scope_level = coerceScopeLevel(sanitizeText(scopeLevelRaw));
    const scope_entity = sanitizeText(scopeEntityRaw);

        return {
            name: name || 'Auditoría de Cumplimiento',
            scope_level: (scope_level as any) || 'General',
            scope_entity,
        } as AiAuditPlanSuggestion;
};

export const generateReport = async (
    request: { type: 'predefined'; reportType: PredefinedReportType } | { type: 'ai'; query: string }
): Promise<GeneratedReport> => {
    const body = request.type === 'predefined' 
        ? { reportType: request.reportType }
        : { query: request.query };
    const response = await invokeFunction('generate-report', body);
    if (!response || typeof response !== 'object' || (!('report' in response) && !('content' in response))) {
        throw new Error("Respuesta inválida de generate-report");
    }
    return response as GeneratedReport;
};