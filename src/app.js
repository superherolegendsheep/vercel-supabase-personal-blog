const state = {
  config: null,
  posts: [],
  page: 1,
  perPage: 6,
  query: "",
  tag: "",
  collection: "",
  view: "home",
  currentPost: null,
  readerFullscreen: false,
  likes: {}
};

const app = document.querySelector("#app");
let shortcutsBound = false;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

async function loadData() {
  const [configRes, postsRes] = await Promise.all([
    fetch("/data/site.config.json"),
    fetch("/data/posts.json")
  ]);
  state.config = await configRes.json();
  state.posts = (await postsRes.json()).filter((post) => post.visibility !== "private");
  applyTheme();
  render();
}

function applyTheme() {
  const theme = state.config.theme || {};
  document.documentElement.style.setProperty("--primary", theme.primary || "#3d8f5a");
  document.documentElement.style.setProperty("--accent", theme.accent || "#c94f6d");
}

function byCurrentOrder(a, b) {
  if (state.collection) {
    return Number(a.order || 9999) - Number(b.order || 9999) || new Date(b.date) - new Date(a.date);
  }
  return new Date(b.date) - new Date(a.date);
}

function filteredPosts() {
  const q = state.query.toLowerCase();
  return state.posts
    .filter((post) => !state.collection || post.collection === state.collection)
    .filter((post) => !state.tag || post.tags?.includes(state.tag))
    .filter((post) => {
      const text = [post.title, post.summary, ...(post.tags || [])].join(" ").toLowerCase();
      return !q || text.includes(q);
    })
    .sort(byCurrentOrder);
}

function getCollection(id) {
  return state.config.collections?.find((item) => item.id === id);
}

function renderSidebar() {
  const profile = state.config.profile;
  const collections = state.config.collections || [];
  return `
    <aside class="profile-card" data-back-area>
      <button class="profile-home" data-shortcut-home title="返回主页">
        <div class="avatar">${profile.avatar ? `<img src="${profile.avatar}" alt="${escapeHtml(profile.name)}" />` : "文"}</div>
      </button>
      <p class="muted profile-caption">${escapeHtml(profile.caption || profile.role)}</p>
      <button class="site-name-link" data-shortcut-home title="返回主页">${escapeHtml(profile.name)}</button>
      <p>${escapeHtml(profile.location)}</p>
      <dl class="profile-facts">
        <div><dt>身份</dt><dd>${escapeHtml(profile.role)}</dd></div>
        <div><dt>坐标</dt><dd>${escapeHtml(profile.location)}</dd></div>
        <div><dt>内容</dt><dd>${escapeHtml(profile.content)}</dd></div>
      </dl>
      <section class="sidebar-section about-note">
        <h2>说明</h2>
        ${escapeHtml(profile.about).split("\n").map((line) => `<p>${line || "&nbsp;"}</p>`).join("")}
      </section>
      <section class="sidebar-section">
        <h2>作品集</h2>
        ${collections
          .map(
            (item) => `
              <button class="collection-link ${state.collection === item.id ? "active" : ""}" data-collection="${item.id}">
                ${escapeHtml(item.title)}
              </button>
            `
          )
          .join("")}
      </section>
    </aside>
  `;
}

