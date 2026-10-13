// Browser file helpers.

import type { JdFile } from './types';

/**
 * Reads File objects into JdFile records with base64 data URLs.
 *
 * TODO(storage): this inlines file bytes into the DB row. When the storage
 * provider is chosen, replace this with an upload that returns a URL.
 */
export function readFilesAsJd(files: File[]): Promise<JdFile[]> {
  return Promise.all(
    files.map(
      (f) =>
        new Promise<JdFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              name: f.name,
              size: f.size,
              type: f.type,
              dataUrl: String(reader.result),
            });
          reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
          reader.readAsDataURL(f);
        }),
    ),
  );
}

function isPdf(f: JdFile) {
  return f.type.includes('pdf') || /\.pdf$/i.test(f.name);
}

/** Image MIME type from the file extension (never trust the stored type), or null. */
function imageType(name: string): string | null {
  const m = name.toLowerCase().match(/\.(png|jpe?g|gif|webp)$/);
  if (!m) return null;
  return m[1] === 'jpg' ? 'image/jpeg' : `image/${m[1]}`;
}

/**
 * Opens a JD file in a new tab (PDF/image) or downloads it.
 *
 * `f` may be metadata only (no dataUrl) — then `load` fetches the bytes. The tab
 * is opened before the fetch so popup blockers still treat it as a click.
 * The viewer gets a blob URL whose type we choose (application/pdf, image/*,
 * or octet-stream), so a file with a crafted stored type can never be rendered
 * as HTML in the app's origin.
 */
export async function openJdFile(f: JdFile, load?: () => Promise<JdFile>) {
  const img = imageType(f.name);
  const viewType = isPdf(f) ? 'application/pdf' : img;
  const w = viewType ? window.open('', '_blank') : null;
  try {
    const full = f.dataUrl ? f : load ? await load() : null;
    if (!full?.dataUrl) throw new Error('File content unavailable.');
    const bytes = await (await fetch(full.dataUrl)).blob();
    const url = URL.createObjectURL(
      new Blob([bytes], { type: viewType ?? 'application/octet-stream' }),
    );
    if (w) {
      w.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Always downloads (never opens) a JD file. */
export async function downloadJdFile(f: JdFile, load?: () => Promise<JdFile>) {
  const full = f.dataUrl ? f : load ? await load() : null;
  if (!full?.dataUrl) throw new Error('File content unavailable.');
  const bytes = await (await fetch(full.dataUrl)).blob();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
