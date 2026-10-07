(function initMediaUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ShopMediaUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function mediaUtilsFactory() {
  "use strict";

  const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
  const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);

  function decodeEscapedUrl(value) {
    if (!value || typeof value !== "string") return "";
    return value
      .replace(/\\u002[fF]/g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/\\u003[dD]/g, "=")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .trim();
  }

  function normalizeUrl(value, baseUrl) {
    const decoded = decodeEscapedUrl(value);
    if (!decoded || decoded.startsWith("data:") || decoded.startsWith("blob:")) return "";
    try {
      const url = new URL(decoded, baseUrl || "https://invalid.local");
      if (!/^https?:$/.test(url.protocol)) return "";
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function amazonOriginalUrl(value) {
    const normalized = normalizeUrl(value);
    if (!normalized) return "";
    try {
      const url = new URL(normalized);
      if (!/(media-amazon|ssl-images-amazon)\.com$/i.test(url.hostname)) return normalized;
      url.pathname = url.pathname.replace(/\.(_[^/]+_)\.(jpe?g|png|webp|avif)$/i, ".$2");
      url.search = "";
      return url.href;
    } catch {
      return normalized;
    }
  }

  function classifySite(hostname, pathname) {
    const host = String(hostname || "").toLowerCase();
    const path = String(pathname || "").toLowerCase();
    if (/(^|\.)amazon\.[a-z.]+$/.test(host) &&
        /\/(?:dp|gp\/product|product)\/[a-z0-9]{10}(?:[/?]|$)/i.test(path)) return "amazon";
    if ((host === "shop.tiktok.com" || host.endsWith(".tiktok.com")) &&
        (/\/(?:view\/)?product\/[0-9]{8,}/.test(path) || /\/(?:shop\/)?pdp\/[^/]*\/?[0-9]{8,}/.test(path))) {
      return "tiktok_shop";
    }
    return "unsupported";
  }

  function isExcludedProductSection(value) {
    return /(?:^|[-_\s])(recommend(?:ed|ation)?s?|related|similar|sponsored|advert(?:isement)?s?|reviews?|comments?|customer|seller|shop|avatar|logo|icon|banner|campaign|promotion|live|feed|navigation|header|footer)(?:$|[-_\s])/i
      .test(String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2"));
  }

  function isProductMediaBranch(value) {
    return /(?:^|[-_\s])(image|images|video|videos|media|gallery|sku|skus|variant|variation|description|detail|rich|content|product|base|display|cover|thumbnail)(?:$|[-_\s])/i
      .test(String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2"));
  }

  function productIdFromUrl(value, site) {
    try {
      const url = new URL(value);
      if (site === "amazon") {
        const match = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
        return match ? match[1].toUpperCase() : "";
      }
      if (site === "tiktok_shop") {
        const match = url.pathname.match(/\/(?:view\/)?product\/([0-9]{8,})/i) ||
          url.pathname.match(/\/pdp\/(?:[^/]+\/)?([0-9]{8,})(?:[/?]|$)/i);
        return match ? match[1] : (url.searchParams.get("product_id") || "");
      }
    } catch {
      return "";
    }
    return "";
  }

  function extensionFromUrl(value, type) {
    try {
      const match = new URL(value).pathname.match(/\.([a-z0-9]{2,5})$/i);
      const ext = match ? match[1].toLowerCase() : "";
      if (type === "video" && VIDEO_EXTENSIONS.has(ext)) return ext;
      if (type === "image" && IMAGE_EXTENSIONS.has(ext)) return ext === "jpeg" ? "jpg" : ext;
    } catch {
      // Fall through to a safe default.
    }
    return type === "video" ? "mp4" : "jpg";
  }

  function sanitizePathPart(value, fallback) {
    const safe = String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 80);
    return safe || fallback || "unknown";
  }

  function canonicalKey(item) {
    try {
      const url = new URL(item.url);
      if (item.site === "amazon") url.search = "";
      if (item.site === "tiktok_shop") {
        // TikTok renders the same asset as 300/600/800/1600px CDN transforms.
        // Collapse those variants by the stable object path before `~tplv-`.
        url.pathname = url.pathname.replace(/~tplv-[^/]+$/i, "");
        url.search = "";
      }
      return `${item.type}:${url.href}`;
    } catch {
      return `${item.type}:${item.url}`;
    }
  }

  function dedupeMedia(items) {
    const map = new Map();
    for (const raw of items || []) {
      if (!raw || !raw.url || !raw.type) continue;
      const item = {
        width: 0,
        height: 0,
        label: raw.type === "video" ? "商品视频" : "商品图片",
        source: "page",
        category: "display",
        isPrimary: false,
        ...raw
      };
      const key = canonicalKey(item);
      const previous = map.get(key);
      if (!previous) {
        map.set(key, item);
        continue;
      }
      const stronger = mediaScore(item) > mediaScore(previous) ? item : previous;
      const weaker = stronger === item ? previous : item;
      map.set(key, {
        ...weaker,
        ...stronger,
        isPrimary: Boolean(stronger.isPrimary || weaker.isPrimary),
        variantLabel: stronger.variantLabel || weaker.variantLabel || ""
      });
    }
    return Array.from(map.values())
      .sort((a, b) => mediaScore(b) - mediaScore(a))
      .map((item, index) => ({ ...item, id: `media-${index + 1}` }));
  }

  function mediaScore(item) {
    const pixels = Math.min((Number(item.width) || 0) * (Number(item.height) || 0), 5000000) / 10000;
    return (item.isPrimary ? 1000 : 0) + (item.source === "original" ? 500 : 0) +
      (item.category === "sku" ? 220 : item.category === "detail" ? 40 : 0) +
      (item.type === "video" ? 80 : 0) + pixels;
  }

  function urlsFromText(text, options) {
    const input = String(text || "");
    const hostPattern = options && options.hostPattern;
    if (!hostPattern) return [];
    const expression = new RegExp(`https?:\\\\?/\\\\?/[^"'\\s<>]+`, "gi");
    const result = [];
    for (const match of input.matchAll(expression)) {
      const url = normalizeUrl(match[0]);
      if (!url || !hostPattern.test(url)) continue;
      result.push(url.replace(/[),\\]}]+$/, ""));
    }
    return Array.from(new Set(result));
  }

  return {
    amazonOriginalUrl,
    classifySite,
    decodeEscapedUrl,
    dedupeMedia,
    extensionFromUrl,
    isExcludedProductSection,
    isProductMediaBranch,
    normalizeUrl,
    productIdFromUrl,
    sanitizePathPart,
    urlsFromText
  };
});
