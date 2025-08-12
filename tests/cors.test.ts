import { describe, it, expect } from 'vitest';
import { buildCorsHeaders } from '../supabase/functions/_shared/cors';

describe('buildCorsHeaders', () => {
  it('returns wildcard by default', () => {
    const h = buildCorsHeaders();
    expect(h['Access-Control-Allow-Origin']).toBe('*');
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
});
