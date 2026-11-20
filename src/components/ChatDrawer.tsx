import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import {
  BedChatContext,
  ChatMessage,
  ChatPersona,
  ChatRoutingMode,
} from '../types/laser';
import { makeId } from '../utils/elementFactory';

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  bedContext: BedChatContext;
}

const PERSONA_OPTIONS: Array<{
  id: ChatPersona;
  label: string;
  description: string;
}> = [
  {
    id: 'combined',
    label: 'All-in-One',
    description: 'Hardware parameters, LightBurn/LaserGRBL export, and gift design',
  },
  {
    id: 'technician',
    label: 'X20 Pro Tech',
    description: 'Speed/power settings, kerf, air assist, focus, and burn troubleshooting',
  },
  {
    id: 'designer',
    label: 'Gift Designer',
    description: 'Name tag copy, seasonal ornaments, wedding signage, and SVG prompts',
  },
];

const ROUTING_OPTIONS: Array<{ id: ChatRoutingMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'fast', label: 'Fast' },
  { id: 'general', label: 'Balanced' },
  { id: 'deep', label: 'Deep' },
];

function getStarterPrompts(
  persona: ChatPersona,
  materialName: string
): string[] {
  if (persona === 'technician') {
    return [
      `Recommended speed, power, and passes for ${materialName}?`,
      'How do I prevent edge charring when cutting plywood on the X20 Pro?',
      'What kerf offset should I use for snug press-fit slots?',
    ];
  }
  if (persona === 'designer') {
    return [
      'Give me 6 short romantic phrases for a Valentine heart ornament',
      'Suggest balanced sizing and fonts for wedding place-card name tags',
      'Write a crisp AI SVG prompt for a layered Christmas coaster',
    ];
  }
  return [
    `Check best X20 Pro cut & engrave settings for ${materialName}`,
    'Give me 5 short engraved gift tag ideas for an event',
    'Should I use CAD SVG or dithered PNG in LightBurn for this job?',
  ];
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  open,
  onClose,
  bedContext,
}) => {
  const [persona, setPersona] = useState<ChatPersona>('combined');
  const [routingMode, setRoutingMode] = useState<ChatRoutingMode>('auto');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open]);

  if (!open) return null;

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    const userTurn: ChatMessage = {
      id: makeId('msg'),
      role: 'user',
      text: trimmed,
      createdAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const nextHistory = [...messages, userTurn];
    setMessages(nextHistory);
    setDraft('');
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          persona,
          routingMode,
          bedContext,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Assistant request failed.');
      }

      const assistantTurn: ChatMessage = {
        id: makeId('msg'),
        role: 'assistant',
        text: data.reply,
        modelUsed: data.modelUsed,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, assistantTurn]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Gemini assistant.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(draft);
  };

  const activePersona =
    PERSONA_OPTIONS.find((p) => p.id === persona) ?? PERSONA_OPTIONS[0];
  const starters = getStarterPrompts(persona, bedContext.materialName);

  return (
    <aside
      aria-label="Gemini Studio Assistant"
      className="fixed top-14 right-0 bottom-0 z-40 flex w-full max-w-[380px] flex-col border-l border-[#232A3B] bg-[#131722] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232A3B] bg-[#10141D] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#38BDF8] shrink-0" />
            <h2 className="truncate text-sm font-semibold text-[#F1F5F9]">
              Studio Assistant
            </h2>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
            {bedContext.materialName} · {bedContext.softwareName} ·{' '}
            {bedContext.elementCount} on bed
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              title="Clear conversation"
              className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-[#1E2534] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Studio Assistant"
            className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-[#1E2534] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Role & Routing Controls */}
      <div className="border-b border-[#232A3B] bg-[#0F131C] px-4 py-2.5 space-y-2">
        <div className="grid grid-cols-3 gap-1 rounded border border-[#232A3B] bg-[#0B0E14] p-0.5">
          {PERSONA_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPersona(opt.id)}
              className={`rounded py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                persona === opt.id
                  ? 'bg-[#1F2737] text-white'
                  : 'text-[#94A3B8] hover:text-[#E2E8F0]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-[#94A3B8]">
            {activePersona.description}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[11px] font-medium text-[#64748B] shrink-0">
            Response Depth
          </span>
          <div className="flex items-center gap-1 rounded border border-[#232A3B] bg-[#0B0E14] p-0.5">
            {ROUTING_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoutingMode(r.id)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  routingMode === r.id
                    ? 'bg-[#1F2737] text-[#38BDF8]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Multi-Turn Conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3 pt-2">
            <div className="text-xs leading-relaxed text-[#94A3B8]">
              Ask anything about your AtomStack X20 Pro settings, kerf tolerances,
              LightBurn/LaserGRBL prep, or seasonal gift copy.
            </div>
            <div className="space-y-1.5">
              {starters.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="block w-full rounded-md border border-[#232A3B] bg-[#0D1018] px-3 py-2 text-left text-xs text-[#E2E8F0] transition-colors hover:border-[#334155] hover:bg-[#171D2B]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[92%] rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'border border-[#334155] bg-[#1B2333] text-[#F1F5F9]'
                    : 'border border-[#232A3B] bg-[#0D1018] text-[#E2E8F0]'
                }`}
              >
                {msg.text}
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-[#64748B] tabular-nums">
                <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                {msg.modelUsed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{msg.modelUsed}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{msg.createdAt}</span>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-md border border-[#232A3B] bg-[#0D1018] px-3 py-2.5 text-xs text-[#94A3B8]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#38BDF8]" />
            <span>Thinking through your studio context...</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 p-2.5 text-xs text-[#FCA5A5]">
            {error}
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#232A3B] bg-[#10141D] p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(draft);
              }
            }}
            placeholder="Ask about X20 Pro settings, kerf, or gift copy..."
            className="min-h-[42px] flex-1 resize-none rounded-md border border-[#232A3B] bg-[#0D1018] px-3 py-2 text-xs text-[#F1F5F9] placeholder-[#64748B] focus:border-[#38BDF8] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            aria-label="Send message"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-md bg-[#EF4444] text-white transition-colors hover:bg-[#DC2626] disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
