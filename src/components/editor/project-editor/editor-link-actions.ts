type LinkCommandChain = {
  extendMarkRange: (mark: string) => LinkCommandChain;
  focus: () => LinkCommandChain;
  run: () => boolean;
  setLink: (attributes: {
    href: string;
    target?: string | null;
    rel?: string | null;
  }) => LinkCommandChain;
  setTextSelection: (selection: LinkTextSelection) => LinkCommandChain;
  unsetLink: () => LinkCommandChain;
};

type LinkTextSelection = {
  from: number;
  to: number;
};

type LinkCommandEditor = {
  chain: () => LinkCommandChain;
  isActive: (mark: string) => boolean;
  state: {
    selection: {
      empty: boolean;
    };
  };
};

export const runProjectEditorLinkApply = (
  editor: LinkCommandEditor,
  attributes: {
    href: string;
    target?: string | null;
    rel?: string | null;
  },
  options?: {
    extendExistingLink?: boolean;
    selection?: LinkTextSelection | null;
  },
) => {
  const chain = editor.chain().focus();

  if (options?.selection) {
    chain.setTextSelection(options.selection);
  }

  if (options?.extendExistingLink ?? editor.isActive("link")) {
    chain.extendMarkRange("link");
  }

  chain.setLink(attributes).run();
};

export const runProjectEditorLinkUnlink = (
  editor: LinkCommandEditor,
  options?: {
    selection?: LinkTextSelection | null;
  },
) => {
  const chain = editor.chain().focus();
  const selection = options?.selection ?? null;
  const isCursorOnly = selection ? selection.from === selection.to : editor.state.selection.empty;

  if (selection) {
    chain.setTextSelection(selection);
  }

  if (isCursorOnly) {
    chain.extendMarkRange("link");
  }

  chain.unsetLink().run();
};
