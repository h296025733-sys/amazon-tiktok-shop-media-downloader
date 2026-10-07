"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../src/media-utils.js");

test("classifies Amazon and TikTok Shop pages without accepting normal TikTok videos", () => {
  assert.equal(U.classifySite("www.amazon.com", "/dp/B012345678"), "amazon");
  assert.equal(U.classifySite("www.amazon.com", "/s?k=wireless+mouse"), "unsupported");
  assert.equal(U.classifySite("shop.tiktok.com", "/view/product/1729999999999999999"), "tiktok_shop");
  assert.equal(U.classifySite("www.tiktok.com", "/shop/pdp/example/1729999999999999999"), "tiktok_shop");
  assert.equal(U.classifySite("shop.tiktok.com", "/us"), "unsupported");
  assert.equal(U.classifySite("www.tiktok.com", "/@creator/video/123"), "unsupported");
});

test("extracts product identifiers", () => {
  assert.equal(U.productIdFromUrl("https://www.amazon.de/dp/B0ABC12345?th=1", "amazon"), "B0ABC12345");
  assert.equal(U.productIdFromUrl("https://shop.tiktok.com/view/product/1729999999999999999", "tiktok_shop"), "1729999999999999999");
  assert.equal(U.productIdFromUrl("https://shop.tiktok.com/us/pdp/example-name/1731284292221047030", "tiktok_shop"), "1731284292221047030");
});

test("turns a resized Amazon image into its original asset URL", () => {
  assert.equal(
    U.amazonOriginalUrl("https://m.media-amazon.com/images/I/71Example._AC_SX679_.jpg"),
    "https://m.media-amazon.com/images/I/71Example.jpg"
  );
});

test("decodes escaped script URLs and filters by media host", () => {
  const text = String.raw`{"image":"https:\/\/p16-oec-va.ibyteimg.com\/tos-maliva-i-o3syd03w52-us\/asset.jpeg"}`;
  assert.deepEqual(U.urlsFromText(text, { hostPattern: /ibyteimg\.com/i }), [
    "https://p16-oec-va.ibyteimg.com/tos-maliva-i-o3syd03w52-us/asset.jpeg"
  ]);
});

test("deduplicates media and keeps the stronger original candidate", () => {
  const media = U.dedupeMedia([
    { type: "image", site: "amazon", url: "https://m.media-amazon.com/images/I/a.jpg", width: 100 },
    { type: "image", site: "amazon", url: "https://m.media-amazon.com/images/I/a.jpg", width: 1200, source: "original" }
  ]);
  assert.equal(media.length, 1);
  assert.equal(media[0].width, 1200);
  assert.equal(media[0].id, "media-1");
});

test("collapses TikTok CDN size transforms and keeps the largest categorized asset", () => {
  const base = "https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i/item";
  const media = U.dedupeMedia([
    { type: "image", site: "tiktok_shop", category: "display", url: `${base}~tplv-x-resize-webp:800:800.webp?x=1`, width: 800, height: 800 },
    { type: "image", site: "tiktok_shop", category: "sku", url: `${base}~tplv-x-crop-webp:1600:1600.webp?x=2`, width: 1600, height: 1600 }
  ]);
  assert.equal(media.length, 1);
  assert.equal(media[0].width, 1600);
  assert.equal(media[0].category, "sku");
});

test("recognizes product media branches and rejects unrelated page sections", () => {
  assert.equal(U.isProductMediaBranch("description_images"), true);
  assert.equal(U.isProductMediaBranch("skuList"), true);
  assert.equal(U.isExcludedProductSection("recommendations"), true);
  assert.equal(U.isExcludedProductSection("pdp-review-section"), true);
  assert.equal(U.isExcludedProductSection("product_gallery"), false);
});

test("sanitizes download path components", () => {
  assert.equal(U.sanitizePathPart("Red / Blue:*?", "sku"), "Red - Blue---");
  assert.equal(U.extensionFromUrl("https://cdn.example/item.webp?x=1", "image"), "webp");
});

test("preserves a SKU variant name when a duplicate higher quality image has no label", () => {
  const media = U.dedupeMedia([
    { type: "image", site: "amazon", url: "https://m.media-amazon.com/images/I/example.jpg", category: "sku", variantLabel: "Black" },
    { type: "image", site: "amazon", url: "https://m.media-amazon.com/images/I/example.jpg?quality=100", category: "sku", source: "original", width: 1600, height: 1600 }
  ]);
  assert.equal(media.length, 1);
  assert.equal(media[0].variantLabel, "Black");
});
