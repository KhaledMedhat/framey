import { auth } from "@/server/auth";

type GiphyImage = { webp?: string; url: string; width: string; height: string };
type GiphyGif = {
  id: string;
  title: string;
  images: { fixed_width: GiphyImage; fixed_width_small: GiphyImage };
};

const PAGE = 24;

/**
 * `?q=` searches GIPHY (trending without one), `&offset=` pages. Proxied so
 * the API key stays on the server; each GIF comes back as what comments and
 * messages store (its 200px-wide animated webp) plus a smaller preview.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Sign in first." }, { status: 401 });
  }
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    return Response.json({ message: "GIFs aren't set up." }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 50) ?? "";
  const offset = Math.min(Math.max(Number(params.get("offset")) || 0, 0), 4999);
  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}`);
  url.search = new URLSearchParams({
    api_key: key,
    limit: String(PAGE),
    offset: String(offset),
    rating: "pg-13",
    bundle: "messaging_non_clips",
    ...(q && { q }),
  }).toString();

  const res = await fetch(url, { next: { revalidate: q ? 600 : 3600 } }).catch(() => null);
  if (!res?.ok) {
    return Response.json({ message: "Couldn't load GIFs." }, { status: 502 });
  }
  const body = (await res.json()) as {
    data: GiphyGif[];
    pagination: { total_count: number };
  };
  return Response.json({
    gifs: body.data.map(({ id, title, images }) => ({
      id,
      title,
      url: images.fixed_width.webp ?? images.fixed_width.url,
      width: Number(images.fixed_width.width),
      height: Number(images.fixed_width.height),
      preview: images.fixed_width_small.webp ?? images.fixed_width_small.url,
    })),
    nextOffset:
      offset + PAGE < body.pagination.total_count ? offset + PAGE : null,
  });
}
