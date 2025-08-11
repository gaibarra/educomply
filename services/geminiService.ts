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
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
    };
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    } else {
        headers['Authorization'] = `Bearer ${anonKey}`;
    }
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
    if (error) {
        console.error(`Error invoking Supabase function ${functionName}:`, error);
        // await logError(error, functionName); // Descomenta si usas logging
        if (error.message.includes('Failed to send a request')) {
            throw new Error(`Error de red al invocar la función '${functionName}'. Verifique CORS y disponibilidad.`);
        }
        throw new Error(`Error al invocar la función '${functionName}': ${error.message}`);
    }
    return data;
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
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const session = await supabase.auth.getSession();
            const accessToken = session.data.session?.access_token;
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

export const getSubTaskSuggestions = async (obligation: string, category: string): Promise<string[]> => {
    const response = await invokeFunction('suggest-subtasks', { obligation, category });
    if (response && Array.isArray(response.subTasks)) {
        return response.subTasks;
    }
    console.warn("Suggest-subtasks function returned a response without a 'subTasks' array.", response);
    return [];
};

export const getAuditPlanSuggestion = async (description: string): Promise<AiAuditPlanSuggestion> => {
    const response = await invokeFunction('suggest-audit-plan', { description });
    if (!response || typeof response !== 'object' || !('plan' in response)) {
        throw new Error("Respuesta inválida de suggest-audit-plan");
    }
    return response as AiAuditPlanSuggestion;
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