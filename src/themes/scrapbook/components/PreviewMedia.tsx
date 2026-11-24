"use client";

/**
 * Poster-first media tile. Videos never download until they are needed:
 * - with a Cloudinary poster: <img> poster + <video preload="none">, the video
 *   only loads and fades in when `play` turns true;
 * - in local preview (no poster service): once near the viewport, a
 *   <video preload="metadata"> shows the frame at 0.5s.
 * Codecs the browser cannot decode (some HEVC .MOV files) fall back to a
 * quiet placeholder instead of a broken box.
 */
import { Film } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/core/types/content";
import { isVideo, labelOf, posterOf, videoSrcOf, withFrameHint } from "../lib/media";
import { cn } from "../lib/cn";
import { playExclusive, stop } from "../motion/playback";

export function PreviewMedia({
  media,
  width,
  play = false,
  eager = false,
  className,
  sizes,
}: {
  media: MediaItem;
  width: number;
  play?: boolean;
  /** above the fold: load immediately, high priority */
  eager?: boolean;
  className?: string;
  sizes?: string;
}) {
  const video = isVideo(media);
  const poster = posterOf(media, width);
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const [requested, setRequested] = useState(false);

  // Local preview: mount the <video> (metadata only) once it is close to view.
  useEffect(() => {
    if (!video || poster || near || !box.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [video, poster, near]);

  // Derived during render (no effect): once asked to play, keep the video mounted.
  if (play && !requested) setRequested(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || broken) return;
    if (play) playExclusive(v);
    else stop(v);
  }, [play, broken, requested, near]);

  if (!video) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image; local preview is same-origin
      <img
        src={poster ?? ""}
        alt={labelOf(media)}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        className={cn("size-full object-cover", className)}
      />
    );
  }

  const src = videoSrcOf(media, width);
  const mountVideo = poster ? requested : near;

  return (
    <div ref={box} className={cn("relative size-full", className)}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-sized poster frame
        <img
          src={poster}
          alt=""
          aria-hidden
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#4a2a33,#2c1119)]" />
      )}
      {mountVideo && !broken ? (
        <video
          ref={ref}
          src={poster ? src : withFrameHint(src)}
          muted
          loop
          playsInline
          preload={poster ? "none" : "metadata"}
          aria-hidden
          tabIndex={-1}
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedData={(e) => {
            if (e.currentTarget.videoWidth === 0) setBroken(true);
          }}
          onError={() => setBroken(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200",
            poster && !playing ? "opacity-0" : "opacity-100",
          )}
        />
      ) : null}
      {broken && !poster ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-(--cream)/80">
          <Film className="size-6" strokeWidth={1.5} aria-hidden />
          <span className="text-xs font-medium">Preview unavailable</span>
        </div>
      ) : null}
    </div>
  );
}
