"use strict";

importScripts("media-utils.js");

const U = globalThis.ShopMediaUtils;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  if (message.type === "OPEN_MEDIA_POPUP") {
    const options = sender.tab && sender.tab.windowId != null ? { windowId: sender.tab.windowId } : undefined;
    chrome.action.openPopup(options)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  if (message.type !== "DOWNLOAD_PRODUCT_MEDIA") return undefined;
  queueDownloads(message.payload)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

async function queueDownloads(payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items.slice(0, 200) : [];
  if (!items.length) throw new Error("没有选中可下载的素材");

  const site = U.sanitizePathPart(payload.siteLabel, "商品页");
  const sku = U.sanitizePathPart(payload.sku, "unknown-sku");
  const variant = U.sanitizePathPart(payload.variant, "");
  const folder = ["商品素材", site, sku, variant].filter(Boolean).join("/");
  const settled = [];
  const categoryPositions = { sku: 0, display: 0, detail: 0 };
  const categoryFolders = { sku: "01-SKU素材", display: "02-商品展示", detail: "03-详情简介" };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const kind = item.type === "video" ? "video" : "image";
    const extension = U.extensionFromUrl(item.url, item.type);
    const category = categoryFolders[item.category] ? item.category : "display";
    categoryPositions[category] += 1;
    const position = String(categoryPositions[category]).padStart(2, "0");
    const primary = item.isPrimary ? "-main" : "";
    const visibleLabel = category === "sku" ? (item.variantLabel || item.label) : item.label;
    const label = U.sanitizePathPart(visibleLabel, kind).replace(/\s+/g, "-");
    const filename = `${folder}/${categoryFolders[category]}/${position}-${label}${primary}.${extension}`;
    try {
      const downloadId = await chrome.downloads.download({
        url: item.url,
        filename,
        conflictAction: "uniquify",
        saveAs: false
      });
      settled.push({ ok: true, downloadId, url: item.url });
    } catch (error) {
      settled.push({ ok: false, url: item.url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    queued: settled.filter((item) => item.ok).length,
    failed: settled.filter((item) => !item.ok).length,
    failures: settled.filter((item) => !item.ok).slice(0, 5)
  };
}
