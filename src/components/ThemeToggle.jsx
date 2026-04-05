"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { IoMoonOutline, IoSunnyOutline } from "react-icons/io5";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted ? resolvedTheme : "light";
  const next = active === "dark" ? "light" : "dark";

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04, rotateX: 6 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="relative flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--foreground)] shadow-glass backdrop-blur-xl transition-colors duration-500 sm:h-11 sm:w-11 dark:shadow-glass-dark"
      style={{ transformPerspective: 800 }}
      aria-label={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mounted ? theme : "light"}
          initial={{ opacity: 0, y: 6, rotateX: -35 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: -6, rotateX: 35 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center text-xl"
        >
          {active === "dark" ? <IoSunnyOutline /> : <IoMoonOutline />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
