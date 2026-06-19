import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = "documents"
): Promise<{ key: string; url: string }> {
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  const blob = await put(key, buffer, {
    access: 'public',
    contentType: mimeType,
  });

  return { key, url: blob.url };
}

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export function validateFileType(mimeType: string) {
  return ALLOWED_TYPES[mimeType] !== undefined;
}