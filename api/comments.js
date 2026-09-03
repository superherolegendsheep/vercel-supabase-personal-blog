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

  return result.json();
}

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const postId = clean(request.query.postId, 120);
      if (!postId) return json(response, 400, { error: "missing postId" });

      const comments = await supabaseFetch(
        `comments?select=id,post_id,name,body,created_at&post_id=eq.${encodeURIComponent(postId)}&order=created_at.desc`
      );

      return json(response, 200, {
        comments: comments.map((item) => ({
          id: item.id,
          postId: item.post_id,
          name: item.name,
          body: item.body,
          createdAt: item.created_at
        }))
      });
    }

    if (request.method === "POST") {
      const input = request.body || {};
      const postId = clean(input.postId, 120);
      const name = clean(input.name || "匿名读者", 40);
      const body = clean(input.body, 3000);

      if (!postId || !body) {
        return json(response, 400, { error: "postId and body are required" });
      }

      const [comment] = await supabaseFetch("comments", {
        method: "POST",
        body: JSON.stringify({
          post_id: postId,
          name,
          body
        })
      });

      return json(response, 200, {
        comment: {
          id: comment.id,
          postId: comment.post_id,
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
