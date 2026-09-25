// Dev-only: fills a user's feed with clearly synthetic sample content until the
// post composer exists. Every account it creates is `demo_*` with an
// `@framey.invalid` email, so nothing here can pass for a real person.
//
//   pnpm db:seed:feed <your-username>   (re)create the demo accounts and posts
//   pnpm db:seed:feed --clean           remove them (posts, likes, follows cascade)
//
// createdAt has no database default (the schema sets it with $defaultFn), so
// every insert below passes it explicitly.
//
// Photos: picsum.photos (Unsplash-licensed). Video: MDN's CC0 "flower" clip.

import { neon } from "@neondatabase/serverless";

if (process.env.NODE_ENV === "production") {
  throw new Error("seed-feed is a development script");
}
const sql = neon(process.env.DATABASE_URL);
const arg = process.argv[2];
if (!arg) {
  console.error("Usage: pnpm db:seed:feed <your-username> | --clean");
  process.exit(1);
}

const clean = () => sql`delete from framey_user where username like 'demo\\_%'`;

await clean();
if (arg === "--clean") {
  console.log("Removed the demo accounts and everything they posted.");
  process.exit(0);
}

const [viewer] = await sql`select id from framey_user where username = ${arg.toLowerCase()}`;
if (!viewer) {
  console.error(`No user named "${arg}".`);
  process.exit(1);
}

const RATIO = { portrait: [1080, 1350], square: [1080, 1080], wide: [1080, 608] };

/** picsum redirects to a signed fastly URL; store the final one. */
async function photo(id, ratio) {
  const [w, h] = RATIO[ratio];
  const res = await fetch(`https://picsum.photos/id/${id}/${w}/${h}`);
  await res.body?.cancel();
  if (!res.ok) throw new Error(`picsum ${id}: ${res.status}`);
  return { url: res.url, type: "image/jpeg", width: w, height: h };
}

const VIDEO = {
  url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  type: "video/mp4",
  width: 960,
  height: 540,
  muted: true,
};

const people = [
  { username: "demo_nour", firstName: "Nour", lastName: "Haddad", avatar: 64, followed: true },
  { username: "demo_theo", firstName: "Theo", lastName: "Laurent", avatar: 30, followed: true },
  { username: "demo_mika", firstName: "Mika", lastName: "Sato", avatar: 1025, followed: true },
  { username: "demo_sara", firstName: "Sara", lastName: "Lindqvist", avatar: 106, followed: true },
  // Left unfollowed so the side rail has someone to suggest.
  { username: "demo_jonas", firstName: "Jonas", lastName: "Weber", avatar: 1074, followed: false },
];

