"use client";

import { motion } from "framer-motion";

import {
  AGENT_CONFIG_BY_KEY,
  VISIBLE_COUNCIL_AGENT_ORDER,
  type AgentKey,
} from "@/lib/types";

interface ThinkingAnimationProps {
  completedKeys?: AgentKey[];
  activeKeys?: AgentKey[];
}

export default function ThinkingAnimation({
  completedKeys = [],
  activeKeys = VISIBLE_COUNCIL_AGENT_ORDER,
}: ThinkingAnimationProps) {
  const completed = new Set(completedKeys);
  const activeAgents = activeKeys.map((key) => AGENT_CONFIG_BY_KEY[key]).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-6 w-full max-w-5xl"
    >
      <div className="mb-8 text-center">
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="text-lg font-medium text-[#4a4e69]"
        >
          Lanterns are lighting across the council chamber...
        </motion.div>
        <p className="mt-1 text-sm text-[#8b8fa3]">
          Synod is streaming each specialist panel as it finishes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {activeAgents.map((agent, index) => {
          const isComplete = completed.has(agent.key);

          return (
            <motion.div
              key={agent.key}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08, duration: 0.35 }}
              className="relative"
            >
              <motion.div
                animate={
                  isComplete
                    ? { opacity: [0.1, 0.2, 0.1], scale: [1, 1.02, 1] }
                    : { opacity: [0.05, 0.12, 0.05], scale: [1, 1.05, 1] }
                }
                transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.15 }}
                className="absolute inset-0 rounded-xl bg-[#1B6AC9]/10"
              />

              <div
                className={`relative rounded-xl border p-4 text-center transition-colors ${
                  isComplete
                    ? "border-[#1B6AC9]/30 bg-[#1B6AC9]/5"
                    : "border-[#d4d9e0] bg-white"
                }`}
              >
                <motion.div
                  animate={
                    isComplete ? { scale: [1, 1.08, 1] } : { rotate: [0, 4, -4, 0] }
                  }
                  transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.18 }}
                  className="mb-2 text-2xl"
                >
                  {agent.icon}
                </motion.div>

                <div className="text-sm font-medium text-[#1a1a2e]">{agent.name}</div>
                <div className="mt-1 text-xs text-[#8b8fa3]">
                  {isComplete ? "Panel ready" : "Reasoning..."}
                </div>

                {!isComplete ? (
                  <div className="mt-2 flex justify-center gap-1">
                    {[0, 1, 2].map((dot) => (
                      <motion.div
                        key={dot}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: dot * 0.2 + index * 0.06,
                        }}
                        className="h-1.5 w-1.5 rounded-full bg-[#8b8fa3]"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[#1B6AC9]">
                    streamed
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 h-1 overflow-hidden rounded-full bg-[#e8ecf1]">
        <motion.div
          initial={{ width: "0%" }}
          animate={{
            width: `${Math.max(10, (completed.size / Math.max(1, activeAgents.length)) * 100)}%`,
          }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-[#1B6AC9] via-[#1558a8] to-[#1B6AC9]"
        />
      </div>
    </motion.div>
  );
}
