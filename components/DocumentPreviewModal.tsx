import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { supabase } from '../services/supabaseClient';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentPreviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
  doc?: { filename?: string; title?: string; summary?: string; body_markdown?: string; sources?: any[]; disclaimer?: string } | null;
  onDownload?: (doc:any) => void;
  relatedTaskId?: string | null;
  onSave?: (row:any) => void;
}> = ({ open, onClose, doc, onDownload, relatedTaskId, onSave }) => {
  // state/hooks must be declared before any early returns
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  if (!open || !doc) return null;

  const md = `# ${doc.title || ''}\n\n${doc.summary || ''}\n\n${doc.body_markdown || ''}`;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) {
      alert('No se pudo abrir la ventana de impresión. Comprueba el bloqueador de ventanas emergentes.');
      return;
    }

    // Basic skeleton so the window has a head and body
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
    w.document.close();

    // Clone current styles (link and style tags) so Tailwind/prose styles are available in the print window
    try {
      const head = document.head;
      const clones: Array<Node> = [];
      head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        clones.push(node.cloneNode(true));
      });
      clones.forEach((n) => w.document.head.appendChild(n));
    } catch (err) {
      // ignore cloning errors
      // the printable window will fall back to simple styles
    }

    // Create a container in the new window and mount a React tree there to render ReactMarkdown fully
    const container = w.document.createElement('div');
    container.id = 'educomply-print-root';
    w.document.body.appendChild(container);

    // Define printable component
    const Printable: React.FC<{ title?: string; md: string }> = ({ title, md }) => (
      <div className="p-6 text-slate-900 bg-white">
        {title && <h1 className="text-2xl font-semibold mb-4">{title}</h1>}
        <div className="prose prose-lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </div>
      </div>
    );

    let root: Root | null = null;
    try {
      root = createRoot(container);
      root.render(<Printable title={doc.title} md={md} />);
    } catch (err) {
      // fallback: write plain text if React render fails
      w.document.body.innerHTML = `<pre>${md.replace(/</g, '&lt;')}</pre>`;
    }

    // Wait for render and resource load, then trigger print
    const doPrint = () => {
      try {
        w.focus();
        w.print();
      } catch (e) {
        console.warn('Print failed', e);
      }
      // Cleanup: unmount React root (if mounted) and optionally close window after a delay
      setTimeout(() => {
        try {
          if (root) root.unmount();
        } catch (e) {
          // ignore unmount errors
        }
        // keep window open so user can inspect; close automatically commented out
        // w.close();
      }, 500);
    };

    // Wait briefly for styles and images to load
    setTimeout(doPrint, 600);
  };

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const payload: any = {
        title: doc.title || null,
        filename: doc.filename || null,
        summary: doc.summary || null,
        body_markdown: doc.body_markdown || null,
        metadata: null,
        task_id: relatedTaskId || null,
      };

      // Try to attach the authenticated user's id to the document and use the RPC we added in setup.sql
      const userResp = await supabase.auth.getUser();
      const userId = (userResp?.data as any)?.user?.id ?? null;

      const rpcParams = {
        p_title: payload.title,
        p_filename: payload.filename,
        p_summary: payload.summary,
        p_body_markdown: payload.body_markdown,
        p_metadata: payload.metadata,
        p_task_id: payload.task_id,
        p_user: userId,
      };

      const { data, error } = await supabase.rpc('insert_document', rpcParams);
      if (error) {
        // Provide more context to the developer console and show a user-friendly alert
        let errText = '';
        try { errText = JSON.stringify(error, Object.getOwnPropertyNames(error), 2); } catch { errText = String(error); }
        console.error('RPC insert_document error', error, errText);
        try { alert('Error guardando documento: ' + (error?.message || errText)); } catch { /* ignore */ }
        throw error;
      }
      // rpc returns an array (setof), take first
      const inserted = Array.isArray(data) ? data[0] : data;
      setSaved(true);
      setSaving(false);
      if (onSave) onSave(inserted);
    } catch (e) {
      let eText = '';
      try { eText = JSON.stringify(e, Object.getOwnPropertyNames(e), 2); } catch { eText = String(e); }
      console.error('Error saving document', e, eText);
      setSaving(false);
      try { alert('No se pudo guardar el documento. Error: ' + (e?.message || eText)); } catch { /* ignore */ }
    }
  };
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
            <div className="flex items-center gap-2">
              <button onClick={() => onDownload?.(doc)} className="px-3 py-1 rounded bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-semibold">Descargar .md</button>
              {/* Quick access: open generated document in new tab */}
              <button onClick={() => {
                try {
                  const md = `# ${doc.title || ''}\n\n${doc.summary || ''}\n\n${doc.body_markdown || ''}`;
                  const blob = new Blob([md], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank')?.focus();
                  // revoke after a short delay
                  setTimeout(() => URL.revokeObjectURL(url), 30000);
                } catch (e) {
                  console.error('No se pudo abrir el documento en nueva pestaña', e);
                }
              }} title="Abrir documento generado" className="p-2 rounded bg-white/6 hover:bg-white/10 text-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 21H3V3"/></svg>
              </button>
            </div>
            <button onClick={handlePrint} className="px-3 py-1 rounded bg-white/5 text-slate-200">Imprimir</button>
            <button onClick={handleSave} className={`flex items-center gap-2 px-3 py-1 rounded ${saved ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-200'}`} disabled={saving}>
              {saved ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 5 11.586a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l9-9a1 1 0 00-1.414-1.414l-7.293 7.293L5.707 9.293a1 1 0 011.414-1.414L8.414 9l8.293-8.293a1 1 0 011.414 1.414L16.707 5.293z" clipRule="evenodd" />
                  </svg>
                  <span>Guardado</span>
                </>
              ) : (saving ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-pulse" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M2 5a2 2 0 012-2h2a1 1 0 010 2H4v10h10v-2a1 1 0 112 0v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
                    <path d="M14 2h2a2 2 0 012 2v2a1 1 0 11-2 0V4h-2a1 1 0 110-2z" />
                  </svg>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M4 3a1 1 0 00-1 1v12a2 2 0 002 2h10a1 1 0 001-1V7.414A2 2 0 0015.586 6L12 2.414A2 2 0 0010.586 2H6a1 1 0 00-1 1z" />
                  </svg>
                  <span>Guardar</span>
                </>
              ))}
            </button>
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
