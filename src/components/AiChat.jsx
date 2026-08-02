// src/components/AiChat.jsx
// Reusable RUO research chat. Renders a conversation against a guardrail'd
// /api/ai endpoint; refusals are shown distinctly (the server enforces the
// research-use-only lane). Degrades gracefully when the endpoint is not
// configured (503).
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { askAi } from "../lib/aiApi";

export default function AiChat({ endpoint, placeholder = "Ask a research question…", intro }) {
  const [messages, setMessages] = useState([]); // {role,content,refused?}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setNotice(null);
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await askAi(endpoint, {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        message: text,
      });
      if (r.notConfigured) {
        setNotice("The research assistant isn’t enabled on this environment yet.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: r.reply, refused: r.refused }]);
      }
    } catch (err) {
      setNotice(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[560px] glass-panel">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {intro && (
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-[13.5px] text-se-bone/80 font-accent leading-relaxed">
            {intro}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap font-accent ${
                m.role === "user"
                  ? "rounded-tr-sm bg-se-gold text-se-black"
                  : m.refused
                  ? "rounded-tl-sm border border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "rounded-tl-sm border border-white/10 bg-white/[0.03] text-se-bone/85"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-se-steel text-[13px]">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {notice && <p className="px-5 pb-2 text-[12px] text-amber-300">{notice}</p>}

      <form onSubmit={send} className="border-t border-white/10 p-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
          rows={1}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-se-bone text-sm focus:border-se-gold focus:outline-none max-h-32"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn-primary shrink-0 disabled:opacity-40" aria-label="Send">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
