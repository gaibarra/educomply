// Ambient declaration to satisfy TS in local dev for Deno npm specifier used in Edge Function.
declare module 'npm:@google/generative-ai' {
  export * from '@google/generative-ai';
}
