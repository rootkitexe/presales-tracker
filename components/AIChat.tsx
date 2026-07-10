'use client';

import { useEffect, useRef, useState } from 'react';

interface ToolLogEntry {
  tool: string;
  query: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolLog?: ToolLogEntry[];
}

const SUGGESTIONS = [
  'Have we done anything similar for Nissan before?',
  'Which AMs have the highest TARA attach rate?',
  'Show me stalled deals (open >30 days) in HubSpot',
  'Any past requests involving Java or Spring Boot?',
];

interface Props {
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
}

export default function AIChat({ showToast }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const nextMessages: Message[] = [...messages, { role: 'user', content: q }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showToast(data.error ?? 'AI request failed', 'err');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ ${data.error ?? 'Something went wrong.'}`,
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content ?? '(no response)',
          toolLog: data.toolLog ?? [],
        },
      ]);
    } catch (e) {
      showToast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setInput('');
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat-hdr">
        <div className="ai-chat-title">
          <span className="ai-chat-dot" /> AI Assistant
          <span className="ai-chat-sub">— tracker + HubSpot context</span>
        </div>
        {messages.length > 0 && (
          <button className="btn" onClick={reset} disabled={busy}>
            Clear
          </button>
        )}
      </div>

      <div className="ai-chat-body" ref={listRef}>
        {messages.length === 0 && !busy && (
          <div className="ai-chat-empty">
            <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
              Ask about past requests, similar customers, HubSpot deal state, or any
              tracker analytics. Try:
            </p>
            <div className="ai-chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="ai-chat-suggestion"
                  onClick={() => send(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'ai-msg ai-msg-' + m.role}>
            <div className="ai-msg-role">{m.role === 'user' ? 'You' : 'AI'}</div>
            <div className="ai-msg-content">{m.content}</div>
            {m.toolLog && m.toolLog.length > 0 && (
              <div className="ai-msg-tools">
                {m.toolLog.map((t, ti) => (
                  <span className="ai-tool-chip" key={ti}>
                    {t.tool.replace('search_', '')}
                    {t.query ? `: "${t.query}"` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-msg-role">AI</div>
            <div className="ai-msg-content">
              <span className="spinner" style={{ width: 14, height: 14 }} /> Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="ai-chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about tracker records or HubSpot deals…"
          disabled={busy}
        />
        <button
          className="btn btn-p"
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
