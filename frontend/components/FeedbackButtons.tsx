"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { submitFeedback } from "@/lib/api";

interface FeedbackButtonsProps {
  decisionId: string;
}

export default function FeedbackButtons({ decisionId }: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFeedback = async (result: "worked" | "didnt_work") => {
    setIsLoading(true);
    try {
      await submitFeedback({ decision_id: decisionId, result });
      setSubmitted(result);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5 }}
      className="flex flex-col items-center gap-3 mt-8"
    >
      <p className="text-xs text-[#8b8fa3] uppercase tracking-wider">
        Was this recommendation helpful?
      </p>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-sm"
          >
            <Check className="w-4 h-4" />
            Thanks! Your feedback improves future recommendations.
          </motion.div>
        ) : (
          <motion.div key="buttons" className="flex items-center gap-3">
            <button
              id="feedback-worked"
              onClick={() => handleFeedback("worked")}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#d4d9e0] rounded-xl text-[#4a4e69] text-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all duration-200 disabled:opacity-50 shadow-sm"
            >
              <ThumbsUp className="w-4 h-4" />
              Worked
            </button>
            <button
              id="feedback-didnt-work"
              onClick={() => handleFeedback("didnt_work")}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#d4d9e0] rounded-xl text-[#4a4e69] text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-200 disabled:opacity-50 shadow-sm"
            >
              <ThumbsDown className="w-4 h-4" />
              Didn&apos;t Work
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
