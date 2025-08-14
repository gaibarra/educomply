import { describe, it, expect } from 'vitest';
import * as gemini from '../services/geminiService';

// Mock invokeFunction internals by spying on exported getAuditPlanSuggestion dependencies.

// We'll monkey patch the internal invokeFunction via module mocking pattern.

describe('geminiParsing / getAuditPlanSuggestion parsing robustness', () => {
  // Dynamic import to access non-exported logic indirectly by faking network layer
  it('geminiParsing parses prefixed json block with titulo', async () => {
    const sample = 'json { "plan": { "titulo": "Auditoría de Cumplimiento de Cont", "scope_level": "Campus", "scope_entity": "Norte" } }';
    gemini.__setInvokeFunctionMock(async () => sample);
    const res = await gemini.getAuditPlanSuggestion('desc');
    expect(res.name).toMatch(/Auditoría de Cumplimiento de Cont/);
    expect(res.scope_level).toBe('Campus');
    gemini.__setInvokeFunctionMock(null);
  });

  it('geminiParsing falls back when plain string', async () => {
    const sample = 'Plan Auditoría Seguridad Laboral';
    gemini.__setInvokeFunctionMock(async () => sample);
    const res = await gemini.getAuditPlanSuggestion('desc');
    expect(res.name.toLowerCase()).toContain('plan auditoría');
    gemini.__setInvokeFunctionMock(null);
  });
});
