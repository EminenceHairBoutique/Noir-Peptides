// src/components/LegalDoc.jsx
// Minimal, dependency-free renderer for the exact legal/policy copy.
// Supports: # h1, ## h2, "- " unordered lists, "N. " ordered lists,
// blank-line-separated paragraphs, and auto-linked support email.
import React from "react";

const EMAIL = "support@noirpeptides.com";

function renderInline(text, keyBase) {
  const parts = text.split(EMAIL);
  if (parts.length === 1) return text;
  const out = [];
  parts.forEach((part, i) => {
    if (part) out.push(<React.Fragment key={`${keyBase}-t${i}`}>{part}</React.Fragment>);
    if (i < parts.length - 1) {
      out.push(
        <a
          key={`${keyBase}-a${i}`}
          href={`mailto:${EMAIL}`}
          className="text-se-gold underline underline-offset-2 hover:text-se-bone transition"
        >
          {EMAIL}
        </a>
      );
    }
  });
  return out;
}

export default function LegalDoc({ content }) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line === "") {
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={i}
          className="font-display text-[clamp(1.1rem,2.4vw,1.5rem)] tracking-[0.03em] text-se-gold mt-12 mb-4"
        >
          {line.slice(3)}
        </h2>
      );
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h1
          key={i}
          className="font-display font-extrabold text-[clamp(2rem,5vw,3rem)] tracking-[0.01em] text-se-bone mb-6"
        >
          {line.slice(2)}
        </h1>
      );
      i += 1;
      continue;
    }

    // Unordered list
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul
          key={`ul-${i}`}
          className="list-disc list-outside pl-5 space-y-2 my-4 text-[14px] text-se-bone/60 leading-relaxed font-accent"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul-${i}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (e.g. "1. ")
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="list-decimal list-outside pl-5 space-y-2 my-4 text-[14px] text-se-bone/60 leading-relaxed font-accent"
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol-${i}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph
    blocks.push(
      <p
        key={i}
        className="text-[14px] text-se-bone/60 leading-relaxed font-accent my-4"
      >
        {renderInline(line, `p-${i}`)}
      </p>
    );
    i += 1;
  }

  return <div className="legal-doc">{blocks}</div>;
}
