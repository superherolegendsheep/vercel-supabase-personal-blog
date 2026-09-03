const state = {
  config: null,
  posts: [],
  page: 1,
  perPage: 6,
  query: "",
  tag: "",
  collection: "",
  view: "home",
  currentPost: null
};

const app = document.querySelector("#app");

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
    <aside class="profile-card">
      <div class="avatar">${profile.avatar ? `<img src="${profile.avatar}" alt="${escapeHtml(profile.name)}" />` : "文"}</div>
      <p class="muted">${escapeHtml(profile.role)}</p>
      <h1>${escapeHtml(profile.name)}</h1>
      <p>${escapeHtml(profile.location)}</p>
      <button class="wide-button" data-action="${state.view === "about" ? "home" : "about"}">
        ${state.view === "about" ? "返回主页" : "完整身份页"}
      </button>
      <dl class="profile-facts">
        <div><dt>身份</dt><dd>${escapeHtml(profile.role)}</dd></div>
        <div><dt>坐标</dt><dd>${escapeHtml(profile.location)}</dd></div>
        <div><dt>内容</dt><dd>${escapeHtml(profile.content)}</dd></div>
      </dl>
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

  return `
    <main class="content">
      <header class="page-head">
        <p class="eyebrow">${escapeHtml(site.subtitle)}</p>
        <h2>${activeCollection ? escapeHtml(activeCollection.title) : escapeHtml(site.title)}</h2>
        <p>${escapeHtml(activeCollection?.summary || state.config.profile.content)}</p>
      </header>

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

      <div class="filters">
        <input id="search" value="${escapeHtml(state.query)}" placeholder="搜索标题、标签、摘要" />
        <button data-clear>全部文章</button>
      </div>

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
  return `
    <article class="post-card" data-post="${post.id}" tabindex="0">
      <p class="date">${escapeHtml(post.date)}${collection ? ` · ${escapeHtml(collection.title)}` : ""}</p>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.summary || "")}</p>
      <div class="tag-row">${(post.tags || []).map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `;
}

function renderAbout() {
  const profile = state.config.profile;
  const collections = state.config.collections || [];
  return `
    <main class="content">
      <article class="about-page">
        <p class="eyebrow">Identity</p>
        <h2>关于我</h2>
        <div class="about-text">
          ${escapeHtml(profile.about).split("\n").map((line) => `<p>${line || "&nbsp;"}</p>`).join("")}
        </div>
      </article>
      <section class="collection-strip">
        ${collections
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
    </main>
  `;
}

function renderPost() {
  const post = state.currentPost;
  const collection = getCollection(post.collection);
  return `
    <main class="content article-view">
      <button class="ghost-button" data-action="home">返回目录</button>
      <article class="reader">
        <header class="article-head">
          <p class="date">${escapeHtml(post.date)}</p>
          <h2>${escapeHtml(post.title)}</h2>
          <p>${escapeHtml(post.summary || "")}</p>
        </header>
        ${
          post.type === "html"
            ? `<iframe class="html-frame" src="/posts/${encodeURIComponent(post.file)}" title="${escapeHtml(post.title)}"></iframe>`
            : `<section class="article-body" data-markdown="${escapeHtml(post.file)}"></section>`
        }
        <button class="like-button" data-like="${post.id}">喜欢 <span>${getLikes(post.id)}</span></button>
        <footer class="post-meta">
          <span>作品集：${escapeHtml(collection?.title || "未归档")}</span>
          ${(post.tags || []).map((tag) => `<span># ${escapeHtml(tag)}</span>`).join("")}
        </footer>
      </article>
      <section class="comments">
        <h3>评论</h3>
        <form id="comment-form" class="comment-form">
          <input name="name" placeholder="你的名字" maxlength="40" />
          <textarea name="quote" placeholder="引用范围，可不填" rows="2"></textarea>
          <textarea name="body" placeholder="写下评论" rows="5" required></textarea>
          <button class="primary-button">发送评论</button>
        </form>
        <div id="comment-list" class="comment-list"></div>
      </section>
    </main>
  `;
}

function getLikes(id) {
  return Number(localStorage.getItem(`likes:${id}`) || 0);
}

function likePost(id) {
  localStorage.setItem(`likes:${id}`, String(getLikes(id) + 1));
  render();
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
    const data = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`).then((res) => res.json());
    list.innerHTML =
      data.comments
        ?.map(
          (item) => `
            <article class="comment-item">
              <strong>${escapeHtml(item.name)}</strong>
              <time>${new Date(item.createdAt).toLocaleString("zh-CN")}</time>
              ${item.quote ? `<blockquote>${escapeHtml(item.quote)}</blockquote>` : ""}
              <p>${escapeHtml(item.body)}</p>
            </article>
          `
        )
        .join("") || `<p class="muted">还没有评论。</p>`;
  } catch {
    list.innerHTML = `<p class="muted">评论接口暂时不可用。本地预览时需要 Vercel 环境变量连接 Supabase，部署并配置后会正常工作。</p>`;
  }
}

async function submitComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    postId: state.currentPost.id,
    name: formData.get("name"),
    quote: formData.get("quote"),
    body: formData.get("body")
  };
  await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  form.reset();
  await loadComments(state.currentPost.id);
}

function render() {
  app.innerHTML = `
    ${renderSidebar()}
    ${state.view === "about" ? renderAbout() : state.view === "post" ? renderPost() : renderHome()}
  `;
  bindEvents();
  loadMarkdownArticles();
  if (state.view === "post") loadComments(state.currentPost.id);
}

function bindEvents() {
  document.querySelectorAll("[data-action='home']").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "home";
      state.currentPost = null;
      render();
    });
  });
  document.querySelectorAll("[data-action='about']").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "about";
      render();
    });
  });
  document.querySelectorAll("[data-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      state.collection = button.dataset.collection;
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
    state.page = 1;
    render();
  });
  document.querySelector("[data-like]")?.addEventListener("click", (event) => {
    likePost(event.currentTarget.dataset.like);
  });
  document.querySelector("#comment-form")?.addEventListener("submit", submitComment);
}

function openPost(id) {
  state.currentPost = state.posts.find((post) => post.id === id);
  state.view = "post";
  render();
}

loadData().catch(() => {
  app.innerHTML = `<main class="content"><p>数据读取失败，请检查 data 文件夹。</p></main>`;
});
