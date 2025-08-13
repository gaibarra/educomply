import { supabase } from './supabaseClient';

interface SubtaskSuggestionResponse {
  subTasks: string[];
}

// Minimal invoke helper scoped to subtasks functions
const invokeFunction = async <T>(functionName: string, body: any): Promise<T> => {
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
  // First try invoke (handles CORS)
  const { data, error } = await supabase.functions.invoke<T>(functionName, { body, headers });
  if (!error) return data;

  // If we see invalid refresh token or 401/400, retry with anon token only
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('invalid refresh token') || msg.includes('jwt') || msg.includes('401') || msg.includes('400')) {
    try {
      const h2 = { ...headers, Authorization: `Bearer ${anonKey}` };
      const { data: d2, error: e2 } = await supabase.functions.invoke<T>(functionName, { body, headers: h2 });
      if (!e2) return d2;
    } catch { /* ignore */ }
  }

  // Manual fetch fallback with query redundancy (for gateways returning 400 when body parsing fails)
  try {
    const supaUrl = (supabase as any).supabaseUrl || '';
    const url = `${supaUrl.replace(/\/$/,'')}/functions/v1/${functionName}`;
    const qp = new URLSearchParams();
    if (body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) qp.set(k, String(v));
      }
    }
    const urlWithParams = qp.toString() ? `${url}?${qp.toString()}` : url;
    const res = await fetch(urlWithParams, { method: 'POST', headers, body: JSON.stringify(body) });
    const txt = await res.text();
    if (!res.ok) throw new Error(`Status ${res.status} ${txt.slice(0,200)}`);
    return JSON.parse(txt) as T;
  } catch (fallbackErr: any) {
    if (String(fallbackErr?.message || '').includes('Failed to send a request')) {
      throw new Error(`Error de red al invocar la función '${functionName}'. Verifique CORS y disponibilidad.`);
    }
    throw new Error(`Error al invocar la función '${functionName}': ${fallbackErr?.message || error.message}`);
  }
};

export const getSubTaskSuggestions = async (obligation: string, category: string): Promise<string[]> => {
  const response = await invokeFunction<SubtaskSuggestionResponse>('suggest-subtasks', { obligation, category });
  if (response && Array.isArray(response.subTasks)) {
    return response.subTasks;
  }
  console.warn("Suggest-subtasks function returned a response without a 'subTasks' array.", response);
  return [];
};

export default {
  getSubTaskSuggestions,
};
