"use strict";

const state = {
  data: null,
  filter: "all",
  selected: new Set(),
  downloading: false
};

const el = Object.fromEntries([
  "loadingState", "unsupportedState", "errorState", "errorMessage", "resultState", "siteLine",
  "skuText", "variantText", "mediaGrid", "emptyState", "allCount", "skuCount", "displayCount", "detailCount", "videoCount",
  "selectionText", "downloadButton", "downloadCount", "refreshButton", "toast"
].map((id) => [id, document.getElementById(id)]));

document.addEventListener("DOMContentLoaded", () => {
  if (new URLSearchParams(location.search).has("preview") && !globalThis.chrome?.tabs) renderPreviewData();
  else scanActiveTab();
});
el.refreshButton.addEventListener("click", scanActiveTab);
el.downloadButton.addEventListener("click", downloadSelected);
document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
    applyFilter();
  });
});

async function scanActiveTab() {
  showOnly("loadingState");
  el.siteLine.textContent = "正在识别商品页…";
  state.selected.clear();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("没有找到当前标签页");
    const response = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_PRODUCT_MEDIA" });
    if (!response || !response.ok) throw new Error(response && response.error ? response.error : "页面没有响应");
    state.data = response.data;
    if (!state.data.supported) {
      el.siteLine.textContent = "支持 Amazon · TikTok Shop";
      showOnly("unsupportedState");
      updateFooter();
      return;
    }
    renderResult();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Receiving end does not exist|Could not establish connection/i.test(message)) {
      el.errorMessage.textContent = "请刷新商品页，让插件接入当前页面后再试。";
    } else {
      el.errorMessage.textContent = message;
    }
    el.siteLine.textContent = "读取失败";
    showOnly("errorState");
    updateFooter();
  }
}

function renderResult() {
  const media = state.data.media || [];
  el.siteLine.textContent = state.data.siteLabel;
  el.skuText.textContent = state.data.sku || "未识别";
  el.variantText.textContent = state.data.variant || "";
  el.variantText.classList.toggle("hidden", !state.data.variant);
  el.allCount.textContent = String(media.length);
  el.skuCount.textContent = String(media.filter((item) => item.category === "sku").length);
  el.displayCount.textContent = String(media.filter((item) => item.category === "display").length);
  el.detailCount.textContent = String(media.filter((item) => item.category === "detail").length);
  el.videoCount.textContent = String(media.filter((item) => item.type === "video").length);
  el.mediaGrid.replaceChildren(...createMediaGroups(media));
  el.emptyState.classList.toggle("hidden", media.length > 0);

  media.filter((item) => item.isPrimary).forEach((item) => state.selected.add(item.id));
  updateCards();
  showOnly("resultState");
}