// hoursAgo spaces the posts out so the feed reads like real time passing.
const postsToSeed = [
  { by: "demo_nour", hoursAgo: 0.6, caption: "Preikestolen at 7am. Worth every switchback.", location: "Preikestolen, Norway", media: [[1015, "portrait", "A fjord seen from the top of a sheer granite cliff"], [1018, "portrait", "A road winding between green ridges under low cloud"]] },
  { by: "demo_theo", hoursAgo: 2, caption: "First strawberries of the season, straight from the market.", location: "Marché d'Aligre, Paris", media: [[1080, "square", "A crate of ripe strawberries"]] },
  { by: "demo_mika", hoursAgo: 5, caption: "Mochi has officially entered blanket season.", media: [[1025, "portrait", "A pug wrapped in a plaid blanket on a forest path"], [1062, "portrait", "The same pug peeking out from a knit blanket"]] },
  { by: "demo_sara", hoursAgo: 9, caption: "Spring, in motion and standing still.", location: "Stockholm", media: [["video", "wide", "Close-up of a flower moving in the wind"], [106, "wide", "Pink blossoms against a clear sky"]] },
  { by: "demo_nour", hoursAgo: 20, caption: "Skógafoss doing its rainbow trick.", location: "Skógafoss, Iceland", media: [[1035, "portrait", "A person with arms raised in front of a waterfall and a rainbow"]] },
  { by: "demo_theo", hoursAgo: 29, caption: "Office for the day. The flat white was the deciding factor.", location: "Lisbon", media: [[42, "wide", "A long wooden table in a quiet café"], [30, "wide", "A red and white enamel mug"], [48, "wide", "A laptop on a desk by a window"]] },
  { by: "demo_sara", hoursAgo: 46, caption: "Neuschwanstein, finally without the crowds. (7:40am, no regrets.)", location: "Schwangau, Germany", media: [[1040, "portrait", "A white castle on a forested hill"]] },
  { by: "demo_mika", hoursAgo: 70, caption: "Everything that made it into the carry-on.", media: [[26, "square", "Sunglasses, a watch, headphones and a phone laid out on grey felt"]] },
  { by: "demo_nour", hoursAgo: 96, caption: "Three days, three kinds of rock.", media: [[1016, "portrait", "Red sandstone cliffs at sunset"], [1043, "portrait", "A granite wall above a pine forest and a river"], [29, "portrait", "Snow-covered mountain peaks"]] },
  { by: "demo_theo", hoursAgo: 130, caption: "Found the last lighthouse on the coast road.", media: [[58, "portrait", "A black-and-white photo of a lighthouse on rocks"]] },
  { by: "demo_sara", hoursAgo: 160, caption: "Golden hour on the way home.", media: [[110, "wide", "Trees on a grassy field under an orange sunset"]] },
  { by: "demo_jonas", hoursAgo: 12, caption: "Harbour regulars.", media: [[1084, "square", "Walruses resting on a rock"]] },
];

const comments = ["This is unreal.", "Saving this for my next trip.", "The light here!", "Okay, I need to go.", "Adorable.", "Where is this exactly?"];

const ids = {};
for (const p of people) {
  const id = crypto.randomUUID();
  ids[p.username] = id;
  const avatar = await photo(p.avatar, "square");
  await sql`insert into framey_user (id, "firstName", "lastName", email, username, bio, "profilePicture", "profileComplete")
    values (${id}, ${p.firstName}, ${p.lastName}, ${`${p.username}@framey.invalid`}, ${p.username},
      'Sample account for local development.', ${JSON.stringify({ url: avatar.url, width: 320, height: 320 })}, true)`;
  if (p.followed) {
    await sql`insert into framey_user_follow ("followerId", "followingId", "createdAt") values (${viewer.id}, ${id}, now())`;
  }
}

const now = Date.now();
let n = 0;
for (const post of postsToSeed) {
  const postId = crypto.randomUUID();
  const createdAt = new Date(now - post.hoursAgo * 3_600_000);
  await sql`insert into framey_post (id, "authorId", caption, location, "createdAt")
    values (${postId}, ${ids[post.by]}, ${post.caption}, ${post.location ?? null}, ${createdAt})`;

  for (const [order, [source, ratio, alt]] of post.media.entries()) {
    const m = source === "video" ? VIDEO : await photo(source, ratio);
    await sql`insert into framey_post_media ("postId", url, type, width, height, alt, muted, "order", "createdAt")
      values (${postId}, ${m.url}, ${m.type}, ${m.width}, ${m.height}, ${alt}, ${m.muted ?? false}, ${order}, ${createdAt})`;
  }

  // A few likes and comments from the other demo accounts, varied per post.
  const others = people.filter((p) => p.username !== post.by);
  for (const liker of others.slice(0, (n % 4) + 1)) {
    await sql`insert into framey_post_like ("userId", "postId", "createdAt") values (${ids[liker.username]}, ${postId}, now())`;
  }
  for (const [i, commenter] of others.slice(0, n % 3).entries()) {
    await sql`insert into framey_post_comment ("postId", "authorId", content, "createdAt")
      values (${postId}, ${ids[commenter.username]}, ${comments[(n + i) % comments.length]}, now())`;
  }
  n++;
}

console.log(`Seeded ${people.length} demo accounts and ${postsToSeed.length} posts; @${arg} follows ${people.filter((p) => p.followed).length} of them.`);
