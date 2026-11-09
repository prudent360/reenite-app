"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Eraser, ImageUp, PenLine, Type } from "lucide-react";
import { cn } from "@/lib/utils";

/** The canvas's drawing size; it scales to fit its box on screen. */
const WIDTH = 720;
const HEIGHT = 240;
const INK = "#1a2142";
const SCRIPT_FONT = "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive";

type Mode = "draw" | "type" | "upload";

/**
 * Draw, type or upload a signature. Reports a transparent PNG data URL (or null when empty)
 * through `onChange`; that PNG is what goes on the signed document.
 */
export function SignaturePad({
  onChange,
  name = "",
  allowUpload = false,
  invalid = false,
  label = "Signature",
}: {
  onChange: (png: string | null) => void;
  /** Used for the typed signature. */
  name?: string;
  /** Lets staff upload a scanned signature image. */
  allowUpload?: boolean;
  invalid?: boolean;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<Mode>("draw");
  const [typed, setTyped] = useState(name);
  const [empty, setEmpty] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function context() {
    const ctx = canvas.current!.getContext("2d")!;
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }

  function clear() {
    context().clearRect(0, 0, WIDTH, HEIGHT);
    setEmpty(true);
    onChange(null);
  }

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * WIDTH, y: ((event.clientY - box.top) / box.height) * HEIGHT };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (mode !== "draw") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = point(event);
    // A tap leaves a dot.
    const ctx = context();
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.75, 0, Math.PI * 2);
    ctx.fill();
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const next = point(event);
    const ctx = context();
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
  }

  function end() {
    if (!last.current) return;
    last.current = null;
    setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  }

  /** Writes the name in a handwriting-style font, as large as fits. */
  function drawTyped(text: string) {
    const ctx = context();
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const value = text.trim();
    if (!value) {
      setEmpty(true);
      onChange(null);
      return;
    }
    let size = 84;
    do {
      ctx.font = `italic ${size}px ${SCRIPT_FONT}`;
      size -= 4;
    } while (ctx.measureText(value).width > WIDTH - 60 && size > 24);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, WIDTH / 2, HEIGHT / 2);
    setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  }

  /** Fits an uploaded image onto the canvas, turning a white background transparent. */
  function drawUpload(file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose a PNG or JPG image of the signature.");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const ctx = context();
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const scale = Math.min((WIDTH - 20) / image.width, (HEIGHT - 20) / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
      const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT);
      for (let index = 0; index < pixels.data.length; index += 4) {
        if (pixels.data[index] > 225 && pixels.data[index + 1] > 225 && pixels.data[index + 2] > 225) pixels.data[index + 3] = 0;
      }
      ctx.putImageData(pixels, 0, 0);
      URL.revokeObjectURL(url);
      setEmpty(false);
      onChange(canvas.current!.toDataURL("image/png"));
    };
    image.onerror = () => setUploadError("That image couldn't be read. Try another file.");
    image.src = url;
  }

  function switchTo(next: Mode) {
    setMode(next);
    setUploadError(null);
    if (next === "type") drawTyped(typed);
    else clear();
  }

  const modes: { value: Mode; label: string; icon: typeof PenLine }[] = [
    { value: "draw", label: "Draw", icon: PenLine },
    { value: "type", label: "Type", icon: Type },
    ...(allowUpload ? [{ value: "upload" as const, label: "Upload", icon: ImageUp }] : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div role="tablist" aria-label="How to sign" className="inline-flex rounded-lg bg-surface-muted p-0.5">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={mode === item.value}
              onClick={() => switchTo(item.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                mode === item.value ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-3.5" /> {item.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "type" && (
        <input
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            drawTyped(event.target.value);
          }}
          aria-label="Type your signature"
          maxLength={60}
          className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-foreground focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
        />
      )}
      {mode === "upload" && (
        <input
          type="file"
          accept="image/png,image/jpeg"
          aria-label="Upload a signature image"
          onChange={(event) => drawUpload(event.target.files?.[0])}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-foreground"
        />
      )}

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-dashed bg-white",
          invalid ? "border-danger" : "border-border",
        )}
      >
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label={mode === "draw" ? "Signature area. Draw your signature with your finger, pen or mouse." : "Signature preview"}
          role="img"
          className={cn("block aspect-[3/1] w-full touch-none", mode === "draw" ? "cursor-crosshair" : "pointer-events-none")}
        />
        {/* Signing line, as on paper. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-6 bottom-[22%] border-b border-navy-200" />
        {empty && mode === "draw" && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-navy-300">Sign here</span>
        )}
        {!empty && (
          <button
            type="button"
            onClick={() => (mode === "type" ? (setTyped(""), drawTyped("")) : clear())}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-muted shadow-sm hover:text-foreground"
          >
            <Eraser className="size-3.5" /> Clear
          </button>
        )}
      </div>
      {uploadError && <p className="text-[13px] text-danger">{uploadError}</p>}
    </div>
  );
}
