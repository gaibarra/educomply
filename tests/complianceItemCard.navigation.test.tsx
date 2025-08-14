import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import ComplianceItemCard from '../components/ComplianceItemCard';
import { ToastProvider } from '../components/ToastProvider';

describe('ComplianceItemCard navigation', () => {
  it('dispatches app:navigate with view tareas and query', () => {
    const item = { id: '123', name: 'Obligación Prueba', category: 'Académica', authority: 'SEP', dueDate: '2025-12-01', status: 'Pendiente' as const };
    const handler = vi.fn();
    window.addEventListener('app:navigate', handler as any);
    const { getByRole } = render(
      <ToastProvider>
        <ComplianceItemCard item={item} />
      </ToastProvider>
    );
  // open menu (first menu trigger svg parent button)
  const trigger = getByRole('button');
  fireEvent.click(trigger);
  const verBtn = screen.getByText('Ver en Tareas');
  fireEvent.click(verBtn);
    expect(handler).toHaveBeenCalled();
    const evt = handler.mock.calls[0][0];
    expect(evt.detail.view).toBe('tareas');
    expect(evt.detail.q).toBe('Obligación Prueba');
  });
});
