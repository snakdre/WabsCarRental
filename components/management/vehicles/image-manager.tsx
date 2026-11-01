"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GripVertical, Star, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  registerVehicleImage, setCoverImage, reorderVehicleImages, deleteVehicleImage, updateImageAlt,
} from "@/lib/actions/management-vehicle-images";
import {
  VEHICLE_IMAGES_BUCKET, IMAGE_MIME_TYPES, MAX_IMAGES_PER_VEHICLE, validateImageFile, imageExt,
} from "@/lib/validators/management-vehicles";
import type { ManagementVehicleImage } from "@/lib/queries/management-vehicles";

type UploadItem = { key: string; name: string; progress: number; error?: string };

const form = (e: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, v);
  return f;
};

export function ImageManager({ vehicleId, images: initial }: { vehicleId: string; images: ManagementVehicleImage[] }) {
  const [images, setImages] = useState(initial);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Server revalidation re-renders with fresh props; adopt them.
  useEffect(() => setImages(initial), [initial]);

  const patchUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads(u => u.map(x => (x.key === key ? { ...x, ...patch } : x)));

  const uploadFiles = async (files: File[]) => {
    setError(null);
    const room = MAX_IMAGES_PER_VEHICLE - images.length;
    if (files.length > room) {
      setError(`You can add ${room} more image${room === 1 ? "" : "s"} (max ${MAX_IMAGES_PER_VEHICLE}).`);
      files = files.slice(0, Math.max(room, 0));
    }
    const supabase = createClient();

    await Promise.all(files.map(async file => {
      const key = crypto.randomUUID();
      const invalid = validateImageFile(file);
      setUploads(u => [...u, { key, name: file.name, progress: 0, error: invalid ?? undefined }]);
      if (invalid) return;

      const path = `${vehicleId}/${crypto.randomUUID()}.${imageExt(file.type)}`;
      // supabase-js has no upload progress callback; show an indeterminate
      // stage-based progress (0 → 50 uploading → 90 registering → 100).
      patchUpload(key, { progress: 50 });
      const { error: upErr } = await supabase.storage
        .from(VEHICLE_IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { patchUpload(key, { error: upErr.message, progress: 0 }); return; }

      patchUpload(key, { progress: 90 });
      const res = await registerVehicleImage(form({
        vehicle_id: vehicleId,
        storage_path: path,
        alt_text: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      }));
      if (res.error) {
        await supabase.storage.from(VEHICLE_IMAGES_BUCKET).remove([path]);
        patchUpload(key, { error: res.error, progress: 0 });
        return;
      }
      patchUpload(key, { progress: 100 });
      setTimeout(() => setUploads(u => u.filter(x => x.key !== key)), 1500);
    }));
  };

  const run = (fn: () => Promise<{ error?: string }>, rollback?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) { setError(res.error); rollback?.(); }
    });
  };

  const onDropReorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const prev = images;
    const next = [...images];
    const from = next.findIndex(i => i.id === dragId);
    const to = next.findIndex(i => i.id === targetId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setImages(next);
    setDragId(null);
    run(() => reorderVehicleImages(vehicleId, next.map(i => i.id)), () => setImages(prev));
  };

  const move = (id: string, delta: number) => {
    const idx = images.findIndex(i => i.id === id);
    const target = images[idx + delta];
    if (!target) return;
    const prev = images;
    const next = [...images];
    [next[idx], next[idx + delta]] = [next[idx + delta], next[idx]];
    setImages(next);
    run(() => reorderVehicleImages(vehicleId, next.map(i => i.id)), () => setImages(prev));
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4" data-testid="image-manager">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">Images</h2>
        <p className="text-xs text-text-muted-wabs">{images.length} / {MAX_IMAGES_PER_VEHICLE} · drag to reorder</p>
      </div>

      <div
        onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropActive(true); } }}
        onDragLeave={() => setDropActive(false)}
        onDrop={e => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDropActive(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dropActive ? "border-gold bg-gold/5" : "border-gray-300 hover:border-gold"
        }`}
      >
        <Upload className="w-6 h-6 mx-auto text-text-muted-wabs mb-2" />
        <p className="text-sm text-navy">Drop images here or click to choose</p>
        <p className="text-xs text-text-muted-wabs">JPEG, PNG or WebP · up to 10 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={IMAGE_MIME_TYPES.join(",")}
          className="hidden"
          data-testid="image-input"
          onChange={e => { if (e.target.files) uploadFiles(Array.from(e.target.files)); e.target.value = ""; }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map(u => (
            <li key={u.key} className="text-sm">
              <div className="flex justify-between">
                <span className="text-navy truncate">{u.name}</span>
                <span className={u.error ? "text-red-600" : "text-text-muted-wabs"}>{u.error ?? `${u.progress}%`}</span>
              </div>
              {!u.error && (
                <div className="h-1 bg-gray-100 rounded mt-1">
                  <div className="h-1 bg-gold rounded transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {images.length === 0 ? (
        <p className="text-sm text-text-muted-wabs">No images yet. The first image you add becomes the cover.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((img, i) => (
            <li
              key={img.id}
              draggable
              onDragStart={e => { setDragId(img.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={e => { if (dragId) e.preventDefault(); }}
              onDrop={e => { if (dragId) { e.preventDefault(); onDropReorder(img.id); } }}
              onDragEnd={() => setDragId(null)}
              className={`border rounded-lg overflow-hidden bg-white ${dragId === img.id ? "opacity-50" : ""} ${
                img.is_cover ? "border-gold ring-1 ring-gold" : "border-gray-200"
              }`}
              data-testid="vehicle-image"
            >
              <div className="relative aspect-[16/10] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt_text ?? ""} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-white/90 rounded p-1 cursor-grab" aria-hidden>
                  <GripVertical className="w-4 h-4 text-navy" />
                </span>
                {img.is_cover && (
                  <span className="absolute top-2 right-2 text-xs bg-gold text-deep font-semibold rounded px-2 py-0.5">Cover</span>
                )}
              </div>
              <div className="p-3 space-y-2">
                <AltTextField imageId={img.id} initial={img.alt_text} />
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-2">
                    <button type="button" disabled={i === 0 || isPending} onClick={() => move(img.id, -1)} className="text-navy disabled:opacity-30" aria-label="Move earlier">←</button>
                    <button type="button" disabled={i === images.length - 1 || isPending} onClick={() => move(img.id, 1)} className="text-navy disabled:opacity-30" aria-label="Move later">→</button>
                  </div>
                  <div className="flex gap-3">
                    {!img.is_cover && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          const prev = images;
                          setImages(images.map(x => ({ ...x, is_cover: x.id === img.id })));
                          run(() => setCoverImage(form({ image_id: img.id, vehicle_id: vehicleId })), () => setImages(prev));
                        }}
                        className="inline-flex items-center gap-1 text-gold hover:underline"
                      >
                        <Star className="w-3 h-3" /> Make cover
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm("Delete this image?")) return;
                        const prev = images;
                        setImages(images.filter(x => x.id !== img.id));
                        run(() => deleteVehicleImage(form({ image_id: img.id })), () => setImages(prev));
                      }}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AltTextField({ imageId, initial }: { imageId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = async () => {
    if ((initial ?? "") === value) return;
    setState("saving");
    const res = await updateImageAlt(form({ image_id: imageId, alt_text: value }));
    setState(res.error ? "error" : "saved");
  };
  return (
    <label className="block">
      <span className="sr-only">Alt text</span>
      <input
        value={value}
        onChange={e => { setValue(e.target.value); setState("idle"); }}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        maxLength={200}
        placeholder="Alt text (describe the photo)"
        className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-navy focus:border-gold focus:outline-none"
      />
      {state !== "idle" && (
        <span className={`text-[11px] ${state === "error" ? "text-red-600" : "text-text-muted-wabs"}`}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Couldn't save"}
        </span>
      )}
    </label>
  );
}
