export async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function isImageFile(file: Pick<File, "type">) {
  return file.type.startsWith("image/");
}

export function isVideoFile(file: Pick<File, "type">) {
  return file.type.startsWith("video/");
}

export function isVideoType(type?: string | null) {
  return Boolean(type?.startsWith("video/"));
}
