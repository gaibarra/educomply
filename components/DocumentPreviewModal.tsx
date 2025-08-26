import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentPreviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
  doc?: { filename?: string; title?: string; summary?: string; body_markdown?: string; sources?: any[]; disclaimer?: string } | null;
  onDownload?: (doc:any) => void;
}> = ({ open, onClose, doc, onDownload }) => {
  if (!open || !doc) return null;
  const md = `# ${doc.title || ''}\n\n${doc.summary || ''}\n\n${doc.body_markdown || ''}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>
      <div className="relative w-[90vw] md:w-3/4 lg:w-2/3 max-h-[90vh] overflow-hidden bg-slate-900 rounded-xl border border-white/10 p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-lg font-semibold">Previsualizar: {doc.title}</h3>
            <p className="text-sm text-slate-400">{doc.filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onDownload?.(doc)} className="px-3 py-1 rounded bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold">Descargar .md</button>
            <button onClick={onClose} className="px-3 py-1 rounded bg-white/5 text-slate-200">Cerrar</button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[70vh] prose prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          {doc.sources && doc.sources.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold">Fuentes</h4>
              <ul className="list-disc list-inside text-sm text-slate-300">
                {doc.sources.map((s,i)=> <li key={i}>{s.citation}{s.url? ` — ${s.url}`: ''}</li>)}
              </ul>
            </div>
          )}
          {doc.disclaimer && (
            <div className="mt-4 text-xs text-slate-400">{doc.disclaimer}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
