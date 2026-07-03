"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

interface Props {
  beforeUrl: string;
  afterUrl: string;
  alt?: string;
  className?: string;
}

// Interactive before/after comparison: the "after" image is the base layer and
// the "before" image sits on top, clipped to the left of a draggable divider.
export default function BeforeAfterSlider({ beforeUrl, afterUrl, alt = "Before and after comparison", className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, next)));
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromClientX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") setPercent((p) => Math.max(0, p - 5));
    if (e.key === "ArrowRight") setPercent((p) => Math.min(100, p + 5));
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label="Before and after comparison slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`relative select-none overflow-hidden rounded-lg bg-slate-100 cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* After (base layer) */}
      <img src={afterUrl} alt={alt} className="block w-full" draggable={false} />

      {/* Before (top layer, clipped to the left of the divider) */}
      <img
        src={beforeUrl}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
      />

      {/* Divider + handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)]"
        style={{ left: `${percent}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center">
          <ChevronsLeftRight className="w-5 h-5 text-slate-600" />
        </div>
      </div>

      {/* Corner labels */}
      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/55 text-white text-xs font-medium pointer-events-none">
        Before
      </span>
      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/55 text-white text-xs font-medium pointer-events-none">
        After
      </span>
    </div>
  );
}
