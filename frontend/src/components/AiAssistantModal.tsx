import React, { useState } from 'react';
import { Search, X, Send } from 'lucide-react';
import { ParcelFeatureCollection } from '../utils/geoCalculations';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  geojson: ParcelFeatureCollection | null;
  onHighlightParcel?: (parcelId: number) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PRESET_QUERIES = [
  'Largest parcel',
  'Parcels under 1 acre',
  'Total bund perimeter',
  'Arable area summary',
  'Model confidence rating',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  geojson,
  onHighlightParcel,
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Cadastral Query Engine ready. Enter a query below to compute spatial or statistical metrics across the detected parcels.',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          custom_geojson: geojson,
        }),
      });

      const data = await res.json();
      // Strip any stray emojis from backend string to maintain clean interface
      const cleanAnswer = (data.answer || 'No response generated.')
        .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();

      const assistantMsg: Message = {
        role: 'assistant',
        content: cleanAnswer,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.highlight_parcel_id && onHighlightParcel) {
        onHighlightParcel(data.highlight_parcel_id);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error: Connection to query service failed.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[480px]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Cadastral Query Tool</h3>
              <span className="text-[11px] text-slate-400 font-mono">Spatial property analysis & filtering</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-lg px-3.5 py-2 leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-800 text-white font-sans'
                    : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                <div dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-slate-400 font-mono text-xs flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Querying dataset...</span>
            </div>
          )}
        </div>

        {/* Filter / Preset Chips */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60 flex items-center space-x-1.5 overflow-x-auto">
          {PRESET_QUERIES.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 whitespace-nowrap font-mono transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Query Input */}
        <div className="p-3 border-t border-slate-800 bg-slate-950">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Which parcel is largest? How many under 1 acre?"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700 font-mono"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
