import React, { useEffect, useRef } from 'react';

const SearchBar: React.FC<{
    query: string;
    setQuery: (q: string) => void;
    placeholder?: string;
    onOpenFilters?: () => void;
}> = ({ query, setQuery, placeholder, onOpenFilters }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === '/' && (document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div className="w-full">
            <label className="sr-only">Buscar</label>
            <div className="flex items-center gap-2 bg-black/30 border border-white/8 rounded-lg px-3 py-2 shadow-sm">
                {/* mobile filters button */}
                {onOpenFilters && (
                    <button onClick={onOpenFilters} className="lg:hidden p-1 rounded-md text-slate-300 hover:bg-white/5">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 5h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12h12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 19h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                )}
                <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={placeholder || 'Buscar obligaciones, normativas, tareas... (/)'}
                    className="flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-400 text-sm"
                />
                {query ? (
                    <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-200 text-sm">Limpiar</button>
                ) : (
                    <span className="hidden sm:inline text-xs text-slate-400">/ para buscar</span>
                )}
            </div>
        </div>
    );
};

export default SearchBar;
