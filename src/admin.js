let config = null;
let posts = [];
let pendingCover = "";

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

async function init() {
  const [configRes, postsRes] = await Promise.all([
    fetch("/data/site.config.json"),
    fetch("/data/posts.json")
  ]);
  config = await configRes.json();
  posts = await postsRes.json();
  fillSiteForm();
  renderCollections();
  renderCollectionOptions();
  renderPostManager();
  renderTagManager();
  bindEvents();
  updatePreview();
}

function bindEvents() {
  document.querySelectorAll(".admin-tabs button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  $("#profile-avatar").addEventListener("change", async (event) => {
    config.profile.avatar = await fileAsDataUrl(event.target.files[0]);
  });
  $("#collection-cover").addEventListener("change", async (event) => {
    pendingCover = await fileAsDataUrl(event.target.files[0]);
  });
  $("#download-config").addEventListener("click", () => {
    readSiteForm();
    download("site.config.json", JSON.stringify(config, null, 2), "application/json");
  });
  $("#add-collection").addEventListener("click", addCollection);
  document.querySelectorAll(".editor-toolbar [data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      document.execCommand(button.dataset.command, false, null);
      updatePreview();
    });
  });
  $("#font-size").addEventListener("change", (event) => {
    document.execCommand("fontSize", false, event.target.value);
    updatePreview();
  });
  $("#font-color").addEventListener("input", (event) => {
    document.execCommand("foreColor", false, event.target.value);
    updatePreview();
  });
  $("#back-color").addEventListener("input", (event) => {
    document.execCommand("backColor", false, event.target.value);
    updatePreview();
  });
  $("#post-editor").addEventListener("input", updatePreview);
  $("#download-post-html").addEventListener("click", downloadCurrentPostHtml);
  $("#download-posts-json").addEventListener("click", downloadPostsJsonWithDraft);
  $("#download-managed-posts").addEventListener("click", () => {
    download("posts.json", JSON.stringify(posts, null, 2), "application/json");
  });
  $("#download-tag-posts").addEventListener("click", () => {
    download("posts.json", JSON.stringify(posts, null, 2), "application/json");
  });
}

function switchTab(tab) {
  document.querySelectorAll(".admin-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".admin-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tab}`));
}

function fillSiteForm() {
  $("#site-title").value = config.site.title || "";
  $("#site-subtitle").value = config.site.subtitle || "";
  $("#profile-name").value = config.profile.name || "";
  $("#profile-role").value = config.profile.role || "";
  $("#profile-location").value = config.profile.location || "";
  $("#profile-content").value = config.profile.content || "";
  $("#profile-about").value = config.profile.about || "";
  $("#color-primary").value = config.theme.primary || "#3d8f5a";
  $("#color-accent").value = config.theme.accent || "#c94f6d";
  $("#post-date").valueAsDate = new Date();
}

function readSiteForm() {
  config.site.title = $("#site-title").value;
  config.site.subtitle = $("#site-subtitle").value;
  config.profile.name = $("#profile-name").value;
  config.profile.role = $("#profile-role").value;
  config.profile.location = $("#profile-location").value;
  config.profile.content = $("#profile-content").value;
  config.profile.about = $("#profile-about").value;
  config.theme.primary = $("#color-primary").value;
  config.theme.accent = $("#color-accent").value;
}

function renderCollections() {
  $("#collection-list").innerHTML = (config.collections || [])
    .map(
      (item) => `
        <article class="manager-item">
          ${item.cover ? `<img src="${item.cover}" alt="" />` : ""}
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.summary || "")}</p>
            <small>ID: ${escapeHtml(item.id)}</small>
          </div>
          <button data-delete-collection="${item.id}">删除</button>
        </article>
      `
    )
    .join("");
  document.querySelectorAll("[data-delete-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      config.collections = config.collections.filter((item) => item.id !== button.dataset.deleteCollection);
      renderCollections();
      renderCollectionOptions();
    });
  });
}

function addCollection() {
  const id = $("#collection-id").value.trim();
  if (!id) return;
  config.collections = config.collections || [];
  config.collections.push({
    id,
    title: $("#collection-title").value || id,
    summary: $("#collection-summary").value,
    cover: pendingCover
  });
  $("#collection-id").value = "";
  $("#collection-title").value = "";
  $("#collection-summary").value = "";
  $("#collection-cover").value = "";
  pendingCover = "";
  renderCollections();
  renderCollectionOptions();
}

function renderCollectionOptions() {
  $("#post-collection").innerHTML = (config.collections || [])
    .map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`)
    .join("");
}

