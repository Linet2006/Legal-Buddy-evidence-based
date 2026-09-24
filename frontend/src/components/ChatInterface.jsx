import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageCircleQuestion } from "lucide-react";
import ChatMessage from "./ChatMessage.jsx";

export default function ChatInterface({ turns, onAsk, loading, onJump }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  function handleSubmit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    onAsk(q);
    setInput("");
  }

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {turns.length === 0 && (
          <div className="chat-empty">
            <MessageCircleQuestion size={22} style={{ marginBottom: 10 }} aria-hidden="true" />
            <p>
              Ask anything about this document — "Can I cancel early?", "What
              happens if I'm late on payment?" Every answer will show exactly
              where it came from.
            </p>
          </div>
        )}
        {turns.map((turn, i) => (
          <ChatMessage key={i} turn={turn} onJump={onJump} />
        ))}
        {loading && (
          <div className="chat-loading">
            <Loader2 size={15} className="spin" aria-hidden="true" />
            Checking the document…
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <label htmlFor="chat-input" className="visually-hidden">
          Ask a question about this document
        </label>
        <textarea
          id="chat-input"
          className="chat-input"
          rows={1}
          placeholder="Ask about this document…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              handleSubmit(e);
            }
          }}
        />
        <button type="submit" className="chat-send" disabled={loading || !input.trim()}>
          <Send size={15} aria-hidden="true" />
          <span className="visually-hidden">Send</span>
        </button>
      </form>
    </>
  );
}
