"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Send, Sparkles } from "lucide-react";

import {
  AGENT_CONFIG_BY_KEY,
  AGENT_SELECTOR_OPTIONS,
  type AgentKey,
} from "@/lib/types";

interface DecisionInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  selectedAgent: AgentKey | "all";
  onTargetChange: (agent: AgentKey | "all") => void;
}



export default function DecisionInput({
  prompt,
  onPromptChange,
  onSubmit,
  isLoading,
  selectedAgent,
  onTargetChange,
}: DecisionInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [prompt]);

  const selectedLabel = useMemo(() => {
    return selectedAgent === "all"
      ? "Full Council"
      : AGENT_CONFIG_BY_KEY[selectedAgent]?.name ?? "Full Council";
  }, [selectedAgent]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
    }
  };

  const handleSelect = (agent: AgentKey | "all") => {
    onTargetChange(agent);
    setIsDropdownOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mx-auto w-full max-w-[1100px]"
    >
      <form onSubmit={handleSubmit} className="relative">
        <div className="group relative">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#1B6AC9]/15 via-[#1B6AC9]/25 to-[#1558a8]/15 blur-lg opacity-0 transition-opacity duration-500 group-focus-within:opacity-80" />

          <div className="relative rounded-2xl border border-[#d4d9e0] bg-white p-1.5 shadow-sm">
            <textarea
              ref={textareaRef}
              id="decision-input"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                selectedAgent === "all"
                  ? "Ask the full Synod council..."
                  : `Ask the ${selectedLabel} directly...`
              }
              rows={1}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-5 py-4 text-lg text-[#1a1a2e] placeholder-[#8b8fa3] focus:outline-none disabled:opacity-50 overflow-y-auto"
              style={{ minHeight: "3.5rem" }}
            />

            <div className="relative flex flex-col gap-3 px-3 pb-3 md:flex-row md:items-center md:justify-between">
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#d4d9e0] bg-[#f0f2f5] px-3 py-2 text-sm text-[#4a4e69] transition-colors hover:bg-[#e8ecf1]"
                >
                  <span className="max-w-[180px] truncate">{selectedLabel}</span>
                  <ChevronDown className="h-4 w-4 text-[#8b8fa3]" />
                </button>

                {isDropdownOpen ? (
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(20rem,90vw)] overflow-hidden rounded-2xl border border-[#d4d9e0] bg-white shadow-xl">
                    <div className="flex flex-col p-1">
                      {AGENT_SELECTOR_OPTIONS.map((option) => {
                        const active = selectedAgent === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => handleSelect(option.key)}
                            className={`flex min-h-12 items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition-colors ${
                              active
                                ? "bg-[#1B6AC9]/10 text-[#1B6AC9]"
                                : "text-[#4a4e69] hover:bg-[#f0f2f5] hover:text-[#1a1a2e]"
                            }`}
                          >
                            <span>{option.label}</span>
                            {active ? <span className="text-xs text-[#1B6AC9]">Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className="text-xs text-[#8b8fa3]">{prompt.length}/2000</span>
                <button
                  id="submit-decision"
                  type="submit"
                  disabled={!prompt.trim() || isLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1B6AC9] to-[#1558a8] px-6 py-2.5 font-medium text-white shadow-lg shadow-[#1B6AC9]/15 transition-all duration-200 hover:from-[#2575d4] hover:to-[#1B6AC9] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Analyze
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>


    </motion.div>
  );
}
