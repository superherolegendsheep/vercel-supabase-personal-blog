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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
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

async function ipHash(request) {
  const ip =
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.headers["x-real-ip"] ||
    request.socket?.remoteAddress ||
    "unknown";
  const salt = process.env.LIKE_HASH_SALT || "personal-blog-like";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

async function likeStatus(postId, hash) {
  const rows = await supabaseFetch(`likes?select=id,ip_hash&post_id=eq.${encodeURIComponent(postId)}`);

  return {
    count: rows.length,
    liked: rows.some((row) => row.ip_hash === hash)
  };
}

export default async function handler(request, response) {
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const postId = clean(request.method === "GET" ? request.query.postId : body.postId, 120);
    if (!postId) return json(response, 400, { error: "missing postId" });

    const hash = await ipHash(request);

    if (request.method === "GET") {
      return json(response, 200, await likeStatus(postId, hash));
    }

    if (request.method === "POST") {
      const current = await likeStatus(postId, hash);

      if (current.liked) {
        await supabaseFetch(`likes?post_id=eq.${encodeURIComponent(postId)}&ip_hash=eq.${encodeURIComponent(hash)}`, {
          method: "DELETE",
          headers: { Prefer: "return=minimal" }
        });
        return json(response, 200, await likeStatus(postId, hash));
      }

      await supabaseFetch("likes", {
        method: "POST",
        body: JSON.stringify({
          post_id: postId,
          ip_hash: hash
        })
      });

      return json(response, 200, await likeStatus(postId, hash));
    }

    response.setHeader("Allow", "GET, POST");
    return json(response, 405, { error: "method not allowed" });
  } catch (error) {
    return json(response, 500, {
      error: "like service unavailable",
      detail: error.message
    });
  }
}
