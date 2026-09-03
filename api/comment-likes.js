import { createHash } from "node:crypto";

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

  if (result.status === 204) return [];
  return result.json();
}

function ipHash(request) {
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.headers["x-real-ip"] ||
    request.socket?.remoteAddress ||
    "unknown";
  const salt = process.env.LIKE_HASH_SALT || "personal-blog-like";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

async function status(postId, commentId, hash) {
  const rows = await supabaseFetch(
    `comment_likes?select=id,ip_hash&post_id=eq.${encodeURIComponent(postId)}&comment_id=eq.${encodeURIComponent(commentId)}`
  );
  return {
    count: rows.length,
    liked: rows.some((row) => row.ip_hash === hash)
  };
}

export default async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return json(response, 405, { error: "method not allowed" });
    }

    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const postId = clean(body.postId, 120);
    const commentId = clean(body.commentId, 80);
    if (!postId || !commentId) return json(response, 400, { error: "postId and commentId are required" });

    const hash = ipHash(request);
    const current = await status(postId, commentId, hash);

    if (current.liked) {
      await supabaseFetch(
        `comment_likes?post_id=eq.${encodeURIComponent(postId)}&comment_id=eq.${encodeURIComponent(commentId)}&ip_hash=eq.${encodeURIComponent(hash)}`,
        {
          method: "DELETE",
          headers: { Prefer: "return=minimal" }
        }
      );
      return json(response, 200, await status(postId, commentId, hash));
    }

    await supabaseFetch("comment_likes", {
      method: "POST",
      body: JSON.stringify({
        post_id: postId,
        comment_id: commentId,
        ip_hash: hash
      })
    });

    return json(response, 200, await status(postId, commentId, hash));
  } catch (error) {
    return json(response, 500, {
      error: "comment like service unavailable",
      detail: error.message
    });
  }
}
