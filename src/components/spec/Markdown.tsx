import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
        const { svg } = await mermaid.render(`m${id}`, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed) {
    return (
      <pre className="font-mono text-[11px] overflow-x-auto rounded-md bg-ink p-3 text-ink-foreground/90">
        {code}
      </pre>
    );
  }

  return <div ref={ref} className="my-3 overflow-x-auto rounded-md bg-panel p-2 ring-1 ring-line/40" />;
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-doc text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children, ...props }) {
            const child = Array.isArray(children) ? children[0] : children;
            const childProps = (child as { props?: { className?: string; children?: unknown } } | undefined)?.props;
            if (childProps?.className?.includes("language-mermaid")) {
              return <MermaidBlock code={String(childProps.children ?? "").replace(/\n$/, "")} />;
            }
            return <pre {...props}>{children}</pre>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