function draftPost() {
  const title = $("#post-title").value.trim() || "未命名文章";
  const id = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "") || `post-${Date.now()}`;
  return {
    id,
    title,
    date: $("#post-date").value,
    tags: $("#post-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    collection: $("#post-collection").value,
    order: Number($("#post-order").value || 1),
    visibility: $("#post-visibility").value,
    summary: $("#post-summary").value,
    file: `${id}.html`,
    type: "html"
  };
}

function updatePreview() {
  $("#post-preview").innerHTML = $("#post-editor").innerHTML || "<p>预览会显示在这里。</p>";
}

function articleHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(draftPost().title)}</title>
  <style>
    body { margin: 0; padding: 32px; font-family: "Microsoft YaHei", sans-serif; color: #2f3a4a; line-height: 1.8; background: #fff; }
    article { max-width: 760px; margin: 0 auto; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <article>${$("#post-editor").innerHTML}</article>
</body>
</html>`;
}

function downloadCurrentPostHtml() {
  const post = draftPost();
  download(post.file, articleHtml(), "text/html");
}

function downloadPostsJsonWithDraft() {
  const post = draftPost();
  const nextPosts = posts.filter((item) => item.id !== post.id);
  nextPosts.push(post);
  download("posts.json", JSON.stringify(nextPosts, null, 2), "application/json");
}

function renderPostManager() {
  $("#post-manager").innerHTML = posts
    .map(
      (post) => `
        <article class="manager-item">
          <div>
            <strong>${escapeHtml(post.title)}</strong>
            <p>${escapeHtml(post.summary || "")}</p>
            <small>${escapeHtml(post.collection || "未归档")} · 顺序 ${post.order || 1} · ${post.visibility}</small>
          </div>
          <button data-delete-post="${post.id}">删除</button>
          <button data-private-post="${post.id}">${post.visibility === "private" ? "设为公开" : "仅自己可见"}</button>
        </article>
      `
    )
    .join("");
  document.querySelectorAll("[data-delete-post]").forEach((button) => {
    button.addEventListener("click", () => {
      posts = posts.filter((post) => post.id !== button.dataset.deletePost);
      renderPostManager();
      renderTagManager();
    });
  });
  document.querySelectorAll("[data-private-post]").forEach((button) => {
    button.addEventListener("click", () => {
      const post = posts.find((item) => item.id === button.dataset.privatePost);
      post.visibility = post.visibility === "private" ? "public" : "private";
      renderPostManager();
    });
  });
}

function renderTagManager() {
  const tags = [...new Set(posts.flatMap((post) => post.tags || []))].sort();
  $("#tag-manager").innerHTML = tags
    .map(
      (tag) => `
        <article class="manager-item">
          <strong># ${escapeHtml(tag)}</strong>
          <input value="${escapeHtml(tag)}" data-rename-from="${escapeHtml(tag)}" />
          <button data-delete-tag="${escapeHtml(tag)}">删除标签</button>
        </article>
      `
    )
    .join("");
  document.querySelectorAll("[data-rename-from]").forEach((input) => {
    input.addEventListener("change", () => {
      const from = input.dataset.renameFrom;
      const to = input.value.trim();
      posts.forEach((post) => {
        post.tags = (post.tags || []).map((tag) => (tag === from ? to : tag)).filter(Boolean);
      });
      renderTagManager();
    });
  });
  document.querySelectorAll("[data-delete-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      posts.forEach((post) => {
        post.tags = (post.tags || []).filter((tag) => tag !== button.dataset.deleteTag);
      });
      renderTagManager();
    });
  });
}

function fileAsDataUrl(file) {
  if (!file) return Promise.resolve("");
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

init();
