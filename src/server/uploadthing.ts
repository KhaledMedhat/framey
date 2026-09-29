import sharp from "sharp";
import { UTApi, UTFile } from "uploadthing/server";

import type { ProfilePicture } from "@/interfaces/user.interface";

export const utapi = new UTApi();

const PROFILE_PICTURE_SIZE = 320;

// 2x a 1080px frame: sharp on high-density screens without shipping originals.
const MAX_EDGE = 2160;

/**
 * Applies EXIF orientation, strips metadata (including GPS), caps the long
 * edge and encodes WebP at a quality high enough that next/image's second
 * encode stays clean. Returns the size of the result.
 */
export async function encodePhoto(file: File) {
  const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90, smartSubsample: true, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return {
    file: new UTFile(
      [new Uint8Array(data)],
      file.name.replace(/\.[^.]+$/, "") + ".webp",
      { type: "image/webp" },
    ),
    width: info.width,
    height: info.height,
  };
}

/** Square-crops, shrinks to webp and uploads. Throws if the upload fails. */
export async function uploadProfilePicture(file: File): Promise<ProfilePicture> {
  const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate() // apply EXIF orientation before it is stripped
    .resize(PROFILE_PICTURE_SIZE, PROFILE_PICTURE_SIZE, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();

  const { data, error } = await utapi.uploadFiles(
    new UTFile([new Uint8Array(buffer)], "profile-picture.webp", {
      type: "image/webp",
    }),
  );
  if (error) throw new Error(error.message);

  return {
    url: data.ufsUrl,
    key: data.key,
    type: "image/webp",
    size: data.size,
    width: PROFILE_PICTURE_SIZE,
    height: PROFILE_PICTURE_SIZE,
  };
}
