import assert from "node:assert/strict";
import test from "node:test";

import { cleanLegacyPostBodyHtml, sanitizeContentHtml } from "../src/lib/content-html.ts";

test("legacy Elementor post bodies render only the article copy", () => {
  const html = `
    <div data-elementor-type="wp-post">
      <div class="elementor-widget-image"><img src="/old-logo.png"></div>
      <div class="elementor-widget-theme-post-title"><h1>Imported title</h1></div>
      <div class="elementor-widget-theme-post-featured-image"><img src="/featured.jpg"></div>
      <div class="elementor-widget-text-editor">
        <p></p>
        <p><strong>Lead paragraph</strong></p>
        <ul class="wp-block-list"><li style="list-style-type: none;"><ul><li>Nested point</li></ul></li></ul>
        <ul class="wp-block-list"><li>Second point</li></ul>
      </div>
      <div class="elementor-widget-post-info"><time>24 December 2025</time></div>
      <h2>Share:</h2>
      <div class="elementor-widget-social-icons">social links</div>
    </div>
  `;

  const cleaned = sanitizeContentHtml(cleanLegacyPostBodyHtml(html));

  assert.match(cleaned, /Lead paragraph/);
  assert.match(cleaned, /<li>Nested point<\/li><li>Second point<\/li>/);
  assert.doesNotMatch(cleaned, /old-logo|Imported title|featured\.jpg|Share:|social links/);
  assert.doesNotMatch(cleaned, /list-style-type/);
});
