import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';

export interface EnhancedSelectOption {
  value: string;
  label: string;
}

interface BaseProps {
  options: EnhancedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  searchable?: boolean; // force search
  clearable?: boolean; // show clear (x)
  noOptionsText?: string;
  maxMenuHeight?: number;
  useNativeOnMobile?: boolean;
  'aria-label'?: string;
  withBackdrop?: boolean; // show full-screen backdrop when open
}

interface SingleSelectProps extends BaseProps {
  multiple?: false;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
}

interface MultiSelectProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type EnhancedSelectProps = SingleSelectProps | MultiSelectProps;

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();

const EnhancedSelect: React.FC<EnhancedSelectProps> = (props) => {
  const { options, placeholder='Seleccionar…', disabled, className='', multiple, searchable, clearable, noOptionsText='Sin opciones', maxMenuHeight=240, useNativeOnMobile=true, withBackdrop=true } = props;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const autoSearch = searchable ?? options.length > 8; // auto if many
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentValues = useMemo(()=> multiple ? (props.value as string[]) : (props.value ? [props.value as string] : []), [multiple, props.value]);

  const filteredOptions = query.trim() ? options.filter(o => normalize(o.label).includes(normalize(query))) : options;

  const toggleOpen = useCallback(()=>{ if(!disabled) setOpen(o=>!o); }, [disabled]);

  const close = () => { setOpen(false); setQuery(''); setFocusIndex(-1); };

  const commitSingle = useCallback((val: string) => {
    if(multiple) return;
    (props as SingleSelectProps).onChange(val === (props as SingleSelectProps).value ? val : val);
    close();
  }, [multiple, props]);

  const commitMulti = useCallback((val: string) => {
    if(!multiple) return;
    const selected = new Set(currentValues);
    if(selected.has(val)) selected.delete(val); else selected.add(val);
  (props as MultiSelectProps).onChange(Array.from(selected) as string[]);
  }, [multiple, currentValues, props]);

  // Click outside
  useEffect(()=>{
    const handler = (e: MouseEvent) => {
      if(!containerRef.current) return;
      if(!containerRef.current.contains(e.target as Node)) close();
    };
    if(open) document.addEventListener('mousedown', handler);
    return ()=> document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keyboard support
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if(!open){
      if(['Enter',' '].includes(e.key)) { e.preventDefault(); toggleOpen(); }
      return;
    }
    if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
    if(['ArrowDown','ArrowUp'].includes(e.key)){
      e.preventDefault();
      setFocusIndex(idx => {
        const max = filteredOptions.length - 1;
        if(max < 0) return -1;
        if(e.key === 'ArrowDown') return idx >= max ? 0 : idx + 1;
        return idx <= 0 ? max : idx - 1;
      });
    }
    if(e.key === 'Enter'){
      e.preventDefault();
      if(focusIndex >=0 && focusIndex < filteredOptions.length){
        const opt = filteredOptions[focusIndex];
        multiple ? commitMulti(opt.value) : commitSingle(opt.value);
      }
    }
  }, [open, focusIndex, filteredOptions, multiple, commitMulti, commitSingle, toggleOpen]);

  useEffect(()=>{
    if(open && focusIndex >=0 && listRef.current){
      const el = listRef.current.children[focusIndex] as HTMLElement;
      if(el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
  }, [focusIndex, open]);

  // Native mobile fallback will be returned at end (after hooks) to keep hook order stable
  const nativeMobileFallback = () => {
    if(!(useNativeOnMobile && isMobile)) return null;
    if(multiple){
      return (
        <select
          multiple
          className={"w-full p-2 rounded-md border border-slate-300 bg-white text-slate-800 text-sm "+className}
          disabled={disabled}
          value={currentValues}
          onChange={e=> {
            const vals = Array.from(e.target.selectedOptions).map(o=>(o as HTMLOptionElement).value);
            (props as MultiSelectProps).onChange(vals);
          }}
        >
          {options.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    return (
      <select
        className={"w-full p-2 rounded-md border border-slate-300 bg-white text-slate-800 text-sm "+className}
        disabled={disabled}
        value={currentValues[0] || ''}
        onChange={e=> (props as SingleSelectProps).onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  };

  // Close on scroll/resize to avoid misalignment if using portal
  useEffect(()=>{
    if(!open) return;
    const handler = () => close();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => { window.removeEventListener('scroll', handler, true); window.removeEventListener('resize', handler); };
  }, [open]);

  const menu = () => {
    const menuContent = (
      <div className="rounded-md border border-slate-300 bg-white shadow-lg" style={{ maxHeight: maxMenuHeight + 42 /* search box */ }}>
        {autoSearch && (
          <div className="p-2 border-b border-slate-200">
            <input value={query} onChange={e=>{ setQuery(e.target.value); setFocusIndex(0); }} placeholder="Buscar..." className="w-full px-2 py-1 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
          </div>
        )}
        <ul ref={listRef} role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: maxMenuHeight }}>
          {filteredOptions.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">{noOptionsText}</li>
          )}
          {filteredOptions.map((opt, idx) => {
            const selected = currentValues.includes(opt.value);
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={selected}
                className={`px-3 py-1.5 cursor-pointer text-slate-700 flex items-center gap-2 text-sm hover:bg-brand-primary/10 ${focusIndex===idx? 'bg-brand-primary/10':''}`}
                onMouseEnter={()=>setFocusIndex(idx)}
                onMouseDown={(e)=>{ e.preventDefault(); multiple ? commitMulti(opt.value) : commitSingle(opt.value); }}
              >
                {multiple && (
                  <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${selected? 'bg-brand-primary border-brand-primary text-white':'border-slate-400 text-transparent'}`}>✓</span>
                )}
                <span className={`truncate ${selected && !multiple ? 'font-medium':''}`}>{opt.label}</span>
                {!multiple && selected && <span className="ml-auto text-brand-primary text-xs">●</span>}
              </li>
            );
          })}
        </ul>
        {multiple && currentValues.length>0 && (
          <div className="flex flex-wrap gap-1 p-2 border-t border-slate-200 bg-slate-50">
            {currentValues.map(v=> (
              <button key={v} onClick={()=>commitMulti(v)} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-brand-secondary/10 text-brand-secondary rounded">
                <span>{options.find(o=>o.value===v)?.label || v}</span>
                <svg viewBox="0 0 20 20" className="h-3 w-3" stroke="currentColor" fill="none"><path d="M6 6l8 8m0-8l-8 8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
          </div>
        )}
      </div>
    );
    if(!open || typeof document === 'undefined') return null;
    const rect = containerRef.current?.getBoundingClientRect();
    if(!rect) return null;
    const vw = window.innerWidth;
    // Clamp width on narrower viewports (avoid huge overlay)
    const desiredWidth = rect.width;
    const maxWidth = vw < 900 ? Math.min(360, desiredWidth) : desiredWidth;
    // If we clamp, keep left within viewport
    let left = rect.left + window.scrollX;
    if(desiredWidth !== maxWidth){
      // center relative to trigger
      left = left + (desiredWidth - maxWidth) / 2;
      left = Math.max(8, Math.min(left, window.scrollX + vw - maxWidth - 8));
    }
    const top = rect.bottom + window.scrollY;
    const dropdown = (
      <div className="z-[100002] fixed" style={{ top, left, width: maxWidth }}>
        {menuContent}
      </div>
    );
    const backdropEl = withBackdrop ? (
      <div
        className="fixed inset-0 z-[100001] bg-black/30 backdrop-blur-[1px] animate-fade-in"
        onMouseDown={(e)=>{ if(e.target === e.currentTarget) close(); }}
      />
    ) : null;
    return ReactDOM.createPortal(<>{backdropEl}{dropdown}</>, document.body);
  };

  if(useNativeOnMobile && isMobile) return nativeMobileFallback();

  return (
    <div ref={containerRef} className={`relative text-sm ${disabled? 'opacity-60 pointer-events-none':''} ${className}`} onKeyDown={onKeyDown} tabIndex={0} aria-haspopup="listbox" aria-expanded={open}>
      <button type="button" onClick={toggleOpen} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 relative z-[999]">
        <span className="truncate text-left flex-1">
          {currentValues.length === 0 && <span className="text-slate-400">{placeholder}</span>}
          {currentValues.length === 1 && !multiple && options.find(o=>o.value===currentValues[0])?.label}
          {multiple && currentValues.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {currentValues.slice(0,3).map(v=> <span key={v} className="px-1.5 py-0.5 bg-brand-secondary/10 text-brand-secondary rounded text-[11px]">{options.find(o=>o.value===v)?.label || v}</span>)}
              {currentValues.length > 3 && <span className="text-xs text-slate-500">+{currentValues.length - 3}</span>}
            </span>
          )}
        </span>
        {clearable && !multiple && currentValues.length === 1 && (
          <span
            onClick={(e)=>{ e.stopPropagation(); (props as SingleSelectProps).onChange(null); close(); }}
            className="text-slate-400 hover:text-red-500 cursor-pointer text-xs px-1"
            aria-label="Limpiar selección"
            role="button"
          >×</span>
        )}
        <svg className={`h-4 w-4 text-slate-500 transition-transform ${open? 'rotate-180':''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M6 8l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
  {menu()}
    </div>
  );
};

export default EnhancedSelect;
