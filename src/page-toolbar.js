(function initProductPageToolbar() {
  "use strict";

  if (window !== window.top || globalThis.__SHOP_MEDIA_TOOLBAR_LOADED__) return;
  globalThis.__SHOP_MEDIA_TOOLBAR_LOADED__ = true;

  const U = globalThis.ShopMediaUtils;
  const site = U && U.classifySite(location.hostname, location.pathname);
  if (!U || site === "unsupported") return;

  const BAR_ID = "shop-media-page-toolbar";
  const SPACER_ID = "shop-media-page-toolbar-spacer";
  const MINI_ID = "shop-media-page-toolbar-mini";

  function productTitle() {
    const selector = site === "amazon"
      ? "#productTitle, h1"
      : "[data-e2e='product-title'], [data-testid='product-title'], h1";
    return (document.querySelector(selector)?.textContent || document.title || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function productId() {
    return U.productIdFromUrl(location.href, site) || "";
  }

  async function copyText(value) {
    const text = String(value || "");
    if (!text) throw new Error("没有可复制的内容");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.className = "shop-media-copy-helper";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("浏览器拒绝了复制操作");
    }
  }

  function setButtonFeedback(button, text, tone) {
    const label = button.querySelector(".shop-media-toolbar-label");
    if (!label) return;
    const original = button.dataset.defaultLabel || label.textContent;
    button.dataset.feedback = tone || "success";
    label.textContent = text;
    clearTimeout(button.__shopMediaFeedbackTimer);
    button.__shopMediaFeedbackTimer = setTimeout(() => {
      delete button.dataset.feedback;
      label.textContent = original;
    }, 1500);
  }

  function makeButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `shop-media-toolbar-button shop-media-tone-${options.tone || "indigo"}`;
    button.dataset.action = options.action;
    button.dataset.defaultLabel = options.label;
    button.title = options.title || options.label;

    const icon = document.createElement("span");
    icon.className = "shop-media-toolbar-icon";
    icon.textContent = options.icon;
    const label = document.createElement("span");
    label.className = "shop-media-toolbar-label";
    label.textContent = options.label;
    button.append(icon, label);

    button.addEventListener("click", async () => {
      try {
        await options.run();
        if (options.feedback !== false) setButtonFeedback(button, "✓ 已复制", "success");
      } catch (error) {
        setButtonFeedback(button, error instanceof Error ? error.message : "操作失败", "error");
      }
    });
    return button;
  }

  function openMediaPicker(button) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "OPEN_MEDIA_POPUP" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error("请点击扩展图标打开素材选择器"));
          return;
        }
        if (!response || !response.ok) {
          reject(new Error(response && response.error ? response.error : "素材选择器打开失败"));
          return;
        }
        setButtonFeedback(button, "已打开素材选择器", "success");
        resolve();
      });
    });
  }

  function foreignToolbarHeight() {
    const foreign = document.getElementById("ftk-page-toolbar");
    if (!foreign || getComputedStyle(foreign).display === "none") return 0;
    return Math.max(0, Math.round(foreign.getBoundingClientRect().height));
  }

  function mountToolbar() {
    if (!document.body || document.getElementById(BAR_ID)) return;
    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "商品素材快捷工具栏");

    const brand = document.createElement("div");
    brand.className = "shop-media-toolbar-brand";
    const brandMark = document.createElement("span");
    brandMark.className = "shop-media-toolbar-brand-mark";
    brandMark.textContent = "材";
    const brandText = document.createElement("span");
    brandText.textContent = "商品素材助手";
    brand.append(brandMark, brandText);

    const divider = document.createElement("span");
    divider.className = "shop-media-toolbar-divider";
    bar.append(brand, divider);

    let downloadButton;
    downloadButton = makeButton({
      action: "download",
      icon: "↓",
      label: "下载商品素材 (Alt+Z)",
      tone: "green",
      feedback: false,
      run: () => openMediaPicker(downloadButton)
    });
    bar.append(
      downloadButton,
      makeButton({
        action: "copy-title",
        icon: "▣",
        label: "复制商品标题",
        run: () => copyText(productTitle())
      }),
      makeButton({
        action: "copy-link",
        icon: "⌁",
        label: "复制商品链接",
        run: () => copyText(location.href)
      }),
      makeButton({
        action: "copy-title-link",
        icon: "▤",
        label: "复制标题和链接",
        run: () => copyText(`${productTitle()}\n${location.href}`)
      })
    );

    const id = productId();
    if (id) {
      bar.append(makeButton({
        action: "copy-product-id",
        icon: "ID",
        label: `${site === "amazon" ? "ASIN" : "商品 ID"} ${id}`,
        tone: "slate",
        run: () => copyText(id)
      }));
    }

    const flexible = document.createElement("span");
    flexible.className = "shop-media-toolbar-flex";
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "shop-media-toolbar-collapse";
    collapse.textContent = "▲";
    collapse.title = "收起工具栏";
    bar.append(flexible, collapse);

    const spacer = document.createElement("div");
    spacer.id = SPACER_ID;
    const syncPosition = () => {
      const offset = foreignToolbarHeight();
      bar.style.top = `${offset}px`;
      spacer.style.height = `${bar.getBoundingClientRect().height || 36}px`;
      const mini = document.getElementById(MINI_ID);
      if (mini) mini.style.top = `${offset}px`;
    };

    collapse.addEventListener("click", () => {
      bar.classList.add("shop-media-toolbar-hidden");
      spacer.style.height = "0";
      setTimeout(() => {
        bar.hidden = true;
        showMiniToolbar(syncPosition);
      }, 220);
    });

    document.body.prepend(spacer);
    document.body.prepend(bar);
    requestAnimationFrame(() => {
      syncPosition();
      bar.classList.add("shop-media-toolbar-visible");
    });
    setTimeout(syncPosition, 600);
  }

  function showMiniToolbar(syncPosition) {
    document.getElementById(MINI_ID)?.remove();
    const mini = document.createElement("button");
    mini.id = MINI_ID;
    mini.type = "button";
    mini.title = "展开商品素材工具栏";
    mini.textContent = "材 ▼";
    mini.addEventListener("click", () => {
      mini.remove();
      const bar = document.getElementById(BAR_ID);
      const spacer = document.getElementById(SPACER_ID);
      if (!bar || !spacer) return;
      bar.hidden = false;
      requestAnimationFrame(() => {
        bar.classList.remove("shop-media-toolbar-hidden");
        bar.classList.add("shop-media-toolbar-visible");
        syncPosition();
      });
    });
    document.body.appendChild(mini);
    syncPosition();
  }

  if (document.body) mountToolbar();
  else document.addEventListener("DOMContentLoaded", mountToolbar, { once: true });
})();
