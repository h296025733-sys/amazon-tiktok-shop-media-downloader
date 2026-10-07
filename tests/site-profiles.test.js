"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const profiles = require("../src/site-profiles.js");

test("keeps Amazon and TikTok Shop extraction groups product-scoped and categorized", () => {
  for (const site of ["amazon", "tiktok_shop"]) {
    assert.ok(Array.isArray(profiles[site].groups));
    assert.ok(profiles[site].groups.length >= 2);
    profiles[site].groups.forEach((group) => {
      assert.ok(["sku", "display", "detail"].includes(group.category));
      assert.ok(group.selectors.length > 0);
      assert.ok(group.selectors.every((selector) => !/^(?:img|video|\*)$/i.test(selector.trim())));
    });
  }
});

test("includes dedicated SKU and detail groups for Amazon", () => {
  const categories = new Set(profiles.amazon.groups.map((group) => group.category));
  assert.ok(categories.has("sku"));
  assert.ok(categories.has("detail"));
});
