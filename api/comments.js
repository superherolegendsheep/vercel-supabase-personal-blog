const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const clean = (value, max = 1000) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

async function ipHash(request) {
  const { createHash } = await import("node:crypto");
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.headers["x-real-ip"] ||
    request.socket?.remoteAddress ||
    "unknown";
  const salt = process.env.LIKE_HASH_SALT || "personal-blog-like";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

async function supabaseFetch(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or Supabase API key environment variable");
  }

  const result = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!result.ok) {
    const message = await result.text();
    throw new Error(message || "Supabase request failed");
  }

  return result.json();
}

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const postId = clean(request.query.postId, 120);
      if (!postId) return json(response, 400, { error: "missing postId" });

      const comments = await supabaseFetch(
        `comments?select=id,post_id,parent_id,name,body,created_at&post_id=eq.${encodeURIComponent(postId)}&order=created_at.asc`
      ).catch(() =>
        supabaseFetch(
          `comments?select=id,post_id,name,body,created_at&post_id=eq.${encodeURIComponent(postId)}&order=created_at.asc`
        )
      );
      const hash = await ipHash(request);
      const commentLikes = await supabaseFetch(
        `comment_likes?select=comment_id,ip_hash&post_id=eq.${encodeURIComponent(postId)}`
      ).catch(() => []);
      const likeCounts = commentLikes.reduce((counts, item) => {
        counts[item.comment_id] = (counts[item.comment_id] || 0) + 1;
        return counts;
      }, {});

      return json(response, 200, {
        comments: comments.map((item) => ({
          id: item.id,
          postId: item.post_id,
          parentId: item.parent_id,
          name: item.name,
          body: item.body,
          createdAt: item.created_at,
          likeCount: likeCounts[item.id] || 0,
          liked: commentLikes.some((like) => like.comment_id === item.id && like.ip_hash === hash)
        }))
      });
    }

    if (request.method === "POST") {
      const input = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
      const postId = clean(input.postId, 120);
      const name = clean(input.name || "匿名读者", 40);
      const body = clean(input.body, 3000);
      const parentId = clean(input.parentId, 80) || null;

      if (!postId || !body) {
        return json(response, 400, { error: "postId and body are required" });
      }

      const nextComment = {
        post_id: postId,
        name,
        body
      };

      if (parentId) {
        nextComment.parent_id = parentId;
      }

      const [comment] = await supabaseFetch("comments", {
        method: "POST",
        body: JSON.stringify(nextComment)
      });

      return json(response, 200, {
        comment: {
          id: comment.id,
          postId: comment.post_id,
          parentId: comment.parent_id,
          name: comment.name,
          body: comment.body,
          createdAt: comment.created_at
        }
      });
    }

    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    return json(response, 500, {
      error: "comment service unavailable",
      detail: error.message
    });
  }
}
