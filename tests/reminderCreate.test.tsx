import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import ComplianceItemCard from '../components/ComplianceItemCard';
import { ToastProvider } from '../components/ToastProvider';

// Mock supabase client used indirectly by remindersService
vi.mock('../services/remindersService', () => ({
  createReminder: vi.fn(async () => ({ id: 'r1', remind_at: '2025-12-01T09:00:00Z' }))
}));

vi.stubGlobal('CustomEvent', class extends Event { constructor(name: string, params?: any){ super(name); (this as any).detail = params?.detail; }} as any);

// Minimal localStorage mock
const store: Record<string,string> = {}; // not used after backend persistence but kept
vi.stubGlobal('localStorage', {
  getItem: (k:string)=>store[k]||null,
  setItem: (k:string,v:string)=>{store[k]=v;},
  removeItem: (k:string)=>{delete store[k];},
  clear: ()=>{Object.keys(store).forEach(k=>delete store[k]);}
});

describe('Recordatorio (backend)', () => {
  beforeEach(()=>{
    Object.keys(store).forEach(k=>delete store[k]);
  });
  it('crea recordatorio y dispara evento reminders:changed', async () => {
    const item = { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Obligación Test', category: 'Académica', authority: 'SEP', dueDate: '1 dic 2025', status: 'Pendiente' as const, rawDueISO: '2025-12-01' };
    const handler = vi.fn();
    window.addEventListener('reminders:changed', handler as any);
    render(<ToastProvider><ComplianceItemCard item={item} /></ToastProvider>);
    // abrir menú
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    const btn = screen.getByText('Programar recordatorio');
    fireEvent.click(btn);
    // Esperar a que el toast aparezca
    await screen.findByText(/Recordatorio guardado/);
    expect(handler).toHaveBeenCalled();
  });
});