function renderHome() {
  const site = state.config.site;
  const posts = filteredPosts();
  const pages = Math.max(1, Math.ceil(posts.length / state.perPage));
  state.page = Math.min(state.page, pages);
  const visible = posts.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  const allTags = [...new Set(state.posts.flatMap((post) => post.tags || []))].sort();
  const activeCollection = getCollection(state.collection);
  const headStyle = activeCollection?.cover
    ? ` style="background-image: linear-gradient(90deg, rgba(251,251,248,0.92), rgba(251,251,248,0.64)), url('${activeCollection.cover}')"`
    : "";

  return `
    <main class="content">
      <header class="page-head ${activeCollection?.cover ? "collection-head has-cover" : ""}"${headStyle}>
        <p class="eyebrow">${escapeHtml(site.subtitle)}</p>
        <h2>${activeCollection ? escapeHtml(activeCollection.title) : escapeHtml(site.title)}</h2>
        <p>${escapeHtml(activeCollection?.summary || state.config.profile.content)}</p>
      </header>

      ${state.collection ? "" : renderCollectionStrip()}

      ${
        state.collection
          ? `<button class="ghost-button collection-return" data-clear>返回全部文章</button>`
          : `<div class="filters">
              <input id="search" value="${escapeHtml(state.query)}" placeholder="搜索标题、标签、摘要" />
              <button data-clear>全部文章</button>
            </div>`
      }

      <div class="tag-row">
        ${allTags
          .map(
            (tag) =>
              `<button class="tag ${state.tag === tag ? "active" : ""}" data-tag="${escapeHtml(tag)}"># ${escapeHtml(tag)}</button>`
          )
          .join("")}
      </div>

      <section class="post-grid">
        ${visible.map(renderPostCard).join("") || `<p class="empty">这里还没有符合条件的文章。</p>`}
      </section>

      <nav class="pager" aria-label="分页">
        <button data-page="1">首页</button>
        <button data-page="${Math.max(1, state.page - 1)}">上一页</button>
        <span>第 ${state.page} / ${pages} 页</span>
        <button data-page="${Math.min(pages, state.page + 1)}">下一页</button>
        <button data-page="${pages}">末页</button>
        <input id="jump-page" type="number" min="1" max="${pages}" value="${state.page}" />
        <button data-jump>前往</button>
      </nav>
    </main>
  `;
}

function renderPostCard(post) {
  const collection = getCollection(post.collection);
  const titleClass = post.title.length > 22 ? "title-long" : post.title.length < 9 ? "title-short" : "";
  return `
    <article class="post-card" data-post="${post.id}" tabindex="0">
      <p class="date">${escapeHtml(post.date)}${collection ? ` · ${escapeHtml(collection.title)}` : ""}</p>
      <h3 class="${titleClass}">${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.summary || "")}</p>
      <div class="tag-row">${(post.tags || []).map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `;
}

function renderCollectionStrip() {
  return `
    <section class="collection-strip">
      ${(state.config.collections || [])
        .map(
          (item) => `
            <button class="collection-card" data-collection="${item.id}">
              ${item.cover ? `<img src="${item.cover}" alt="" />` : ""}
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.summary || "")}</span>
            </button>
          `
        )
        .join("")}
    </section>
  `;
}

function renderAbout() {
  const profile = state.config.profile;
  return `
    <main class="content">
      <article class="about-page">
        <p class="eyebrow">Identity</p>
        <h2>关于我</h2>
        <div class="about-text">
          ${escapeHtml(profile.about).split("\n").map((line) => `<p>${line || "&nbsp;"}</p>`).join("")}
        </div>
      </article>
    </main>
  `;
}

function renderPost() {
  const post = state.currentPost;
  const collection = getCollection(post.collection);
  return `
    <main class="content article-view ${state.readerFullscreen ? "reader-fullscreen" : ""}">
      <button class="ghost-button" data-action="home">返回目录</button>
      <article class="reader">
        <header class="article-head">
          <p class="date">${escapeHtml(post.date)}</p>
          <h2>${escapeHtml(post.title)}</h2>
          <p>${escapeHtml(post.summary || "")}</p>
        </header>
        ${
          post.type === "html"
            ? `<div class="html-reader">
                <button class="reader-toggle" data-reader-fullscreen>
                  ${state.readerFullscreen ? "退出全屏" : "全屏阅读"}
                </button>
                <iframe class="html-frame" src="/posts/${encodeURIComponent(post.file)}" title="${escapeHtml(post.title)}"></iframe>
              </div>`
            : `<section class="article-body" data-markdown="${escapeHtml(post.file)}"></section>`
        }
        <button class="like-button ${state.likes[post.id]?.liked ? "active" : ""}" data-like="${post.id}">
          ${state.likes[post.id]?.liked ? "已喜欢" : "喜欢"} <span>${state.likes[post.id]?.count ?? 0}</span>
        </button>
        <p class="like-message" data-like-message></p>
        <footer class="post-meta">
          <span>作品集：${escapeHtml(collection?.title || "未归档")}</span>
          ${(post.tags || []).map((tag) => `<span># ${escapeHtml(tag)}</span>`).join("")}
        </footer>
      </article>
      <section class="comments">
        <h3>评论</h3>
        <form id="comment-form" class="comment-form">
          <input name="name" placeholder="你的名字" maxlength="40" />
          <textarea name="body" placeholder="写下评论" rows="5" required></textarea>
          <button class="primary-button">发送评论</button>
        </form>
        <div id="comment-list" class="comment-list"></div>
      </section>
    </main>
  `;
}

async function loadMarkdownArticles() {
  for (const holder of document.querySelectorAll("[data-markdown]")) {
    const file = holder.dataset.markdown;
    const text = await fetch(`/posts/${encodeURIComponent(file)}`).then((res) => res.text());
    holder.innerHTML = simpleMarkdown(text);
  }
}

function simpleMarkdown(markdown) {
  return escapeHtml(markdown)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

async function loadComments(postId) {
  const list = document.querySelector("#comment-list");
  if (!list) return;
  list.innerHTML = `<p class="muted">正在读取评论...</p>`;
  try {
    const data = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || body.error || "comment api failed");
      return body;
    });
    list.innerHTML = renderCommentTree(data.comments || []);
    bindCommentActions();
  } catch {
    list.innerHTML = `<p class="muted">评论接口暂时不可用。本地预览时需要 Vercel 环境变量连接 Supabase，部署并配置后会正常工作。</p>`;
  }
}

function renderCommentTree(comments) {
  if (!comments.length) return `<p class="muted">还没有评论。</p>`;
  const roots = comments.filter((item) => !item.parentId);
  const repliesByParent = comments.reduce((groups, item) => {
    if (item.parentId) {
      groups[item.parentId] = groups[item.parentId] || [];
      groups[item.parentId].push(item);
    }
    return groups;
  }, {});
  return roots.map((item) => renderCommentItem(item, repliesByParent[item.id] || [])).join("");
}

function renderCommentItem(item, replies = []) {
  return `
    <article class="comment-item" id="comment-${escapeHtml(item.id)}">
      <header class="comment-head">
        <strong>${escapeHtml(item.name)}</strong>
        <time>${new Date(item.createdAt).toLocaleString("zh-CN")}</time>
      </header>
      <p>${escapeHtml(item.body)}</p>
      <div class="comment-actions">
        <button data-reply="${escapeHtml(item.id)}">回复</button>
        <button class="${item.liked ? "active" : ""}" data-comment-like="${escapeHtml(item.id)}">
          ${item.liked ? "已喜欢" : "喜欢"} <span>${Number(item.likeCount || 0)}</span>
        </button>
      </div>
      <form class="comment-form reply-form" data-reply-form="${escapeHtml(item.id)}" hidden>
        <input name="name" placeholder="你的名字" maxlength="40" />
        <textarea name="body" placeholder="回复 ${escapeHtml(item.name)}" rows="3" required></textarea>
        <button class="primary-button">发送回复</button>
      </form>
      ${replies.length ? `<div class="reply-list">${replies.map((reply) => renderCommentItem(reply, [])).join("")}</div>` : ""}
    </article>
  `;
}

async function submitComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    postId: state.currentPost.id,
    name: formData.get("name"),
    body: formData.get("body"),
    parentId: form.dataset.parentId || null
  };
  await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  form.reset();
  await loadComments(state.currentPost.id);
}

function bindCommentActions() {
  document.querySelectorAll("[data-reply]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector(`[data-reply-form="${button.dataset.reply}"]`);
      if (!form) return;
      form.hidden = !form.hidden;
      form.dataset.parentId = button.dataset.reply;
    });
  });
  document.querySelectorAll(".reply-form").forEach((form) => {
    form.addEventListener("submit", submitComment);
  });
  document.querySelectorAll("[data-comment-like]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.setAttribute("disabled", "disabled");
      try {
        const data = await fetch("/api/comment-likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: state.currentPost.id,
            commentId: button.dataset.commentLike
          })
        }).then((res) => res.json());
        button.classList.toggle("active", Boolean(data.liked));
        button.innerHTML = `${data.liked ? "已喜欢" : "喜欢"} <span>${Number(data.count || 0)}</span>`;
      } finally {
        button.removeAttribute("disabled");
      }
    });
  });
}

async function loadLikes(postId) {
  try {
    const data = await fetch(`/api/likes?postId=${encodeURIComponent(postId)}`).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || body.error || "like api failed");
      return body;
    });
    state.likes[postId] = {
      count: data.count || 0,
      liked: Boolean(data.liked)
    };
    const button = document.querySelector(`[data-like="${postId}"]`);
    if (button) {
      button.classList.toggle("active", state.likes[postId].liked);
      button.innerHTML = `${state.likes[postId].liked ? "已喜欢" : "喜欢"} <span>${state.likes[postId].count}</span>`;
    }
  } catch {
    state.likes[postId] = localLikeStatus(postId);
    const button = document.querySelector(`[data-like="${postId}"]`);
    if (button) {
      button.classList.toggle("active", state.likes[postId].liked);
      button.innerHTML = `${state.likes[postId].liked ? "已喜欢" : "喜欢"} <span>${state.likes[postId].count}</span>`;
    }
  }
}

async function toggleLike(postId) {
  const button = document.querySelector(`[data-like="${postId}"]`);
  button?.setAttribute("disabled", "disabled");
  const message = document.querySelector("[data-like-message]");
  if (message) message.textContent = "";
  try {
    const data = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId })
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || body.error || "like api failed");
      return body;
    });
    state.likes[postId] = {
      count: data.count || 0,
      liked: Boolean(data.liked)
    };
    button?.classList.toggle("active", state.likes[postId].liked);
    if (button) button.innerHTML = `${state.likes[postId].liked ? "已喜欢" : "喜欢"} <span>${state.likes[postId].count}</span>`;
  } catch {
    state.likes[postId] = toggleLocalLike(postId);
    button?.classList.toggle("active", state.likes[postId].liked);
    if (button) button.innerHTML = `${state.likes[postId].liked ? "已喜欢" : "喜欢"} <span>${state.likes[postId].count}</span>`;
    if (message) message.textContent = "已先记录在当前浏览器里。若要在 Supabase 后台看到喜欢数，请检查 Vercel 环境变量和 likes 表。";
  } finally {
    button?.removeAttribute("disabled");
  }
}

function localLikeStatus(postId) {
  return {
    count: Number(localStorage.getItem(`likes:${postId}:count`) || 0),
    liked: localStorage.getItem(`likes:${postId}:liked`) === "yes"
  };
}

function toggleLocalLike(postId) {
  const current = localLikeStatus(postId);
  const next = {
    liked: !current.liked,
    count: Math.max(0, current.count + (current.liked ? -1 : 1))
  };
  localStorage.setItem(`likes:${postId}:liked`, next.liked ? "yes" : "no");
  localStorage.setItem(`likes:${postId}:count`, String(next.count));
  return next;
}

function render() {
  app.innerHTML = `
    ${renderSidebar()}
    ${state.view === "post" ? renderPost() : renderHome()}
    ${renderNotice()}
  `;
  bindEvents();
  bindGlobalShortcuts();
  loadMarkdownArticles();
  if (state.view === "post") {
    loadComments(state.currentPost.id);
    loadLikes(state.currentPost.id);
  }
}

function returnHome() {
  state.view = "home";
  state.currentPost = null;
  state.readerFullscreen = false;
  state.collection = "";
  state.tag = "";
  state.query = "";
  state.page = 1;
  render();
}

function bindGlobalShortcuts() {
  if (shortcutsBound) return;
  shortcutsBound = true;
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (state.view !== "home" || state.collection)) {
      returnHome();
    }
  });
}

function renderNotice() {
  const text = state.config.site?.notice;
  if (!text || localStorage.getItem("siteNoticeAccepted") === "yes") return "";
  return `
    <div class="site-notice" role="dialog" aria-modal="true" aria-label="阅读提醒">
      <div class="notice-panel">
        <p>${escapeHtml(text)}</p>
        <button class="notice-confirm" data-notice-confirm>我已知悉</button>
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-action='home']").forEach((button) => {
    button.addEventListener("click", () => {
      returnHome();
    });
  });
  document.querySelectorAll("[data-shortcut-home]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.view !== "home" || state.collection) returnHome();
    });
  });
  document.querySelector("[data-back-area]")?.addEventListener("click", (event) => {
    const interactive = event.target.closest("button, a, input, textarea, select");
    if (!interactive && (state.view !== "home" || state.collection)) returnHome();
  });
  document.querySelectorAll("[data-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      state.collection = state.collection === button.dataset.collection ? "" : button.dataset.collection;
      state.query = "";
      state.tag = "";
      state.view = "home";
      state.page = 1;
      render();
    });
  });
  document.querySelectorAll("[data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tag = state.tag === button.dataset.tag ? "" : button.dataset.tag;
      state.page = 1;
      render();
    });
  });
  document.querySelectorAll("[data-post]").forEach((card) => {
    card.addEventListener("click", () => openPost(card.dataset.post));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openPost(card.dataset.post);
    });
  });
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = Number(button.dataset.page);
      render();
    });
  });
  document.querySelector("[data-jump]")?.addEventListener("click", () => {
    state.page = Math.max(1, Number(document.querySelector("#jump-page").value || 1));
    render();
  });
  document.querySelector("#search")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.page = 1;
    render();
  });
  document.querySelector("[data-clear]")?.addEventListener("click", () => {
      state.query = "";
      state.tag = "";
      state.collection = "";
      state.readerFullscreen = false;
      state.page = 1;
      render();
  });
  document.querySelector("[data-like]")?.addEventListener("click", (event) => {
    toggleLike(event.currentTarget.dataset.like);
  });
  document.querySelector("[data-reader-fullscreen]")?.addEventListener("click", () => {
    state.readerFullscreen = !state.readerFullscreen;
    render();
  });
  document.querySelector("#comment-form")?.addEventListener("submit", submitComment);
  document.querySelector("[data-notice-confirm]")?.addEventListener("click", () => {
    localStorage.setItem("siteNoticeAccepted", "yes");
    document.querySelector(".site-notice")?.remove();
  });
}

function openPost(id) {
  state.currentPost = state.posts.find((post) => post.id === id);
  state.view = "post";
  state.readerFullscreen = false;
  render();
}

loadData().catch(() => {
  app.innerHTML = `<main class="content"><p>数据读取失败，请检查 data 文件夹。</p></main>`;
});
