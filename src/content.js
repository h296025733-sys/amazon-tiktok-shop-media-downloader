(function initShopMediaScanner() {
  "use strict";

  if (globalThis.__SHOP_MEDIA_SCANNER_LOADED__) return;
  globalThis.__SHOP_MEDIA_SCANNER_LOADED__ = true;

  const U = globalThis.ShopMediaUtils;
  const PROFILES = globalThis.ShopMediaProfiles || {};
  const pageSite = U.classifySite(location.hostname, location.pathname);

  function addImage(items, value, meta) {
    let url = U.normalizeUrl(value, location.href);
    if (!url) return;
    if (pageSite === "amazon") url = U.amazonOriginalUrl(url);
    items.push({
      type: "image",
      site: pageSite,
      url,
      width: Number(meta && meta.width) || 0,
      height: Number(meta && meta.height) || 0,
      source: (meta && meta.source) || "page",
      label: (meta && meta.label) || "商品图片",
      category: (meta && meta.category) || "display",
      variantLabel: (meta && meta.variantLabel) || "",
      isPrimary: Boolean(meta && meta.isPrimary)
    });
  }

  function addVideo(items, value, meta) {
    const url = U.normalizeUrl(value, location.href);
    if (!url || /\.m3u8(?:$|\?)/i.test(url)) return;
    items.push({
      type: "video",
      site: pageSite,
      url,
      width: Number(meta && meta.width) || 0,
      height: Number(meta && meta.height) || 0,
      source: (meta && meta.source) || "page",
      label: (meta && meta.label) || "商品视频",
      category: (meta && meta.category) || "display",
      variantLabel: (meta && meta.variantLabel) || "",
      isPrimary: Boolean(meta && meta.isPrimary)
    });
  }

  function readImageElement(items, image, meta) {
    if (!image) return;
    const base = {
      width: image.naturalWidth || Number(image.getAttribute("width")) || 0,
      height: image.naturalHeight || Number(image.getAttribute("height")) || 0,
      ...meta,
      variantLabel: meta && meta.category === "sku"
        ? ((meta && meta.variantLabel) || skuLabelFromImage(image))
        : ((meta && meta.variantLabel) || "")
    };
    const candidates = [
      image.dataset.oldHires,
      image.dataset.zoomImage,
      image.dataset.hires,
      image.dataset.original,
      image.dataset.originalSrc,
      image.dataset.lazySrc,
      image.dataset.src,
      image.getAttribute("data-a-hires"),
      image.currentSrc,
      image.src
    ];
    for (const candidate of candidates) addImage(items, candidate, base);

    const dynamic = image.getAttribute("data-a-dynamic-image");
    if (dynamic) {
      try {
        const parsed = JSON.parse(dynamic);
        for (const [url, size] of Object.entries(parsed)) {
          addImage(items, url, {
            ...base,
            width: Array.isArray(size) ? size[0] : base.width,
            height: Array.isArray(size) ? size[1] : base.height,
            source: "original"
          });
        }
      } catch {
        // Some page experiments emit a partial value; normal image attributes still work.
      }
    }

    const srcset = image.getAttribute("srcset");
    if (srcset) {
      for (const part of srcset.split(",")) addImage(items, part.trim().split(/\s+/)[0], base);
    }
    const lazySrcset = image.getAttribute("data-srcset");
    if (lazySrcset) {
      for (const part of lazySrcset.split(",")) addImage(items, part.trim().split(/\s+/)[0], base);
    }
  }

  function cleanVariantLabel(value) {
    const text = String(value || "")
      .replace(/^(?:click\s+to\s+select|select|choose|选择|点击选择)\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length > 80 || text.length < 2) return "";
    const productTitle = (document.querySelector("h1")?.textContent || document.title || "").replace(/\s+/g, " ").trim();
    if (productTitle && (text === productTitle || productTitle.startsWith(text) || text.startsWith(productTitle))) return "";
    if (/^(?:image|product|photo|picture|thumbnail|sku|variant|pdp[-_\d\s]*|商品图片|产品图片|主图)$/i.test(text)) return "";
    return text;
  }

  function skuLabelFromImage(image) {
    const owner = image.closest("[data-sku-id], [data-sku], [data-variation-id], button, [role='button'], li");
    const candidates = owner ? [
      owner.getAttribute("aria-label"),
      owner.getAttribute("title"),
      owner.getAttribute("data-value-name"),
      owner.getAttribute("data-variation-name"),
      owner.textContent
    ] : [];
    candidates.push(image.getAttribute("aria-label"), image.getAttribute("title"), image.alt);
    for (const candidate of candidates) {
      const label = cleanVariantLabel(candidate);
      if (label) return label;
    }
    return "";
  }

  function getAmazonContext() {
    const asinInput = document.querySelector("#ASIN, input[name='ASIN'], input[name='asin']");
    const sku = (asinInput && asinInput.value) || U.productIdFromUrl(location.href, "amazon") || "unknown-asin";
    const selected = Array.from(document.querySelectorAll(
      "#twister .swatchSelect, #twister [aria-checked='true'], #variation_size_name .selection, #variation_color_name .selection"
    )).map((node) => node.getAttribute("title") || node.textContent.trim()).filter(Boolean);
    return { sku, variant: selected.join(" · ") };
  }

  function hasExcludedAncestor(node, boundary) {
    for (let current = node; current && current !== boundary; current = current.parentElement) {
      const identity = [
        current.id,
        current.className,
        current.getAttribute && current.getAttribute("data-e2e"),
        current.getAttribute && current.getAttribute("data-testid"),
        current.getAttribute && current.getAttribute("data-cel-widget")
      ].filter((value) => typeof value === "string").join(" ");
      if (U.isExcludedProductSection(identity)) return true;
    }
    return false;
  }

  function readMediaRoot(items, root, labels) {
    if (!root) return;
    root.querySelectorAll("img").forEach((image) => {
      if (hasExcludedAncestor(image, root)) return;
      readImageElement(items, image, {
        label: labels.image,
        category: labels.category,
        source: labels.source || "page",
        variantLabel: labels.variantLabel || ""
      });
    });
    root.querySelectorAll("video, video source").forEach((node) => {
      if (hasExcludedAncestor(node, root)) return;
      addVideo(items, node.currentSrc || node.src, {
        width: node.videoWidth || 0,
        height: node.videoHeight || 0,
        label: labels.video,
        category: labels.category,
        source: labels.source || "page",
        variantLabel: labels.variantLabel || ""
      });
    });
    root.querySelectorAll("picture source[srcset], picture source[data-srcset]").forEach((source) => {
      const srcset = source.getAttribute("srcset") || source.getAttribute("data-srcset") || "";
      for (const part of srcset.split(",")) {
        addImage(items, part.trim().split(/\s+/)[0], {
          label: labels.image,
          category: labels.category,
          source: labels.source || "page",
          variantLabel: labels.variantLabel || ""
        });
      }
    });
    root.querySelectorAll("[style*='background' i]").forEach((node) => {
      if (hasExcludedAncestor(node, root)) return;
      const style = node.getAttribute("style") || "";
      for (const match of style.matchAll(/url\(\s*(['\"]?)(.*?)\1\s*\)/gi)) {
        addImage(items, match[2], {
          label: labels.image,
          category: labels.category,
          source: labels.source || "page",
          variantLabel: labels.category === "sku" ? skuLabelFromImage(node) : ""
        });
      }
    });
  }

  function uniqueRoots(selectors) {
    const roots = [];
    const seen = new Set();
    document.querySelectorAll(selectors).forEach((root) => {
      if (seen.has(root) || roots.some((parent) => parent.contains(root))) return;
      seen.add(root);
      roots.push(root);
    });
    return roots;
  }

  function scanProfileGroups(items, site) {
    const profile = PROFILES[site];
    if (!profile || !Array.isArray(profile.groups)) return;
    profile.groups.forEach((group) => {
      const selector = Array.isArray(group.selectors) ? group.selectors.join(", ") : "";
      if (!selector) return;
      uniqueRoots(selector).forEach((root) => readMediaRoot(items, root, {
        image: group.imageLabel,
        video: group.videoLabel,
        category: group.category,
        source: "page"
      }));
    });
  }

  function semanticMediaRoots(pattern) {
    const candidates = Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading'], div, span"))
      .filter((node) => node.childElementCount <= 2 && pattern.test((node.textContent || "").trim()));
    const roots = [];
    for (const candidate of candidates) {
      let current = candidate.parentElement;
      for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
        if (hasExcludedAncestor(current, null)) break;
        const mediaCount = current.querySelectorAll("img, video, video source").length;
        if (mediaCount > 0 && mediaCount <= 60) {
          if (!roots.some((root) => root === current || root.contains(current))) roots.push(current);
          break;
        }
      }
    }
    return roots;
  }

  function scanAmazon() {
    const items = [];
    const context = getAmazonContext();
    const primary = document.querySelector("#landingImage, #imgBlkFront, #main-image");
    readImageElement(items, primary, {
      isPrimary: true,
      label: "当前 SKU 主图",
      category: "sku",
      source: "original",
      variantLabel: context.variant
    });

    scanProfileGroups(items, "amazon");

    // Amazon keeps current product gallery data in a few dedicated state blocks.
    // Only inspect those blocks; scanning every script also captures ads and recommendations.
    const productStateText = Array.from(document.scripts)
      .map((script) => script.textContent || "")
      .filter((text) => /colorImages|ImageBlockATF|imageGalleryData|videoBlockIngressState/i.test(text))
      .join("\n");
    const urls = U.urlsFromText(productStateText, {
      hostPattern: /(?:media-amazon|ssl-images-amazon)\.com/i
    });
    for (const url of urls) {
      if (/\.(?:mp4|webm|mov)(?:$|\?)/i.test(url)) {
        addVideo(items, url, { source: "original", label: "商品展示视频", category: "display" });
      } else if (/\/images\/I\//i.test(url)) {
        addImage(items, url, { source: "original", label: "商品展示图", category: "display" });
      }
    }

    return buildResult("Amazon", context.sku, context.variant, items);
  }

  function getTikTokContext() {
    const productId = U.productIdFromUrl(location.href, "tiktok_shop") ||
      textMatch(document.documentElement.innerHTML, /"product_id"\s*:\s*"?([0-9]{8,})/i) || "unknown-product";
    const selected = Array.from(document.querySelectorAll(
      "[data-e2e*='sku'] [aria-checked='true'], [data-testid*='sku'] [aria-checked='true'], " +
      "[class*='sku'] [aria-checked='true'], [class*='variation'] [aria-checked='true'], " +
      "[data-e2e*='sku'] [class*='selected'], [class*='sku'] [class*='active']"
    )).map((node) => node.getAttribute("aria-label") || node.textContent.trim()).filter((value) => value && value.length < 80);
    return { sku: productId, variant: Array.from(new Set(selected)).join(" · ") };
  }

  function scanTikTokShop() {
    const items = [];
    const ogImage = document.querySelector("meta[property='og:image']")?.content;
    addImage(items, ogImage, { isPrimary: true, label: "商品主图", category: "display", source: "original" });

    const context = getTikTokContext();
    const productTitle = (document.querySelector("h1")?.textContent || "").trim();
    Array.from(document.querySelectorAll(".slick-track"))
      .filter((root) => Array.from(root.querySelectorAll("img")).some((image) => (image.alt || "").trim() === productTitle))
      .forEach((root) => readMediaRoot(items, root, {
        image: "商品展示图",
        video: "商品展示视频",
        category: "display"
      }));

    scanProfileGroups(items, "tiktok_shop");

    semanticMediaRoots(/^(?:specification|规格|款式|样式|型号|颜色|尺寸|color|size|style)\s*[:：]?$/i)
      .forEach((root) => readMediaRoot(items, root, {
        image: "SKU 变体图",
        video: "SKU 视频",
        category: "sku"
      }));

    semanticMediaRoots(/^(?:商品描述|产品描述|商品详情|产品详情|product description|description|about this item)\s*[:：]?$/i)
      .forEach((root) => readMediaRoot(items, root, {
        image: "商品详情图",
        video: "商品详情视频",
        category: "detail"
      }));

    collectTikTokProductData(items, context.sku);
    return buildResult("TikTok Shop", context.sku, context.variant, items);
  }

  function collectTikTokProductData(items, productId) {
    const productObjects = [];
    document.querySelectorAll("script[type='application/ld+json'], script[type='application/json']")
      .forEach((script) => {
        const text = script.textContent || "";
        if (!text || text.length > 12000000) return;
        try {
          const data = JSON.parse(text);
          findProductObjects(data, productId, productObjects, new Set(), 0);
        } catch {
          // Only valid JSON state is considered. Arbitrary inline scripts are intentionally ignored.
        }
      });

    const seen = new Set();
    productObjects.forEach((product) => {
      if (seen.has(product)) return;
      seen.add(product);
      collectProductObjectMedia(product, items, [], true, 0, "");
    });
  }

  function findProductObjects(value, productId, result, seen, depth) {
    if (!value || typeof value !== "object" || depth > 18 || seen.has(value)) return;
    seen.add(value);
    if (isProductSchema(value) || hasDirectProductId(value, productId)) result.push(value);
    if (Array.isArray(value)) {
      value.forEach((child) => findProductObjects(child, productId, result, seen, depth + 1));
      return;
    }
    Object.entries(value).forEach(([key, child]) => {
      if (U.isExcludedProductSection(key)) return;
      findProductObjects(child, productId, result, seen, depth + 1);
    });
  }

  function isProductSchema(value) {
    const type = value && value["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  }

  function hasDirectProductId(value, productId) {
    if (!productId || productId === "unknown-product" || Array.isArray(value)) return false;
    return ["product_id", "productId", "productID", "item_id", "itemId", "id"]
      .some((key) => value[key] != null && String(value[key]) === String(productId));
  }

  function deriveSkuLabel(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const directKeys = ["sku_name", "skuName", "variant_name", "variantName", "specification_name", "specificationName", "name"];
    for (const key of directKeys) {
      const label = cleanVariantLabel(typeof value[key] === "string" ? value[key] : "");
      if (label) return label;
    }
    const properties = value.sale_properties || value.saleProperties || value.properties || value.specifications;
    if (Array.isArray(properties)) {
      const labels = properties.map((property) => property && (
        property.value_name || property.valueName || property.name || property.value
      )).map(cleanVariantLabel).filter(Boolean);
      if (labels.length) return Array.from(new Set(labels)).join(" · ").slice(0, 80);
    }
    return "";
  }

  function collectProductObjectMedia(value, items, path, branchAllowed, depth, variantLabel) {
    if (value == null || depth > 14) return;
    if (typeof value === "string") {
      if (!branchAllowed) return;
      collectMediaString(value, items, path, variantLabel);
      return;
    }
    if (Array.isArray(value)) {
      if (branchAllowed) value.forEach((child) => collectProductObjectMedia(child, items, path, true, depth + 1, variantLabel));
      return;
    }
    if (typeof value !== "object") return;

    const localVariantLabel = deriveSkuLabel(value) || variantLabel;

    Object.entries(value).forEach(([key, child]) => {
      if (U.isExcludedProductSection(key)) return;
      const nextPath = path.concat(key);
      const nextAllowed = branchAllowed ? path.length > 0 || U.isProductMediaBranch(key) : U.isProductMediaBranch(key);
      if (nextAllowed) collectProductObjectMedia(child, items, nextPath, true, depth + 1, localVariantLabel);
    });
  }

  function collectMediaString(value, items, path, variantLabel) {
    const branch = path.join(" ");
    const category = /sku|variant|variation/i.test(branch)
      ? "sku"
      : (/description|detail|rich|content/i.test(branch) ? "detail" : "display");
    const urls = /^https?:/i.test(value)
      ? [value]
      : U.urlsFromText(value, { hostPattern: /tiktokcdn|tiktokv|ttcdn|byteoversea|ibytedtos|ibyteimg|byteimg/i });
    urls.slice(0, 100).forEach((url) => {
      if (/video|play|download/i.test(branch) || /\.(?:mp4|webm|mov)(?:$|\?)/i.test(url)) {
        addVideo(items, url, {
          source: "original",
          category,
          variantLabel: category === "sku" ? variantLabel : "",
          label: category === "detail" ? "商品详情视频" : (category === "sku" ? "SKU 视频" : "商品展示视频")
        });
      } else if (/image|gallery|cover|thumbnail|description|detail|content/i.test(branch) ||
          /\.(?:jpe?g|png|webp|avif)(?:$|\?)/i.test(url)) {
        addImage(items, url, {
          source: "original",
          category,
          variantLabel: category === "sku" ? variantLabel : "",
          label: category === "sku" ? "SKU 图片" : (category === "detail" ? "商品详情图" : "商品展示图")
        });
      }
    });
  }

  function textMatch(text, pattern) {
    const match = String(text || "").match(pattern);
    return match ? match[1] : "";
  }

  function buildResult(siteLabel, sku, variant, items) {
    const media = U.dedupeMedia(items).filter((item) => {
      if (item.type === "video") return true;
      return item.category === "sku" || item.category === "detail" || item.isPrimary ||
        item.source === "original" || item.width >= 180 || item.height >= 180;
    });
    return {
      supported: true,
      site: pageSite,
      siteLabel,
      sku,
      variant,
      pageTitle: document.title,
      pageUrl: location.href,
      media
    };
  }

  function scanPage() {
    if (pageSite === "amazon") return scanAmazon();
    if (pageSite === "tiktok_shop") return scanTikTokShop();
    return {
      supported: false,
      site: "unsupported",
      pageTitle: document.title,
      pageUrl: location.href,
      media: []
    };
  }

  globalThis.ShopMediaScanner = { scanPage };
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === "SCAN_PRODUCT_MEDIA") {
      try {
        sendResponse({ ok: true, data: scanPage() });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  });
})();
