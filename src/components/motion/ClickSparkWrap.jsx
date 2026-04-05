"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useId, useState } from "react";

export function ClickSparkWrap({
  children,
  sparkCount = 14,
  sparkRadius = 28,
  sparkColor = "var(--accent)",
  className = "",
}) {
  const [bursts, setBursts] = useState([]);
  const uid = useId();

  const onPointerDown = useCallback(
    (event) => {
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const id = `${uid}-${Date.now()}`;
      const angles = Array.from(
        { length: sparkCount },
        (_, index) => (Math.PI * 2 * index) / sparkCount,
      );

      setBursts((prev) => [...prev.slice(-3), { id, x, y, angles }]);

      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 520);
    },
    [sparkCount, uid],
  );

  return (
    <span
      className={`relative inline-flex ${className}`.trim()}
      onPointerDown={onPointerDown}
    >
      <AnimatePresence>
        {bursts.map((burst) => (
          <motion.span
            key={burst.id}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-visible"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {burst.angles.map((angle, index) => (
              <motion.span
                key={`${burst.id}-${index}`}
                className="absolute h-1.5 w-1.5 rounded-full"
                style={{
                  left: burst.x,
                  top: burst.y,
                  marginLeft: -3,
                  marginTop: -3,
                  backgroundColor: sparkColor,
                  boxShadow: `0 0 12px color-mix(in srgb, ${sparkColor} 55%, transparent)`,
                }}
                initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                animate={{
                  opacity: 0,
                  scale: 0.12,
                  x: Math.cos(angle) * sparkRadius,
                  y: Math.sin(angle) * sparkRadius,
                }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </motion.span>
        ))}
      </AnimatePresence>
      {children}
    </span>
  );
}
