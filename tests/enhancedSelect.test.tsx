import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import EnhancedSelect from '../components/EnhancedSelect';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
];

describe('EnhancedSelect', () => {
  it('renders placeholder and opens menu', () => {
    const { getByText } = render(<EnhancedSelect value={null} onChange={()=>{}} options={options} placeholder="Seleccione" />);
    expect(getByText('Seleccione')).toBeTruthy();
    fireEvent.click(getByText('Seleccione'));
    expect(getByText('Alpha')).toBeTruthy();
  });

  it('selects an option via click', () => {
    let val: string | null = null;
  const { getByText } = render(<EnhancedSelect value={val} onChange={(v)=>{ val = v; }} options={options} placeholder="Sel" />);
    fireEvent.click(getByText('Sel'));
    fireEvent.mouseDown(getByText('Beta'));
    expect(val).toBe('b');
  });

  it('supports keyboard navigation', () => {
    let val: string | null = null;
  const { getByText } = render(<EnhancedSelect value={val} onChange={(v)=>{ val = v; }} options={options} placeholder="Key" />);
    const trigger = getByText('Key');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(val).toBeTruthy();
  });

  it('clears selection when clearable', () => {
    let val: string | null = 'a';
    const { getByText } = render(<EnhancedSelect value={val} onChange={(v)=>{ val = v; }} options={options} clearable />);
    const clearBtn = getByText('×');
    fireEvent.click(clearBtn);
    expect(val).toBeNull();
  });
});
