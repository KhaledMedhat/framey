export function isImageFile(file: Pick<File, "type">) {
  return file.type.startsWith("image/");
}

export function isVideoFile(file: Pick<File, "type">) {
  return file.type.startsWith("video/");
}

export function isAudioFile(file: Pick<File, "type">) {
  return file.type.startsWith("audio/");
}

export function isAudioType(type?: string | null) {
  return Boolean(type?.startsWith("audio/"));
}

export function isVideoType(type?: string | null) {
  return Boolean(type?.startsWith("video/"));
}
