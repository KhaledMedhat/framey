import type { MediaCover } from "./post.interface";
import type { ProfilePicture } from "./user.interface";

export type Story = {
  id: string;
  url: string;
  type: string | null;
  width: number | null;
  height: number | null;
  cover: MediaCover | null;
  muted: boolean;
  duration: number | null;
  /** Shared with the author's close friends only. */
  closeFriends: boolean;
  /** ISO string: crosses the server/client boundary as plain JSON. */
  createdAt: string;
  seen: boolean;
  likedByMe: boolean;
  /** Only filled in for the author's own stories. */
  likeCount: number;
  viewCount: number;
  overlays: StoryOverlay[];
  /** Reposted from this person's story. */
  repostOf: string | null;
};

/** One person's stories as the viewer steps through them. */
export type StoryReel = {
  user: { id: string; username: string; profilePicture: ProfilePicture | null };
  stories: Story[];
  seen: boolean;
};

/** A line of text on a story; `x`/`y` are its centre as fractions of the frame. */
export type StoryOverlay = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  /** Drawn on a rounded plate in the text colour's opposite. */
  background: boolean;
  /** Font size as a fraction of the frame's width. */
  size: number;
};
