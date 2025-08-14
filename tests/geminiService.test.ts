import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client minimal surface
vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } })
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { query_analysis: { summary: 'ok', obligations: [], recommendations: [] } }, error: null })
    }
  }
}));

// Provide import.meta.env shim
// Provide env shim
process.env.VITE_SUPABASE_ANON_KEY = 'anon';

import { getComplianceAnalysis } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

describe('getComplianceAnalysis', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns shaped response from direct invoke', async () => {
  (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { query_analysis: { summary: 'ok', obligations: [], recommendations: [] } }, error: null });
  // stub fetch to avoid invalid relative URL error if manual path is attempted
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query_analysis: { summary: 'ok', obligations: [], recommendations: [] } }) } as any);
  const result = await getComplianceAnalysis('plain');
    expect(result.summary).toBe('ok');
    expect(Array.isArray(result.obligations)).toBe(true);
  });

  it('fallbacks to manual fetch when invoke first path fails', async () => {
    // First invocation path will throw; then manual fetch path should succeed
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: { message: 'Failed to send a request' } });

    // Mock fetch for fallback
    const json = { query_analysis: { summary: 'fallback', obligations: [], recommendations: [] } };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => json } as any);

    const result = await getComplianceAnalysis('query');
    expect(result.summary).toBe('fallback');
  });

  it('passes temperature parameter', async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { query_analysis: { summary: 'temp-ok', obligations: [], recommendations: [] } }, error: null });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    const result = await getComplianceAnalysis('test', 0.75);
    expect(result.summary).toBe('temp-ok');
    const callArgs = (supabase.functions.invoke as any).mock.calls[0];
    expect(callArgs[0]).toBe('analyze-compliance');
    expect(callArgs[1].body.temperature).toBeCloseTo(0.75, 5);
  });
});
