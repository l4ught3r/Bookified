"use client";

import { useReducedMotion } from "framer-motion";

export function usePrefersReducedMotion() {
  return useReducedMotion() ?? false;
}

export function motionTransition(
  prefersReducedMotion: boolean,
  transition: { duration?: number; delay?: number; ease?: string | number[] },
) {
  if (prefersReducedMotion) {
    return { duration: 0, delay: 0 };
  }
  return transition;
}

export function staggerDelay(
  index: number,
  prefersReducedMotion: boolean,
  step = 0.05,
  maxIndex = 5,
) {
  if (prefersReducedMotion) return 0;
  return Math.min(index, maxIndex) * step;
}
