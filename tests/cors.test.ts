import { describe, it, expect } from 'vitest';
import { buildCorsHeaders, buildCorsHeadersForRequest } from '../supabase/functions/_shared/cors';

describe('buildCorsHeaders', () => {
  it('returns wildcard by default', () => {
    const original = process.env.ALLOWED_ORIGIN;
    delete process.env.ALLOWED_ORIGIN;
    const h = buildCorsHeaders();
    expect(h['Access-Control-Allow-Origin']).toBe('*');
    process.env.ALLOWED_ORIGIN = original;
  });
  it('respects ALLOWED_ORIGIN from process.env', () => {
    process.env.ALLOWED_ORIGIN = 'http://example.com';
    const h = buildCorsHeaders();
    expect(h['Access-Control-Allow-Origin']).toBe('http://example.com');
    delete process.env.ALLOWED_ORIGIN;
  });
  it('merges extra headers', () => {
    const h = buildCorsHeaders({ 'X-Test': 'yes' });
    expect(h['X-Test']).toBe('yes');
  });
  it('per-request echo of matching origin when ALLOWED_ORIGIN has multiple', () => {
    process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
    const req = new Request('http://x', { headers: { origin: 'http://localhost:5173', 'access-control-request-headers': 'content-type', 'access-control-request-method': 'POST' } });
    const h = buildCorsHeadersForRequest(req);
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(h['Vary']).toBe('Origin');
    expect(h['Access-Control-Allow-Headers']).toContain('content-type');
    delete process.env.ALLOWED_ORIGIN;
  });
});
