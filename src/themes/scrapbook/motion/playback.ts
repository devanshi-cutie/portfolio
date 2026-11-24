"use client";

/**
 * One playing preview video at a time across the whole page (hero, grid, BTS).
 * Opening the lightbox pauses whatever preview is running.
 */
let current: HTMLVideoElement | null = null;

export function playExclusive(video: HTMLVideoElement) {
  if (current && current !== video) current.pause();
  current = video;
  video.muted = true;
  const p = video.play();
  if (p) p.catch(() => {});
}

export function stop(video: HTMLVideoElement) {
  video.pause();
  if (current === video) current = null;
}

export function pauseAll() {
  current?.pause();
  current = null;
}
