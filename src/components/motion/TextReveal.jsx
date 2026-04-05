"use client";

import { motion, useInView } from "framer-motion";
import { useMemo, useRef } from "react";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14, rotateX: 10 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export function TextReveal({ text, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const words = useMemo(() => text.split(" "), [text]);

  return (
    <motion.span
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      style={{ transformPerspective: 900, transformStyle: "preserve-3d" }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          variants={item}
          className="inline-block"
          style={{ marginRight: "0.3em" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
