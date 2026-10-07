(function initShopMediaProfiles(root, factory) {
  const profiles = factory();
  if (typeof module === "object" && module.exports) module.exports = profiles;
  root.ShopMediaProfiles = profiles;
})(typeof globalThis !== "undefined" ? globalThis : this, function shopMediaProfilesFactory() {
  "use strict";

  return Object.freeze({
    amazon: Object.freeze({
      groups: Object.freeze([
        Object.freeze({
          key: "gallery",
          category: "display",
          imageLabel: "商品展示图",
          videoLabel: "商品展示视频",
          selectors: Object.freeze(["#imageBlock", "#imageBlock_feature_div", "#ebooks-img-canvas", "#altImages"])
        }),
        Object.freeze({
          key: "variants",
          category: "sku",
          imageLabel: "SKU 变体图",
          videoLabel: "SKU 视频",
          selectors: Object.freeze(["#twister", "#variation_color_name", "#variation_size_name", "#variation_style_name"])
        }),
        Object.freeze({
          key: "details",
          category: "detail",
          imageLabel: "商品详情图",
          videoLabel: "商品详情视频",
          selectors: Object.freeze([
            "#productDescription",
            "#productDescription_feature_div",
            "#aplus",
            "#aplus_feature_div",
            "#aplusBrandStory_feature_div",
            "[data-feature-name='aplus']",
            "[data-feature-name='productDescription']"
          ])
        })
      ])
    }),
    tiktok_shop: Object.freeze({
      groups: Object.freeze([
        Object.freeze({
          key: "gallery",
          category: "display",
          imageLabel: "商品展示图",
          videoLabel: "商品展示视频",
          selectors: Object.freeze([
            "[data-e2e*='product-image']",
            "[data-e2e*='product-gallery']",
            "[data-testid*='product-image']",
            "[data-testid*='product-gallery']",
            "[class*='ProductImage']",
            "[class*='ProductGallery']",
            "[class*='product-image']",
            "[class*='product_gallery']"
          ])
        }),
        Object.freeze({
          key: "details",
          category: "detail",
          imageLabel: "商品详情图",
          videoLabel: "商品详情视频",
          selectors: Object.freeze([
            "[data-e2e*='product-description']",
            "[data-e2e*='product-detail-content']",
            "[data-testid*='product-description']",
            "[data-testid*='product-detail-content']",
            "[class*='ProductDescription']",
            "[class*='ProductDetailContent']",
            "[class*='product-description']",
            "[class*='product_detail_content']",
            "[id*='product-description']"
          ])
        })
      ])
    })
  });
});
