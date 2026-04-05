"use client";

import { AnimatePresence, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoPlayOutline,
  IoRefreshOutline,
  IoStopOutline,
} from "react-icons/io5";

import { ClickSparkWrap } from "@/components/motion/ClickSparkWrap";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { TextReveal } from "@/components/motion/TextReveal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useFinePointer } from "@/hooks/useFinePointer";
import { useNarrowScreen } from "@/hooks/useNarrowScreen";
import { fetchCurrentToken } from "@/utils/api";
import { parseTokenPayload } from "@/utils/tokenPayload";
import {
  listVoicesForPicker,
  pickPreferredVoice,
  resolveVoiceByUri,
} from "@/utils/speechVoices";

function AmbientField() {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const narrow = useNarrowScreen();
  const gradientSize = narrow ? 380 : 620;

  useEffect(() => {
    const onMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      mx.set(x);
      my.set(y);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my]);

  const bg = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mx}% ${my}%, rgba(29, 78, 216, 0.12), transparent 58%)`;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-noise-soft opacity-90 dark:opacity-[0.35]"
      style={{ backgroundImage: bg }}
    />
  );
}

function StatusBanner({ tone, message, onDismiss }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-start"
      role="status"
    >
      <span className="mt-0.5 shrink-0 text-lg sm:mt-0.5">
        {tone === "success" ? (
          <IoCheckmarkCircleOutline className="text-[var(--success)]" />
        ) : (
          <IoAlertCircleOutline className="text-[var(--danger)]" />
        )}
      </span>
      <p className="flex-1 text-[var(--foreground-muted)]">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-11 w-full touch-manipulation rounded-xl px-3 py-2 text-xs font-medium text-[var(--foreground-muted)] transition hover:bg-[var(--glass-highlight)] hover:text-[var(--foreground)] sm:min-h-0 sm:w-auto sm:rounded-lg sm:px-2 sm:py-1"
      >
        Dismiss
      </button>
    </motion.div>
  );
}

function EmptyTokenState() {
  return (
    <motion.div
      className="glass-panel relative overflow-hidden rounded-2xl px-4 py-7 text-center sm:px-6 sm:py-10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        aria-hidden
        className="glass-inner-shine pointer-events-none absolute inset-0 opacity-70"
        animate={{ opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <p className="relative text-sm leading-relaxed text-[var(--foreground-muted)] text-balance-safe">
        Enter a token number or sync from your live queue API. The desk will
        announce{" "}
        <span className="font-mono text-[var(--foreground)]">Token no ···</span>{" "}
        on repeat until you stop.
      </p>
    </motion.div>
  );
}

export function TokenSpeakerExperience() {
  const finePointer = useFinePointer();
  const narrow = useNarrowScreen();

  const [tokenInput, setTokenInput] = useState("");
  const [rate, setRate] = useState(1);
  /** Slightly below 1.0 reads warmer and less “chipmunk” on most engines. */
  const [pitch, setPitch] = useState(0.96);
  const [speechVoices, setSpeechVoices] = useState([]);
  /** Empty string = automatic (pick richest available voice). */
  const [voiceUri, setVoiceUri] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null);

  const runningRef = useRef(false);
  const gapTimeoutRef = useRef(null);

  const normalizedToken = useMemo(() => tokenInput.trim(), [tokenInput]);
  const hasToken = normalizedToken.length > 0;

  const pushBanner = useCallback((tone, message) => {
    setBanner({ tone, message, id: `${Date.now()}` });
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (gapTimeoutRef.current) window.clearTimeout(gapTimeoutRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const refresh = () => {
      setSpeechVoices(window.speechSynthesis.getVoices());
    };

    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const pickerVoices = useMemo(
    () => listVoicesForPicker(speechVoices),
    [speechVoices],
  );

  const resolvedVoice = useMemo(() => {
    if (!speechVoices.length) return null;
    return (
      resolveVoiceByUri(speechVoices, voiceUri) ||
      pickPreferredVoice(speechVoices)
    );
  }, [speechVoices, voiceUri]);

  const speakLoop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      pushBanner("error", "Speech synthesis is not available in this browser.");
      runningRef.current = false;
      setIsSpeaking(false);
      return;
    }

    if (!runningRef.current) return;

    const allVoices = window.speechSynthesis.getVoices();
    const voice =
      resolveVoiceByUri(allVoices, voiceUri) || pickPreferredVoice(allVoices);

    const phrase = `Token no ${normalizedToken}`;
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-US";
    } else {
      utterance.lang = "en-US";
    }

    utterance.onend = () => {
      if (!runningRef.current) return;
      gapTimeoutRef.current = window.setTimeout(() => {
        speakLoop();
      }, 160);
    };

    utterance.onerror = () => {
      if (!runningRef.current) return;
      gapTimeoutRef.current = window.setTimeout(() => {
        speakLoop();
      }, 320);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [normalizedToken, pitch, pushBanner, rate, voiceUri]);

  const startSpeaking = useCallback(() => {
    if (!hasToken) {
      pushBanner("error", "Add a token number before starting announcements.");
      return;
    }
    if (!/^\d+$/.test(normalizedToken)) {
      pushBanner("error", "Use a whole number for the token.");
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) {
      pushBanner("error", "Speech synthesis is not available in this browser.");
      return;
    }

    window.speechSynthesis.getVoices();

    runningRef.current = true;
    setIsSpeaking(true);
    window.speechSynthesis.cancel();
    speakLoop();
  }, [hasToken, normalizedToken, pushBanner, speakLoop]);

  const stopSpeaking = useCallback(() => {
    runningRef.current = false;
    if (gapTimeoutRef.current) window.clearTimeout(gapTimeoutRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const syncFromApi = useCallback(async () => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) {
      pushBanner(
        "error",
        "Set NEXT_PUBLIC_API_BASE_URL in Netlify environment variables to enable live sync.",
      );
      return;
    }

    setLoading(true);
    try {
      const payload = await fetchCurrentToken();
      const next = parseTokenPayload(payload);
      setTokenInput(String(next));
      pushBanner("success", "Token pulled from the live queue service.");
    } catch (err) {
      pushBanner(
        "error",
        err instanceof Error ? err.message : "Could not read the token from the API.",
      );
    } finally {
      setLoading(false);
    }
  }, [pushBanner]);

  const cardHover = finePointer
    ? { rotateX: 4, rotateY: -4, y: -4 }
    : { rotateX: 0, rotateY: 0, y: 0 };
  const logoHover = finePointer ? { rotateX: 8, y: -2 } : {};

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-x-hidden bg-[var(--page-bg)] transition-colors duration-500">
      <AmbientField />
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[var(--page-veil)] backdrop-blur-[2px] transition-colors duration-500" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-8 sm:pb-16 sm:pt-10 lg:px-10">
        <header className="mb-8 flex items-center justify-between gap-3 sm:mb-12 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0 items-center gap-2.5 sm:gap-3"
          >
            <motion.div
              whileHover={logoHover}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)] shadow-lift backdrop-blur-xl sm:h-12 sm:w-12 sm:rounded-2xl dark:shadow-lift-dark"
              style={{ transformPerspective: 900 }}
            >
              <IoPlayOutline className="text-xl sm:text-2xl" aria-hidden />
            </motion.div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)] sm:text-xs sm:tracking-[0.22em]">
                Production desk
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--foreground)] sm:text-xl md:text-2xl">
                Token Speaker
              </h1>
            </div>
          </motion.div>

          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col gap-6 sm:gap-10 lg:flex-row lg:items-start">
          <section className="order-2 flex-1 space-y-4 sm:space-y-6 lg:order-1">
            <ScrollReveal delay={0.05} distance={narrow ? 28 : 56}>
              <div className="space-y-2.5 sm:space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-muted)] sm:text-xs sm:tracking-[0.2em]">
                  Calm operations audio
                </p>
                <h2 className="max-w-xl text-balance-safe text-2xl font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-3xl sm:leading-tight md:text-4xl">
                  Repeat the call until the floor is clear.
                </h2>
                <p className="max-w-xl text-pretty text-sm leading-relaxed text-[var(--foreground-muted)] sm:text-base">
                  <TextReveal text="Token Speaker keeps the announcement disciplined: same phrase, same cadence, and an obvious stop control for your front desk team." />
                </p>
              </div>
            </ScrollReveal>

            <AnimatePresence>
              {banner ? (
                <StatusBanner
                  key={banner.id}
                  tone={banner.tone}
                  message={banner.message}
                  onDismiss={() => setBanner(null)}
                />
              ) : null}
            </AnimatePresence>
          </section>

          <motion.section
            className="order-1 w-full flex-1 lg:order-2 lg:max-w-md"
            initial={{ opacity: 0, y: 18, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformPerspective: 1100 }}
          >
            <motion.div
              whileHover={cardHover}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="glass-panel relative overflow-hidden rounded-3xl p-[1px] sm:rounded-[1.75rem]"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="glass-inner-shine pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative rounded-2xl bg-[var(--glass-bg)] p-4 sm:rounded-[1.7rem] sm:p-6 md:p-7">
                {!hasToken ? <EmptyTokenState /> : null}

                <div
                  className={
                    hasToken
                      ? "space-y-5 sm:space-y-6"
                      : "mt-6 space-y-5 sm:mt-8 sm:space-y-6"
                  }
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="token"
                      className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)] sm:text-xs sm:tracking-[0.18em]"
                    >
                      Token number
                    </label>
                    <input
                      id="token"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      placeholder="e.g. 428"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value.replace(/\D/g, ""))}
                      className="min-h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-white/70 px-4 py-3.5 font-mono text-base tracking-wide text-[var(--foreground)] shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--ring)] focus:ring-0 sm:min-h-0 sm:text-lg dark:bg-slate-950/40 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)] sm:text-xs sm:tracking-[0.18em]">
                        Speaking pace
                      </span>
                      <span className="font-mono text-[10px] text-[var(--foreground-muted)] sm:text-xs">
                        {rate.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.35}
                      step={0.01}
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      className="h-3 w-full cursor-pointer appearance-none rounded-full bg-slate-200/80 accent-[var(--accent)] sm:h-2 dark:bg-slate-800/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="tts-voice"
                      className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)] sm:text-xs sm:tracking-[0.18em]"
                    >
                      Voice (natural / neural)
                    </label>
                    <select
                      id="tts-voice"
                      value={voiceUri}
                      onChange={(e) => setVoiceUri(e.target.value)}
                      onFocus={() => {
                        if (typeof window !== "undefined" && window.speechSynthesis) {
                          window.speechSynthesis.getVoices();
                        }
                      }}
                      className="min-h-12 w-full cursor-pointer rounded-2xl border border-[var(--glass-border)] bg-white/70 px-4 py-3 pr-10 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--ring)] dark:bg-slate-950/40"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 0.75rem center",
                        backgroundSize: "1.1rem",
                      }}
                    >
                      <option value="">
                        Automatic — richest voice on this device
                      </option>
                      {pickerVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name}
                          {v.lang ? ` (${v.lang})` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] leading-snug text-[var(--foreground-muted)] sm:text-[11px]">
                      Prefer names with{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        Neural
                      </span>
                      ,{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        Natural
                      </span>
                      , or{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        Premium
                      </span>
                      . Edge and Safari often ship the most lifelike options.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)] sm:text-xs sm:tracking-[0.18em]">
                        Tone richness
                      </span>
                      <span className="font-mono text-[10px] text-[var(--foreground-muted)] sm:text-xs">
                        {pitch.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.88}
                      max={1.05}
                      step={0.01}
                      value={pitch}
                      onChange={(e) => setPitch(Number(e.target.value))}
                      className="h-3 w-full cursor-pointer appearance-none rounded-full bg-slate-200/80 accent-[var(--accent)] sm:h-2 dark:bg-slate-800/80"
                    />
                    <p className="text-[10px] text-[var(--foreground-muted)] sm:text-[11px]">
                      Lower is warmer and fuller; higher is brighter. Default
                      leans human rather than robotic.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <motion.button
                      type="button"
                      whileHover={finePointer ? { scale: 1.02, y: -1 } : {}}
                      whileTap={{ scale: 0.98 }}
                      disabled={loading}
                      onClick={syncFromApi}
                      className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/60 px-4 py-3.5 text-base font-semibold text-[var(--foreground)] shadow-sm transition enabled:active:scale-[0.99] enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-3 sm:text-sm dark:bg-slate-950/35"
                    >
                      <motion.span
                        animate={loading ? { rotate: 360 } : { rotate: 0 }}
                        transition={
                          loading
                            ? { repeat: Infinity, duration: 0.9, ease: "linear" }
                            : { duration: 0.2 }
                        }
                      >
                        <IoRefreshOutline className="text-lg" aria-hidden />
                      </motion.span>
                      {loading ? "Syncing…" : "Sync from API"}
                    </motion.button>

                    {!isSpeaking ? (
                      <ClickSparkWrap
                        sparkColor="var(--accent)"
                        sparkCount={14}
                        sparkRadius={26}
                        className="w-full"
                      >
                        <motion.button
                          type="button"
                          whileHover={finePointer ? { scale: 1.03, y: -2 } : {}}
                          whileTap={{ scale: 0.97 }}
                          onClick={startSpeaking}
                          className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3.5 text-base font-semibold text-[var(--accent-foreground)] shadow-lift transition active:brightness-95 sm:min-h-0 sm:py-3 sm:text-sm dark:shadow-lift-dark"
                        >
                          <IoPlayOutline className="text-xl sm:text-lg" aria-hidden />
                          Start speaking
                        </motion.button>
                      </ClickSparkWrap>
                    ) : (
                      <motion.button
                        type="button"
                        whileHover={finePointer ? { scale: 1.03, y: -2 } : {}}
                        whileTap={{ scale: 0.97 }}
                        onClick={stopSpeaking}
                        className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-3.5 text-base font-semibold text-[var(--danger)] shadow-sm active:brightness-95 sm:col-span-2 sm:min-h-0 sm:py-3 sm:text-sm"
                      >
                        <IoStopOutline className="text-xl sm:text-lg" aria-hidden />
                        Stop announcements
                      </motion.button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/40 px-3 py-3 text-[11px] text-[var(--foreground-muted)] sm:px-4 sm:text-xs dark:bg-slate-950/30">
                    <p className="font-mono text-[10px] leading-relaxed text-[var(--foreground)] sm:text-[11px]">
                      {hasToken
                        ? `Repeating: “Token no ${normalizedToken}”`
                        : "Waiting for a token to announce."}
                    </p>
                    {resolvedVoice ? (
                      <p className="mt-2 text-[10px] leading-snug text-[var(--foreground-muted)] sm:text-[11px]">
                        Active voice:{" "}
                        <span className="font-medium text-[var(--foreground)]">
                          {resolvedVoice.name}
                        </span>
                      </p>
                    ) : speechVoices.length === 0 ? (
                      <p className="mt-2 text-[10px] text-[var(--foreground-muted)] sm:text-[11px]">
                        Loading voices… tap Start once if the list stays empty
                        (browser quirk).
                      </p>
                    ) : null}
                    {isSpeaking ? (
                      <motion.div
                        className="mt-3 flex items-center gap-2"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-40" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                        </span>
                        <span>Live announcements</span>
                      </motion.div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.section>
        </main>

        <footer className="mt-auto pt-10 text-center text-[10px] leading-snug text-[var(--foreground-muted)] sm:pt-16 sm:text-[11px]">
          <span className="sm:hidden">Token Speaker</span>
          <span className="hidden sm:inline">
            Token Speaker · Next.js · Netlify
          </span>
        </footer>
      </div>
    </div>
  );
}
