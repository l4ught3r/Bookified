export type Fb2Binary = {
  id: string;
  contentType: string;
  data: Buffer;
};

export type Fb2Metadata = {
  title: string;
  authors: string[];
  language: string;
  description: string;
  identifier: string;
  publisher: string;
  publishDate: string;
  coverBinaryId: string | null;
};

export type Fb2InlineNode =
  | { kind: "text"; value: string }
  | { kind: "emphasis"; children: Fb2InlineNode[] }
  | { kind: "strong"; children: Fb2InlineNode[] }
  | { kind: "strikethrough"; children: Fb2InlineNode[] }
  | { kind: "sub"; children: Fb2InlineNode[] }
  | { kind: "sup"; children: Fb2InlineNode[] }
  | { kind: "code"; children: Fb2InlineNode[] }
  | { kind: "link"; href: string; children: Fb2InlineNode[] }
  | { kind: "image"; binaryId: string };

export type Fb2Poem = {
  title?: Fb2InlineNode[];
  stanzas: Fb2InlineNode[][][];
};

export type Fb2Block =
  | { kind: "paragraph"; nodes: Fb2InlineNode[] }
  | { kind: "empty-line"; count: number }
  | { kind: "image"; binaryId: string }
  | { kind: "title"; nodes: Fb2InlineNode[]; level: number }
  | { kind: "subtitle"; nodes: Fb2InlineNode[] }
  | { kind: "epigraph"; blocks: Fb2Block[] }
  | { kind: "cite"; blocks: Fb2Block[] }
  | { kind: "text-author"; nodes: Fb2InlineNode[] }
  | { kind: "poem"; poem: Fb2Poem }
  | { kind: "section"; section: Fb2Section };

export type Fb2Section = {
  id: string;
  blocks: Fb2Block[];
};

export type Fb2Chapter = {
  order: number;
  href: string;
  title: string;
  section: Fb2Section;
  level: number;
};

export type Fb2TocItem = {
  title: string;
  href: string;
  order: number;
  level: number;
};

export type Fb2ParseResult = {
  metadata: Fb2Metadata;
  chapters: Fb2Chapter[];
  toc: Fb2TocItem[];
  binaries: Fb2Binary[];
  coverData: Buffer | null;
  coverMediaType: string;
  errors: string[];
};
