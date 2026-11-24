"use client";

import { useEffect, useRef, useState } from "react";
import { Film, ImageOff } from "lucide-react";
import type { MediaItem } from "@/core/types/content";
import { thumbUrl, videoUrl } from "@/core/cloudinary/urls";
import { cn } from "../lib/cn";

interface MediaThumbProps {
  media: MediaItem | null | undefined;
  /** requested pixel width of the thumbnail */
  width?: number;
  className?: string;
  /** object-fit; logos look better contained */
  fit?: "cover" | "contain";
  alt?: string;
}

/**
 * Poster image for any media item. Cloudinary media get a transformed image/poster URL;
 * local preview videos (no poster URL) mount a muted <video> once scrolled into view.
 */
export function MediaThumb({ media, width = 320, className, fit = "cover", alt }: MediaThumbProps) {
  const [failed, setFailed] = useState(false);
  const fitClass = fit === "cover" ? "object-cover" : "object-contain p-1.5";

  if (!media) {
    return (
      <div className={cn("flex items-center justify-center bg-(--a-muted) text-(--a-ink-faint)", className)} aria-hidden>
        <ImageOff className="size-5" />
      </div>
    );
  }

  const src = thumbUrl(media, width);
  if (!src && media.resourceType === "video") {
    return <LazyVideoFrame media={media} fit={fit} className={className} />;
  }
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-(--a-muted) text-(--a-ink-faint)", className)} aria-hidden>
        {media.resourceType === "video" ? <Film className="size-5" /> : <ImageOff className="size-5" />}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary already serves a resized f_auto image
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("bg-(--a-muted)", fitClass, className)}
    />
  );
}

function LazyVideoFrame({ media, fit, className }: { media: MediaItem; fit: "cover" | "contain"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const offset = media.posterOffset > 0 ? media.posterOffset : 0.5;
  return (
    <div ref={ref} className={cn("overflow-hidden bg-(--a-muted-strong)", className)}>
      {visible ? (
        <video
          src={`${videoUrl(media)}#t=${offset}`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          aria-hidden
          className={cn("pointer-events-none size-full", fit === "cover" ? "object-cover" : "object-contain")}
        />
      ) : null}
    </div>
  );
}
