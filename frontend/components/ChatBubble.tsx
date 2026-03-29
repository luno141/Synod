"use client";

import { motion } from "framer-motion";
import { AGENT_CONFIG_BY_KEY, type AgentOutput } from "@/lib/types";

interface ChatBubbleProps {
  panel: AgentOutput;
}

export default function ChatBubble({ panel }: ChatBubbleProps) {
  const meta = AGENT_CONFIG_BY_KEY[panel.key];
  if (!meta) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto flex gap-4 my-8"
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm border border-[#1B6AC9]/20" style={{ backgroundImage: `var(--tw-gradient-stops)` }}>
        <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${meta.gradient} opacity-20`} />
        <span className="relative z-10">{meta.icon}</span>
      </div>

      <div className="flex-1 bg-white border border-[#d4d9e0] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3 border-b border-[#e8ecf1] pb-3">
          <h3 className="text-sm font-semibold text-[#1a1a2e]">{meta.name}</h3>
          <span className="text-[10px] uppercase tracking-wider text-[#8b8fa3] px-2 py-0.5 rounded-full bg-[#f0f2f5]">
            {meta.role}
          </span>
        </div>

        {panel.understanding && (
          <div className="mb-4 text-xs italic text-[#8b8fa3]">
            {panel.understanding}
          </div>
        )}

        <div className="prose prose-sm max-w-none text-[#2a2e42] leading-relaxed whitespace-pre-wrap">
          {panel.final_output}
        </div>

        {panel.missing_information && panel.missing_information.length > 0 && panel.missing_information[0] !== "" && (
          <div className="mt-6 pt-4 border-t border-[#e8ecf1]">
            <h4 className="text-[10px] uppercase tracking-wider text-[#1B6AC9] mb-2 font-medium">Follow-Up Needed</h4>
            <ul className="space-y-1">
              {panel.missing_information.map((info, idx) => (
                <li key={idx} className="text-sm text-[#4a4e69] flex gap-2">
                  <span className="text-[#1B6AC9]">•</span>
                  {info}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}
