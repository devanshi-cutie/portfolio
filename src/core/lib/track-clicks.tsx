"use client";

/*
 * One delegated listener for every `data-track="event:target"` element on the
 * public site, so server components can be tagged without becoming client
 * components. Renders nothing.
 */
import { useEffect } from "react";
import { track } from "./track";
import { CLIENT_TRACK_EVENTS, type ClientTrackEvent } from "./track-events";

const EVENTS: ReadonlySet<string> = new Set(CLIENT_TRACK_EVENTS);

function isClientTrackEvent(value: string): value is ClientTrackEvent {
  return EVENTS.has(value);
}

function onClick(e: MouseEvent) {
  // auxclick also fires for right-click; only a middle click opens a link
  if (e.type === "auxclick" && e.button !== 1) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const el = target.closest("[data-track]");
  if (!el) return;
  const value = el.getAttribute("data-track") ?? "";
  const colon = value.indexOf(":");
  const event = colon === -1 ? value : value.slice(0, colon);
  if (!isClientTrackEvent(event)) return;
  track(event, colon === -1 ? "" : value.slice(colon + 1));
}

export function TrackClicks(): null {
  useEffect(() => {
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);
  return null;
}
