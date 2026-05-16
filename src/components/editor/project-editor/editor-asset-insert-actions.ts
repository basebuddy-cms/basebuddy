type AssetTextSelection = {
  from: number;
  to: number;
};

type AssetCommandChain = {
  deleteSelection: () => AssetCommandChain;
  focus: () => AssetCommandChain;
  insertContent: (content: unknown) => AssetCommandChain;
  run: () => boolean;
  setImage: (attributes: { alt?: string | null; src: string }) => AssetCommandChain;
  setLink: (attributes: {
    href: string;
    rel?: string | null;
    target?: string | null;
  }) => AssetCommandChain;
  setTextSelection?: (selection: AssetTextSelection) => AssetCommandChain;
  updateAttributes: (type: string, attributes: Record<string, unknown>) => AssetCommandChain;
};

type AssetCommandEditor = {
  chain: () => AssetCommandChain;
  state: {
    selection: {
      empty: boolean;
    };
  };
};

const projectEditorAssetLinkAttrs = (href: string) => ({
  href,
  rel: "noopener noreferrer",
  target: "_blank",
});

const restoreSelection = (
  chain: AssetCommandChain,
  selection: AssetTextSelection | null | undefined,
) => {
  if (selection && chain.setTextSelection) {
    chain.setTextSelection(selection);
  }
};

export const runProjectEditorImageInsert = (
  editor: AssetCommandEditor,
  image: {
    alt?: string | null;
    src: string;
  },
  options?: {
    selection?: AssetTextSelection | null;
  },
) => {
  const chain = editor.chain().focus();
  restoreSelection(chain, options?.selection);
  chain.setImage({ alt: image.alt ?? "", src: image.src }).run();
};

export const runProjectEditorImageAttributeUpdate = (
  editor: AssetCommandEditor,
  attributes: {
    align?: string | null;
    alt?: string | null;
    height?: string | null;
    linkHref?: string | null;
    width?: string | null;
  },
) => {
  editor.chain().updateAttributes("image", attributes).run();
};

export const runProjectEditorImageRemove = (editor: AssetCommandEditor) => {
  editor.chain().focus().deleteSelection().run();
};

export const runProjectEditorFileInsert = (
  editor: AssetCommandEditor,
  file: {
    fileName: string;
    href: string;
  },
  options?: {
    selection?: AssetTextSelection | null;
  },
) => {
  const chain = editor.chain().focus();
  const selection = options?.selection ?? null;
  const isCursorOnly = selection ? selection.from === selection.to : editor.state.selection.empty;

  restoreSelection(chain, selection);

  if (isCursorOnly) {
    chain
      .insertContent({
        marks: [
          {
            attrs: projectEditorAssetLinkAttrs(file.href),
            type: "link",
          },
        ],
        text: file.fileName.trim() || file.href,
        type: "text",
      })
      .run();
    return;
  }

  chain.setLink(projectEditorAssetLinkAttrs(file.href)).run();
};
