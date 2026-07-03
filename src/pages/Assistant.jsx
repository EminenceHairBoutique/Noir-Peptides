// src/pages/Assistant.jsx — AI Research Tools (gated, RUO-safe)
// Front-end surfaces for the guardrail'd /api/ai endpoints: a Concierge chat, a
// COA Interpreter, and a Literature Summarizer. All safety is enforced server-
// side (RUO guardrail + refusals + output post-processing). These tools never
// provide dosing, administration, or therapeutic guidance.
import { useState } from "react";
import { MessagesSquare, FileSearch, BookOpen, Sparkles } from "lucide-react";
import SEO from "../components/SEO";
import AiChat from "../components/AiChat";
import { askAi } from "../lib/aiApi";

const TABS = [
  { id: "concierge", label: "Concierge", icon: MessagesSquare },
  { id: "coa", label: "COA Interpreter", icon: FileSearch },
  { id: "literature", label: "Literature Summarizer", icon: BookOpen },
];

const field =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2.5 text-se-bone text-sm focus:border-se-gold focus:outline-none";

// Generic one-shot tool: fills a body from inputs, shows a single result.
function OneShot({ endpoint, buildBody, valid, children, resultLabel }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [refused, setRefused] = useState(false);
  const [notice, setNotice] = useState(null);

  const run = async () => {
    setBusy(true); setNotice(null); setResult(null); setRefused(false);
    try {
      const r = await askAi(endpoint, buildBody());
      if (r.notConfigured) setNotice("This tool isn’t enabled on this environment yet.");
      else { setResult(r.reply); setRefused(r.refused); }
    } catch (e) {
      setNotice(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass-panel p-6 space-y-3">
        {children}
        <button onClick={run} disabled={busy || !valid()} className="btn-primary disabled:opacity-40">
          {busy ? "Analyzing…" : resultLabel || "Run"}
        </button>
        {notice && <p className="text-[12px] text-amber-300">{notice}</p>}
      </div>
      <div>
        {result == null ? (
          <div className="glass-panel p-6 text-se-bone/50 text-sm">The result appears here.</div>
        ) : (
          <div className={`glass-panel p-6 text-[13.5px] leading-relaxed whitespace-pre-wrap font-accent ${refused ? "border border-amber-500/30 text-amber-200" : "text-se-bone/85"}`}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

function CoaInterpreter() {
  const [coaText, setCoaText] = useState("");
  const [question, setQuestion] = useState("");
  return (
    <OneShot
      endpoint="/api/ai/coa-analyzer"
      valid={() => coaText.trim().length > 0}
      buildBody={() => ({ coaText, question })}
      resultLabel="Interpret COA"
    >
      <h3 className="font-display text-[16px]">Paste a Certificate of Analysis</h3>
      <p className="text-[12px] text-se-bone/45 font-accent">
        Explains the analytical fields (HPLC purity, mass-spec identity, endotoxin, batch metadata).
        No use, dosing, or reconstitution-for-use guidance.
      </p>
      <textarea value={coaText} onChange={(e) => setCoaText(e.target.value)} rows={10} placeholder="Paste COA text…" className={field} />
      <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Optional: a specific field to focus on" className={field} />
    </OneShot>
  );
}

function LiteratureSummarizer() {
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  return (
    <OneShot
      endpoint="/api/ai/literature-summarizer"
      valid={() => topic.trim().length > 0 || text.trim().length > 0}
      buildBody={() => ({ topic, text })}
      resultLabel="Summarize literature"
    >
      <h3 className="font-display text-[16px]">Summarize preclinical literature</h3>
      <p className="text-[12px] text-se-bone/45 font-accent">
        Reports findings, mechanisms (as described), models, and stated limitations — framed as
        "the literature describes," never as human outcomes.
      </p>
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Compound or topic (e.g. GHK-Cu in-vitro studies)" className={field} />
      <p className="text-[11px] text-se-steel text-center">— or paste an abstract —</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Paste abstract or excerpt (optional)…" className={field} />
    </OneShot>
  );
}

export default function Assistant() {
  const [tab, setTab] = useState("concierge");
  return (
    <>
      <SEO title="AI Research Tools | Noir Peptides" description="RUO-safe research assistant, COA interpreter, and literature summarizer." noindex />
      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
        <div className="content-wide">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-se-gold" />
            <p className="text-overline">AI Research Tools</p>
          </div>
          <h1 className="font-display font-extrabold text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em] mb-2">Research Assistant</h1>
          <p className="text-[13px] text-se-bone/50 font-accent max-w-2xl mb-6">
            Compound background, COA interpretation, and literature summaries for qualified researchers.
            These tools stay strictly in the research-use lane and will not provide dosing, administration,
            or therapeutic guidance.
          </p>

          <div className="flex gap-2 mb-8 border-b border-white/10 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-[13px] font-accent border-b-2 -mb-px whitespace-nowrap transition ${
                  tab === t.id ? "border-se-gold text-se-gold" : "border-transparent text-se-bone/50 hover:text-se-bone"
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "concierge" && (
            <div className="max-w-3xl">
              <AiChat
                endpoint="/api/ai/concierge"
                placeholder="Ask about orders, COAs, shipping, policies, or the catalog…"
                intro="Hi — I’m the Noir Peptides research concierge. I can help with orders, COA availability, shipping and returns policy, and navigating the catalog. I can’t provide dosing or use guidance. How can I help?"
              />
            </div>
          )}
          {tab === "coa" && <CoaInterpreter />}
          {tab === "literature" && <LiteratureSummarizer />}

          <p className="mt-8 text-[11px] text-se-steel font-accent uppercase tracking-[0.14em]">
            For research use only. Not for human or veterinary use.
          </p>
        </div>
      </div>
    </>
  );
}
