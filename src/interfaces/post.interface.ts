export type PhotoTag = {
  userId: string;
  username: string;
  x: number;
  y: number;
  mediaIndex: number;
};

export type MediaTag = {
  userId: string;
  username: string;
  x: number;
  y: number;
};

export type MediaCover = {
  url: string;
  type?: string;
  size?: number;
  key?: string;
  width?: number;
  height?: number;
};

export type PostMediaFile = {
  url: string;
  type?: string;
  size?: number;
  key?: string;
  width?: number;
  height?: number;
  alt?: string;
  tags?: MediaTag[];
  cover?: MediaCover | null;
  muted?: boolean;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
};

export type EditedPostMedia = {
  file: File;
  cover?: File;
  muted?: boolean;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  coverTime?: number;
  ratio?: "original" | "1:1" | "4:5" | "16:9";
  width?: number;
  height?: number;
  needsCompress?: boolean;
};

export type UploadedPostMedia = {
  url: string;
  type?: string;
  size?: number;
  key?: string;
  width?: number;
  height?: number;
  cover: MediaCover | null;
};

export type UploadPostMediaResult =
  | { data: UploadedPostMedia[]; error?: undefined }
  | { data?: undefined; error: { message: string } };

export type PostAuthorPreview = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: {
    url: string;
    type?: string;
    size?: number;
    key?: string;
  } | null;
  visibility: string;
};
