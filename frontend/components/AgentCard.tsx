"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Send } from "lucide-react";

import type { AgentKey, AgentMeta, AgentOutput } from "@/lib/types";

interface AgentCardProps {
  output: AgentOutput;
  meta: AgentMeta;
  index: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onAskAgent?: (agent: AgentKey, prompt: string) => void | Promise<void>;
}

function summarize(text: string, maxLines = 3): string {
  return text.split("\n").slice(0, maxLines).join("\n");
}

export default function AgentCard({
  output,
  meta,
  index,
  isExpanded = false,
  onToggle,
  onAskAgent,
}: AgentCardProps) {
  const [followUp, setFollowUp] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [followUp]);

  const handleAsk = async () => {
    const prompt = followUp.trim();
    if (!prompt || !onAskAgent) {
      return;
    }

    setFollowUp("");
    await onAskAgent(output.key, prompt);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: isExpanded ? 1.015 : 1 }}
      whileHover={{ scale: isExpanded ? 1.02 : 1.045, y: -4 }}
      whileTap={{ scale: isExpanded ? 1.01 : 0.995 }}
      transition={{
        delay: index * 0.08,
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle?.();
        }
      }}
      className={`group relative h-full w-full transform-gpu text-left ${
        isExpanded ? "z-20" : "z-0"
      }`}
    >
      <div
        className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-br ${meta.gradient} blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-50 ${
          isExpanded ? "opacity-50" : ""
        }`}
      />

      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
          isExpanded
            ? "border-[#1B6AC9]/25 bg-white shadow-2xl shadow-[#1B6AC9]/8"
            : "border-[#d4d9e0] bg-white hover:border-[#1B6AC9]/20 shadow-sm"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h3 className="text-sm font-semibold text-[#1a1a2e]">{output.agent_name}</h3>
              <p className="text-xs text-[#8b8fa3]">{meta.role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle?.();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#d4d9e0] bg-[#f0f2f5] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[#8b8fa3] transition-colors hover:border-[#1B6AC9]/30 hover:text-[#1B6AC9]"
          >
            <span>{isExpanded ? "Pinned" : "Open"}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div className={`grid gap-3 ${isExpanded ? "flex-1" : ""}`}>
          {!isExpanded && (
            <>
              <section className="rounded-xl border border-[#e8ecf1] bg-[#f7f8fa] px-3 py-2">
                <h4 className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8b8fa3]">
                  Mission
                </h4>
                <p
                  className="text-sm leading-relaxed text-[#4a4e69]"
                  style={{ maxHeight: "3.25rem", overflow: "hidden" }}
                >
                  {output.mission}
                </p>
              </section>

              <section className="rounded-xl border border-[#e8ecf1] bg-[#f7f8fa] px-3 py-2">
                <h4 className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8b8fa3]">
                  Understanding
                </h4>
                <p
                  className="text-sm leading-relaxed text-[#4a4e69]"
                  style={{ maxHeight: "4.8rem", overflow: "hidden" }}
                >
                  {summarize(output.understanding, 1)}
                </p>
              </section>

              <section className="rounded-xl border border-[#e8ecf1] bg-[#f7f8fa] px-3 py-2">
                <h4 className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8b8fa3]">
                  Reasoning
                </h4>
                <p
                  className="text-sm leading-relaxed text-[#4a4e69]"
                  style={{ maxHeight: "4.8rem", overflow: "hidden" }}
                >
                  {summarize(output.internal_reasoning_summary, 1)}
                </p>
              </section>
            </>
          )}

          <section className="rounded-xl border border-[#e8ecf1] bg-[#f7f8fa] px-3 py-2">
            <h4 className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8b8fa3]">
              Output
            </h4>
            <div
              style={isExpanded ? undefined : { maxHeight: "6rem", overflow: "hidden" }}
              className="whitespace-pre-wrap text-sm leading-relaxed text-[#2a2e42]"
            >
              {isExpanded ? output.final_output : summarize(output.final_output, 2)}
            </div>
          </section>

          {isExpanded && output.missing_information.length > 0 ? (
            <section className="rounded-xl border border-[#e8ecf1] bg-[#f7f8fa] px-3 py-2">
              <h4 className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#8b8fa3]">
                Missing Information
              </h4>
              <div className="space-y-1.5">
                {output.missing_information.map((item, itemIndex) => (
                  <div
                    key={`${output.key}-missing-${itemIndex}`}
                    className="flex items-start gap-2 text-xs text-[#4a4e69]"
                  >
                    <span className="mt-0.5 shrink-0 text-[#1B6AC9]">▸</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await handleAsk();
          }}
          onClick={(event) => event.stopPropagation()}
          className="mt-4 rounded-xl border border-[#1B6AC9]/15 bg-[#1B6AC9]/5 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1B6AC9]">
              Ask this agent
            </h4>
            <span className="text-[10px] text-[#8b8fa3]">{meta.name}</span>
          </div>

          <textarea
            ref={textareaRef}
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleAsk();
              }
            }}
            placeholder={`Ask ${meta.name} a follow-up...`}
            rows={1}
            className="w-full resize-none rounded-xl border border-[#d4d9e0] bg-white px-3 py-2.5 text-sm text-[#1a1a2e] placeholder-[#8b8fa3] focus:border-[#1B6AC9]/40 focus:outline-none overflow-y-auto"
            style={{ minHeight: "2.75rem" }}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-[#8b8fa3]">Enter to send, Shift+Enter for a new line.</p>
            <button
              type="submit"
              disabled={!followUp.trim() || !onAskAgent}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1B6AC9] to-[#1558a8] px-3 py-2 text-xs font-medium text-white transition-colors hover:from-[#2575d4] hover:to-[#1B6AC9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Ask {meta.name}
            </button>
          </div>
        </form>
      </div>
    </motion.article>
  );
}
