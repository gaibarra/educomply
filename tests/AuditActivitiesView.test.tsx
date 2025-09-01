
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditActivitiesView from '../components/AuditActivitiesView';
import * as geminiService from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

// Mock Supabase
vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock Toast
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const mockAudit = {
  id: 'audit-1',
  name: 'Test Audit',
  current_phase: 'planificacion',
};

const mockActivities = [
  { id: 1, audit_id: 'audit-1', phase: 'planificacion', description: 'Activity 1', completed: false, notes: '' },
];

const mockSubActivities = [
  { id: 'sub-1', activity_id: 1, description: 'Sub-activity 1', start_date: '2025-01-01', end_date: '2025-01-07', completed: false },
];

describe('AuditActivitiesView', () => {
  beforeEach(() => {
  const fromMock = supabase.from as any;
    fromMock.mockImplementation((table: string) => {
      if (table === 'audit_phase_activities') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockActivities, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'audit_phase_sub_activities') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: mockSubActivities, error: null }),
          insert: vi.fn().mockReturnValue({ 
            select: vi.fn().mockResolvedValue({ data: [{id: 'sub-2', description: 'Generated Sub 1', start_date: '2025-02-01', end_date: '2025-02-07', activity_id: 1, completed: false}], error: null })
          }),
        };
      }
      return { select: vi.fn() };
    });
  });

  it('renders and fetches activities and sub-activities', async () => {
    render(<AuditActivitiesView audit={mockAudit as any} onClose={() => {}} onUpdateAudit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Activity 1')).toBeInTheDocument();
      expect(screen.getByText('Sub-activity 1')).toBeInTheDocument();
    });
  });

  it('generates sub-activities when the button is clicked', async () => {
    const generateSubActivitiesSpy = vi.spyOn(geminiService, 'generateSubActivities').mockImplementation(async () => ({
      subActivities: [
        { description: 'Generated Sub 1', start_date: '2025-02-01', end_date: '2025-02-07' },
      ],
    }));

    render(<AuditActivitiesView audit={mockAudit as any} onClose={() => {}} onUpdateAudit={() => {}} />);

  fireEvent.click(await screen.findByText('Generar Sub-actividades'));

    expect(generateSubActivitiesSpy).toHaveBeenCalled();
  });

  it('does not close modal after generating sub-activities', async () => {
    vi.spyOn(geminiService, 'generateSubActivities').mockImplementation(async () => ({
      subActivities: [
        { description: 'Generated Sub 1', start_date: '2025-02-01', end_date: '2025-02-07' },
      ],
    }));

    render(<AuditActivitiesView audit={mockAudit as any} onClose={() => {}} onUpdateAudit={() => {}} />);

    // Ensure base activity loaded
    await screen.findByText('Activity 1');

    fireEvent.click(await screen.findByText('Generar Sub-actividades'));
    // Wait for optimistic or inserted sub-activity
    await screen.findByText('Generated Sub 1');
    // Modal header still present
    expect(screen.getByText('Actividades de la Auditoría: Test Audit')).toBeInTheDocument();
  });
});
