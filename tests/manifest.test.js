"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");

test("keeps extension permissions intentionally narrow", () => {
  assert.deepEqual(manifest.permissions, ["activeTab", "downloads"]);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
  assert.equal(manifest.permissions.includes("history"), false);
  assert.equal(manifest.permissions.includes("webRequest"), false);
});

test("loads declarative site profiles before the page scanner", () => {
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("src/site-profiles.js") >= 0);
  assert.ok(scripts.indexOf("src/site-profiles.js") < scripts.indexOf("src/content.js"));
});

test("loads the Chinese page toolbar and binds Alt+Z to the popup", () => {
  const contentScript = manifest.content_scripts[0];
  assert.ok(contentScript.js.includes("src/page-toolbar.js"));
  assert.ok(contentScript.css.includes("src/page-toolbar.css"));
  assert.equal(manifest.commands._execute_action.suggested_key.default, "Alt+Z");
  assert.ok(Number(manifest.minimum_chrome_version) >= 127);
});
