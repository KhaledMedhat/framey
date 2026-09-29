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

export type FeedMedia = {
  id: string;
  url: string;
  type: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  cover: MediaCover | null;
  muted: boolean;
};

/** A post as the feed renders it: author, ordered media, counts, viewer state. */
export type FeedPost = {
  id: string;
  caption: string | null;
  location: string | null;
  /** Photon place id; set when the location links to /locations/<id>. */
  locationId: string | null;
  /** ISO string: crosses the server/client boundary as plain JSON. */
  createdAt: string;
  hideComments: boolean;
  hidePostInfo: boolean;
  author: PostAuthorPreview;
  media: FeedMedia[];
  /** People tagged on photos; `mediaIndex` says which slide. */
  tags: PhotoTag[];
  /** Only ever true on the viewer's own posts. */
  archived: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  followingAuthor: boolean;
  repostCount: number;
  repostedByMe: boolean;
  /** Feed only: who you follow put it there by reposting it. */
  repostedBy?: Pick<PostAuthorPreview, "username" | "profilePicture"> | null;
};

export type FeedCursor = { createdAt: string; id: string };

export type FeedPage = { posts: FeedPost[]; nextCursor: FeedCursor | null };

/** A GIPHY GIF as comments and messages keep it: its animated webp and size. */
export type Gif = { url: string; width: number; height: number };

export type PostComment = {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    profilePicture: PostAuthorPreview["profilePicture"];
  };
  likeCount: number;
  likedByMe: boolean;
  /** A GIF sent with (or instead of) the text. */
  gif: Gif | null;
  /** Only on top-level comments: replies are one level deep. */
  replies?: PostComment[];
  /** Client only: shown before the server confirmed it. */
  pending?: boolean;
};

export type PostComments = {
  postAuthorId: string;
  comments: PostComment[];
};
