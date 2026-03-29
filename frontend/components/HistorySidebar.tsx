"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export interface SidebarThread {
  id: string;
  prompt: string;
  mode: "council" | "specialist";
  agentLabel: string;
}

interface HistorySidebarProps {
  threads: SidebarThread[];
  activeThreadId?: string | null;
  onSelectThread?: (id: string) => void;
  onNewChat?: () => void;
}

export default function HistorySidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
}: HistorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="fixed top-3 left-3 z-50 p-2 bg-white border border-[#d4d9e0] rounded-lg text-[#8b8fa3] hover:text-[#1B6AC9] transition-colors shadow-sm"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      <AnimatePresence>
        {!isCollapsed && (
          <motion.aside
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed top-0 left-0 h-full w-[260px] bg-white border-r border-[#d4d9e0] z-40 flex flex-col"
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg text-[#8b8fa3] hover:text-[#1B6AC9] hover:bg-[#1B6AC9]/5 transition-colors"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>

            <div className="px-3 pb-3">
              <button
                onClick={onNewChat}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[#d4d9e0] text-[#4a4e69] hover:bg-[#1B6AC9]/5 hover:text-[#1B6AC9] hover:border-[#1B6AC9]/20 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                New Analysis
              </button>
            </div>

            <div className="h-px bg-[#e8ecf1] mx-3" />

            <div className="flex-1 overflow-y-auto py-2 px-1">
              {threads.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Sparkles className="w-7 h-7 text-[#d4d9e0] mx-auto mb-3" />
                  <p className="text-sm text-[#8b8fa3]">No conversations yet</p>
                  <p className="text-xs text-[#8b8fa3] mt-1">
                    Start an analysis to see it here
                  </p>
                </div>
              ) : (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8b8fa3] font-medium">
                    This Session
                  </p>
                  {threads.map((thread) => {
                    const isActive = activeThreadId === thread.id;
                    return (
                      <button
                        key={thread.id}
                        onClick={() => onSelectThread?.(thread.id)}
                        className={`w-full px-3 py-2 text-left rounded-lg mx-1 transition-colors duration-150 group flex items-center gap-2.5 ${
                          isActive
                            ? "bg-[#1B6AC9]/10 text-[#1B6AC9]"
                            : "text-[#4a4e69] hover:bg-[#1B6AC9]/5 hover:text-[#1a1a2e]"
                        }`}
                        style={{ width: "calc(100% - 8px)" }}
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        <span className="text-sm truncate flex-1">
                          {thread.prompt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#e8ecf1]">
              <p className="text-[13px] font-bold tracking-wide text-[#1B6AC9]">
                Synod
              </p>
              <p className="text-[10px] text-[#8b8fa3] mt-0.5">
                Multi-Agent Intelligence
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
