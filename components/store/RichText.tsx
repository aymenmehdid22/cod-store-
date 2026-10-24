// Renders plain admin-written text: "## Heading", "- list item", blank line = new paragraph. No HTML is ever interpreted.
export function parseBlocks(text: string): { type: "h2" | "p" | "ul"; lines: string[] }[] {
  const blocks: { type: "h2" | "p" | "ul"; lines: string[] }[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    let buf: string[] = [];
    const flush = () => { if (buf.length) blocks.push({ type: "p", lines: buf }); buf = []; };
    let list: string[] = [];
    const flushList = () => { if (list.length) blocks.push({ type: "ul", lines: list }); list = []; };
    for (const l of lines) {
      if (l.startsWith("## ")) { flush(); flushList(); blocks.push({ type: "h2", lines: [l.slice(3)] }); }
      else if (l.startsWith("- ")) { flush(); list.push(l.slice(2)); }
      else { flushList(); buf.push(l); }
    }
    flush(); flushList();
  }
  return blocks;
}

export default function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseBlocks(text).map((b, i) =>
        b.type === "h2" ? <h2 key={i} className="pt-2 text-base font-extrabold">{b.lines[0]}</h2>
        : b.type === "ul" ? <ul key={i} className="list-disc space-y-1 ps-5">{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
        : <p key={i} className="whitespace-pre-line">{b.lines.join("\n")}</p>
      )}
    </div>
  );
}
