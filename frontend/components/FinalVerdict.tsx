"use client";

import { motion } from "framer-motion";
import { DecisionResponse } from "@/lib/types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquareWarning,
} from "lucide-react";

interface FinalVerdictProps {
  decision: DecisionResponse;
}

export default function FinalVerdict({ decision }: FinalVerdictProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="w-full max-w-4xl mx-auto"
    >

      <div className="relative bg-white border border-[#d4d9e0] rounded-2xl p-8 mb-6 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#1B6AC9]/40 to-transparent" />

        <div className="flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#1B6AC9]/20 bg-[#1B6AC9]/10 px-3 py-1 text-xs font-medium text-[#1B6AC9]"
          >
            ✦ Executive Summary
          </motion.div>
          <p className="max-w-3xl text-sm leading-relaxed text-[#4a4e69]">
            {decision.summary}
          </p>
        </div>
      </div>


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-br from-[#1B6AC9]/5 to-[#1558a8]/5 border border-[#1B6AC9]/20 rounded-2xl p-6 mb-6"
      >
        <h3 className="text-xs uppercase tracking-wider text-[#1B6AC9] font-medium mb-3">
          Final Recommendation
        </h3>
        <p className="text-[#1a1a2e] text-base leading-relaxed font-medium">
          {decision.verdict}
        </p>
      </motion.div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-white border border-[#d4d9e0] rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h4 className="text-xs uppercase tracking-wider text-emerald-500 font-medium">
              Pros
            </h4>
          </div>
          <ul className="space-y-2">
            {decision.pros.map((pro, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#4a4e69]">
                <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                {pro}
              </li>
            ))}
          </ul>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1 }}
          className="bg-white border border-[#d4d9e0] rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" />
            <h4 className="text-xs uppercase tracking-wider text-red-500 font-medium">
              Cons
            </h4>
          </div>
          <ul className="space-y-2">
            {decision.cons.map((con, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#4a4e69]">
                <span className="text-red-500 mt-0.5 shrink-0">−</span>
                {con}
              </li>
            ))}
          </ul>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.2 }}
          className="bg-white border border-[#d4d9e0] rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs uppercase tracking-wider text-amber-500 font-medium">
              Risks
            </h4>
          </div>
          <ul className="space-y-2">
            {decision.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#4a4e69]">
                <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                {risk}
              </li>
            ))}
          </ul>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.3 }}
          className="bg-white border border-[#d4d9e0] rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageSquareWarning className="w-4 h-4 text-[#1B6AC9]" />
            <h4 className="text-xs uppercase tracking-wider text-[#1B6AC9] font-medium">
              Key Disagreements
            </h4>
          </div>
          <ul className="space-y-2">
            {decision.disagreements.length > 0 ? (
              decision.disagreements.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#4a4e69]">
                  <span className="text-[#1B6AC9] mt-0.5 shrink-0">⟡</span>
                  {d}
                </li>
              ))
            ) : (
              <li className="text-sm text-[#8b8fa3] italic">
                All agents reached consensus
              </li>
            )}
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}
