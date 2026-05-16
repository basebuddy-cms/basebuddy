import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

const getImageAlignmentStyle = (align: unknown) => {
  if (align === "center") {
    return "display:block;margin-left:auto;margin-right:auto;";
  }

  if (align === "right") {
    return "display:block;margin-left:auto;margin-right:0;";
  }

  if (align === "left") {
    return "display:block;margin-left:0;margin-right:auto;";
  }

  return "";
};

const BaseBuddyImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: () => ({}),
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute("height"),
        renderHTML: (attributes) => (attributes.height ? { height: String(attributes.height) } : {}),
      },
      linkHref: {
        default: null,
        parseHTML: (element) => element.closest("a[href]")?.getAttribute("href") ?? null,
        renderHTML: () => ({}),
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => (attributes.width ? { width: String(attributes.width) } : {}),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const nodeAlign = node.attrs.align;
    const nodeLinkHref = node.attrs.linkHref;
    const {
      style,
      ...imageAttributes
    } = HTMLAttributes;
    const align = typeof nodeAlign === "string" ? nodeAlign : "";
    const linkHref = typeof nodeLinkHref === "string" ? nodeLinkHref : "";
    const alignmentStyle = getImageAlignmentStyle(align);
    const imageNode = [
      "img",
      mergeAttributes(imageAttributes, {
        "data-align": align || undefined,
        style: [style, alignmentStyle].filter(Boolean).join(" ") || undefined,
      }),
    ] as const;

    if (linkHref) {
      return [
        "a",
        {
          href: String(linkHref),
          rel: "noopener noreferrer",
          target: "_blank",
        },
        imageNode,
      ] as const;
    }

    return imageNode;
  },
});

export const createContentRuntimeEditorExtensions = () => [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
    link: {
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    },
    underline: {},
  }),
  BaseBuddyImage.configure({
    allowBase64: true,
  }),
  Placeholder.configure({
    placeholder: "Start writing your post...",
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
];
