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

/** Opens a base64 file in a new tab (PDF/image) or downloads it. */
export function viewJdFile(f: JdFile) {
  const isPDF = f.type.includes('pdf') || /\.pdf$/i.test(f.name);
  const isImg = /\.(png|jpe?g|gif|webp)$/i.test(f.name);
  if (isPDF || isImg) {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      isPDF
        ? `<html><body style="margin:0;background:#333"><iframe src="${f.dataUrl}" style="width:100vw;height:100vh;border:none"></iframe></body></html>`
        : `<html><body style="margin:0;background:#1a1a1a;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${f.dataUrl}" style="max-width:100%;max-height:100vh;object-fit:contain"></body></html>`,
    );
  } else {
    const a = document.createElement('a');
    a.href = f.dataUrl;
    a.download = f.name;
    a.click();
  }
}
