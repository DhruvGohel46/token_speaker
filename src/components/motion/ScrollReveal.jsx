"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export function ScrollReveal({
  children,
  delay = 0,
  distance = 48,
  className = "",
}) {
  const ref = useRef(null);
  const inView = useInView(ref, {
    once: true,
    margin: "-8% 0px -6% 0px",
    amount: 0.2,
  });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: distance, rotateX: 6 }}
      animate={
        inView
          ? { opacity: 1, y: 0, rotateX: 0 }
          : { opacity: 0, y: distance, rotateX: 6 }
      }
      transition={{
        delay,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ transformPerspective: 960, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}
