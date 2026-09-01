export type ChainManifest = {
  resourceId?: string;
  slug: string;
  title: string;
  description?: string;
  displayOrder?: number;
  collection?: string;
  category?: string;
};

export type ArchiveCategoryManifest = {
  slug: string;
  title: string;
  description?: string;
  displayOrder?: number;
};

export type ArchiveCollectionManifest = ArchiveCategoryManifest & {
  resourceId?: string;
  categories?: ArchiveCategoryManifest[];
};

export type ArchiveOrganizationManifest = {
  collections: ArchiveCollectionManifest[];
};

export type ArchiveAttachment = {
  title: string;
  file: string;
  type: string;
};

export type ArchiveEmailFrontmatter = {
  id: string;
  chain: string;
  date: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  attachments?: ArchiveAttachment[];
};

export type ArchiveEmail = Omit<ArchiveEmailFrontmatter, "attachments"> & {
  attachments: ArchiveAttachment[];
  body: string;
  sourceFile: string;
};

export type ArchiveChainSummary = ChainManifest & {
  entryCount: number;
  attachmentCount: number;
  earliestDate?: string;
  latestDate?: string;
};

export type ArchiveFileCategory = "pdf" | "image" | "text" | "office" | "other";

export type ArchiveFileEntry = ArchiveAttachment & {
  id: string;
  fileName: string;
  category: ArchiveFileCategory;
  size?: number;
  chainSlug: string;
  chainTitle: string;
  emailId: string;
  emailSubject: string;
  emailDate: string;
};

// Kept as a compatibility alias for the initial component scaffold.
export type ArchiveFileSummary = ArchiveFileEntry;

export type ArchiveDiagnostic = {
  code: ArchiveErrorCode;
  message: string;
  chainSlug?: string;
  sourceFile?: string;
};

export type ArchiveDiscoveryResult = {
  chains: ArchiveChainSummary[];
  errors: ArchiveDiagnostic[];
};

export type ArchiveCategory = ArchiveCategoryManifest & {
  chains: ArchiveChainSummary[];
};

export type ArchiveCollection = Omit<ArchiveCollectionManifest, "categories"> & {
  chains: ArchiveChainSummary[];
  categories: ArchiveCategory[];
};

export type ArchiveHierarchy = {
  collections: ArchiveCollection[];
  ungrouped: ArchiveChainSummary[];
  errors: ArchiveDiagnostic[];
};

export type ArchiveFileDiscoveryResult = {
  files: ArchiveFileEntry[];
  errors: ArchiveDiagnostic[];
};

export type ArchiveErrorCode =
  | "archive-not-found"
  | "invalid-chain-slug"
  | "unknown-chain"
  | "invalid-manifest"
  | "invalid-organization"
  | "unknown-organization-reference"
  | "invalid-email"
  | "missing-attachment"
  | "unsafe-path"
  | "filesystem-error";
