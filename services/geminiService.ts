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
const invokeFunction = async (functionName: string, body: any) => {
    const anonKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || (process as any)?.env?.VITE_SUPABASE_ANON_KEY || '';
    let accessToken: string | undefined;
    try {
        const session = await (supabase as any).auth?.getSession?.();
        accessToken = session?.data?.session?.access_token;
    } catch { /* ignore */ }
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${accessToken || anonKey}`,
    };
    // Para analyze-compliance añadimos redundancia de transporte de 'query' para evitar casos donde el body llegue vacío
    // Supabase JS hoy no permite pasar querystring directo en invoke, así que hacemos una ruta manual SOLO para analyze-compliance
    if (functionName === 'analyze-compliance' && body?.query) {
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
    console.warn(`[invokeFunction] invoke() fallo para ${functionName}:`, error.message);
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

export const getComplianceAnalysis = async (query: string): Promise<AiComplianceResponse> => {
    console.log('Valor de query enviado a analyze-compliance:', query);
    try {
    const response = await invokeFunction('analyze-compliance', { query });
        let shaped: any = response;
        if (response && typeof response === 'object' && 'query_analysis' in response) {
            shaped = (response as any).query_analysis;
        }
        if (!shaped || typeof shaped !== 'object' || !('summary' in shaped) || !('obligations' in shaped)) {
            throw new Error('Respuesta inválida de analyze-compliance');
        }
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
                body: JSON.stringify({ query })
            });
            const text = await res.text();
            if (!res.ok) {
                console.error('Fallback status', res.status, 'body:', text);
                throw new Error(`Fallback analyze-compliance status ${res.status}`);
            }
            let json: any;
            try { json = JSON.parse(text); } catch { throw new Error('Fallback devolvió JSON inválido'); }
            let shaped: any = json;
            if (json && typeof json === 'object' && 'query_analysis' in json) {
                shaped = json.query_analysis;
            }
            if (!shaped || typeof shaped !== 'object' || !('summary' in shaped) || !('obligations' in shaped)) {
                console.error('Fallback JSON inesperado keys:', Object.keys(json || {}));
                throw new Error('Respuesta inválida (fallback) de analyze-compliance');
            }
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


export const getAuditPlanSuggestion = async (description: string): Promise<AiAuditPlanSuggestion> => {
    const response: any = await invokeFunction('suggest-audit-plan', { description });
    const candidate = response?.plan || response?.data || response;
    if (!candidate || typeof candidate !== 'object' || !candidate.name) {
        throw new Error("Respuesta inválida de suggest-audit-plan");
    }
    return {
        name: candidate.name,
        scope_level: candidate.scope_level || candidate.scopeLevel || 'General',
        scope_entity: candidate.scope_entity || candidate.scopeEntity || ''
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