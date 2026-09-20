import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Generic reusable page-section node. Serialises to
 * `<div data-block="cards|card|cta|callout|figure|caption">…</div>`, which the
 * public site renders verbatim (styled by the `.cb-*` rules in styles.css),
 * so blocks look identical in the CMS and on the live page.
 */
export const ContentBlock = Node.create({
  name: "contentBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "callout",
        parseHTML: (element) => element.getAttribute("data-block") ?? "callout",
        renderHTML: (attributes) => ({ "data-block": attributes.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-block]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: `cb cb-${node.attrs.variant as string}` }),
      0,
    ];
  },
});

export type BlockTemplate = {
  id: string;
  label: string;
  description: string;
  html: string;
};

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: "cards",
    label: "Card grid",
    description: "Three side-by-side cards for services or highlights",
    html: `
      <div data-block="cards">
        <div data-block="card"><h3>First card</h3><p>Short supporting sentence about this point.</p></div>
        <div data-block="card"><h3>Second card</h3><p>Short supporting sentence about this point.</p></div>
        <div data-block="card"><h3>Third card</h3><p>Short supporting sentence about this point.</p></div>
      </div>
    `,
  },
  {
    id: "cta",
    label: "Call to action",
    description: "Heading, sentence and a button link",
    html: `
      <div data-block="cta">
        <h3>Your healing starts with one conversation.</h3>
        <p>Book a confidential session with a licensed therapist.</p>
        <p><a href="/book">Book a session</a></p>
      </div>
    `,
  },
  {
    id: "callout",
    label: "Callout",
    description: "Highlighted note on a deep background",
    html: `
      <div data-block="callout">
        <h3>Good to know</h3>
        <p>Use this space for an important note, reminder or reassurance.</p>
      </div>
    `,
  },
  {
    id: "figure",
    label: "Image + caption",
    description: "Full-width image with a caption underneath",
    html: `
      <div data-block="figure">
        <p><img src="https://placehold.co/1600x900/png" alt="Describe this image" /></p>
        <div data-block="caption"><p>Write a caption for this image.</p></div>
      </div>
    `,
  },
];