function renderPreviewData() {
  const colors = ["E8E3DC", "D8DEE5", "E5DDD2", "D6E0DB", "E6D9D6", "DDDCE7"];
  const mockImage = (color, text) => `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#${color}"/><circle cx="300" cy="270" r="135" fill="#fff" fill-opacity=".7"/><text x="300" y="470" text-anchor="middle" font-family="Arial" font-size="34" fill="#555">${text}</text></svg>`
  )}`;
  state.data = {
    supported: true,
    site: "tiktok_shop",
    siteLabel: "TikTok Shop",
    sku: "1729999999999999999",
    variant: "米白色 · M",
    media: colors.map((color, index) => ({
      id: `media-${index + 1}`,
      type: "image",
      url: mockImage(color, index === 0 ? "SKU MAIN" : `SKU ${index + 1}`),
      width: 1200,
      height: 1200,
      label: index === 0 ? "SKU 主图" : "SKU 图集",
      category: index === 0 ? "sku" : (index < 4 ? "display" : "detail"),
      variantLabel: index === 0 ? "米白色 · M" : "",
      source: "original",
      isPrimary: index === 0
    })).concat({
      id: "media-7",
      type: "video",
      url: "data:video/mp4,",
      label: "商品视频",
      category: "display",
      source: "original",
      isPrimary: false
    })
  };
  renderResult();
}

function createMediaGroups(media) {
  const definitions = [
    { category: "sku", title: "SKU 素材", description: "变体与规格图" },
    { category: "display", title: "商品展示", description: "主图、图集与展示视频" },
    { category: "detail", title: "详情 / 简介", description: "描述、长图与 A+ 内容" }
  ];
  return definitions.map((definition) => {
    const items = media.filter((item) => item.category === definition.category);
    if (!items.length) return null;
    const section = document.createElement("section");
    section.className = "media-group";
    section.dataset.category = definition.category;

    const heading = document.createElement("div");
    heading.className = "group-heading";
    const title = document.createElement("div");
    title.className = "group-title";
    const strong = document.createElement("strong");
    strong.textContent = definition.title;
    const description = document.createElement("span");
    description.textContent = `${definition.description} · ${items.length}`;
    title.append(strong, description);

    const select = document.createElement("button");
    select.type = "button";
    select.className = "group-select";
    select.dataset.category = definition.category;
    select.textContent = "选择本组";
    select.addEventListener("click", () => toggleGroupSelection(definition.category));
    heading.append(title, select);

    const grid = document.createElement("div");
    grid.className = "group-grid";
    grid.append(...items.map((item, index) => createMediaCard(item, index + 1)));
    section.append(heading, grid);
    return section;
  }).filter(Boolean);
}

function createMediaCard(item, position) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-card";
  button.dataset.id = item.id;
  button.dataset.type = item.type;
  button.title = [item.variantLabel, item.label, item.width ? `${item.width}×${item.height}` : ""].filter(Boolean).join(" · ");

  const preview = document.createElement(item.type === "video" ? "video" : "img");
  preview.src = item.url;
  if (item.type === "video") {
    preview.muted = true;
    preview.playsInline = true;
    preview.preload = "metadata";
  } else {
    preview.alt = item.label;
    preview.loading = "lazy";
    preview.referrerPolicy = "no-referrer";
  }
  preview.addEventListener("error", () => button.classList.add("preview-error"));

  const check = document.createElement("span");
  check.className = "check";
  check.textContent = "✓";
  const type = document.createElement("span");
  type.className = "type";
  type.textContent = item.type === "video" ? "视频" : (item.isPrimary ? "主图" : String(position));
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = item.width && item.height ? `${item.width}×${item.height}` : "";
  const variantName = document.createElement("span");
  variantName.className = "variant-name";
  variantName.textContent = item.variantLabel || "";
  variantName.classList.toggle("hidden", !item.variantLabel);
  button.append(preview, variantName, check, type, meta);
  button.addEventListener("click", () => {
    if (state.selected.has(item.id)) state.selected.delete(item.id);
    else state.selected.add(item.id);
    updateCards();
  });
  return button;
}

function applyFilter() {
  el.mediaGrid.querySelectorAll(".media-card").forEach((card) => {
    const item = state.data.media.find((media) => media.id === card.dataset.id);
    const visible = state.filter === "all" ||
      (state.filter === "video" ? item.type === "video" : item.category === state.filter);
    card.classList.toggle("hidden-by-filter", !visible);
  });
  el.mediaGrid.querySelectorAll(".media-group").forEach((group) => {
    group.classList.toggle("hidden-by-filter", !group.querySelector(".media-card:not(.hidden-by-filter)"));
  });
  updateCards();
}

function visibleItems() {
  return (state.data && state.data.media || []).filter((item) => state.filter === "all" ||
    (state.filter === "video" ? item.type === "video" : item.category === state.filter));
}

function toggleGroupSelection(category) {
  const items = state.data.media.filter((item) => item.category === category &&
    (state.filter !== "video" || item.type === "video"));
  const allSelected = items.length > 0 && items.every((item) => state.selected.has(item.id));
  items.forEach((item) => allSelected ? state.selected.delete(item.id) : state.selected.add(item.id));
  updateCards();
}

function updateCards() {
  el.mediaGrid.querySelectorAll(".media-card").forEach((card) => {
    card.classList.toggle("selected", state.selected.has(card.dataset.id));
  });
  el.mediaGrid.querySelectorAll(".group-select").forEach((button) => {
    const items = state.data.media.filter((item) => item.category === button.dataset.category &&
      (state.filter !== "video" || item.type === "video"));
    button.textContent = items.length && items.every((item) => state.selected.has(item.id)) ? "取消本组" : "选择本组";
  });
  updateFooter();
}

function updateFooter() {
  const count = state.selected.size;
  el.selectionText.textContent = `已选 ${count} 项`;
  el.downloadCount.textContent = String(count);
  el.downloadButton.disabled = count === 0 || state.downloading;
}

async function downloadSelected() {
  if (!state.data || state.downloading) return;
  const items = state.data.media.filter((item) => state.selected.has(item.id));
  state.downloading = true;
  el.downloadButton.querySelector("span").textContent = "正在加入…";
  updateFooter();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "DOWNLOAD_PRODUCT_MEDIA",
      payload: {
        siteLabel: state.data.siteLabel,
        sku: state.data.sku,
        variant: state.data.variant,
        items
      }
    });
    if (!response || !response.ok) throw new Error(response && response.error ? response.error : "下载任务创建失败");
    showToast(response.failed ? `已加入 ${response.queued} 项，${response.failed} 项失败` : `已加入 ${response.queued} 项下载`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    state.downloading = false;
    el.downloadButton.querySelector("span").textContent = "下载所选";
    updateFooter();
  }
}

function showOnly(id) {
  ["loadingState", "unsupportedState", "errorState", "resultState"].forEach((key) => {
    el[key].classList.toggle("hidden", key !== id);
  });
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.add("visible");
  toastTimer = setTimeout(() => el.toast.classList.remove("visible"), 2400);
}
