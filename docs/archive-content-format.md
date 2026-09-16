# Archive Content Format Specification

## 1. Purpose and scope

Deadletter reads an **archive**: a directory containing one or more leaf **chains**, such as correspondence about one repair, one insurance matter, or one email thread. An **entry** is one email or document represented by a Markdown file. Attachments remain ordinary files on disk and are associated with an entry by metadata in that entry's YAML frontmatter. An optional virtual **collection** and **category** hierarchy can organize related chains without changing their filesystem locations or leaf routes.

The archive root defaults to `data/chains/`, resolved from the repository root. If `ARCHIVE_DATA_DIR` is set, an absolute value is used as the archive root and a relative value is resolved from the repository root. For example:

```dotenv
ARCHIVE_DATA_DIR=examples/archive/chains
# ARCHIVE_DATA_DIR=/srv/private/archive/chains
```

The format is filesystem-backed. It requires no database, object store, or CMS. A normal content update consists of writing files below the archive root and refreshing the application.

This specification defines archive **content input** only. It does not define deployment, process management, reverse-proxy configuration, or access control.

## 2. Complete directory tree

```text
archive-root/                                      # Selected by ARCHIVE_DATA_DIR, or data/chains/
├── archive.yml                                   # Optional virtual organization manifest
├── insurance-emails/                             # Flat chain directory and slug
    ├── chain.yml                                 # Fixed manifest filename
    ├── emails/                                   # Fixed entry-directory name
    │   ├── 2026-06-25_1044_estimate-sent.md      # User-selected entry filename
    │   └── 2026-06-25_1443_scope-clarification.md
    └── attachments/                              # Recommended organization; see Section 9
        ├── 2026-06-25_1044/                      # User-selected attachment subdirectory
        │   └── estimate.pdf                      # Original attachment bytes
│       └── 2026-06-25_1443/
│           └── exterior-photo.jpg
└── inventory-records/                            # Another flat chain, grouped or ungrouped by metadata
    └── …
```

`archive.yml`, `chain.yml`, and `emails/` have fixed names. `archive.yml` is optional and never physically contains chains. Every chain directory remains a direct child of the archive root, so organization does not change existing `/chains/[chain]` or `/api/files/[chain]/…` paths. The chain directory, Markdown filenames, `attachments/` subdirectories, and attachment filenames are selected by the archive author, subject to the rules below. `attachments/` is the conventional location, but the current path validator only requires a referenced attachment to remain below its owning chain directory.

At the archive root, non-directory files other than `archive.yml` and directories beginning with `.` are ignored. Every other directory or directory symbolic link is considered a chain candidate; an invalid candidate is omitted and reported as skipped content. Inside a chain:

- only direct files or file symbolic links in `emails/` whose names end in `.md`, case-insensitively, are discovered;
- nested directories below `emails/` are ignored;
- files elsewhere are not discovered automatically and only become attachments when frontmatter references them;
- extra files and subdirectories are otherwise ignored; and
- a symbolic link is accepted only when its real target remains inside the archive and owning chain boundaries described in Section 9.

## 3. Chain-directory naming

A chain directory name is its chain slug. A valid slug:

- contains only lowercase ASCII letters `a`–`z`, digits `0`–`9`, and single hyphens;
- starts and ends with a letter or digit;
- contains no spaces, underscores, uppercase letters, leading or trailing hyphens, or repeated hyphens;
- is case-sensitive and must exactly match the `slug` in `chain.yml`;
- contains between 1 and 120 characters, inclusive; and
- has no additional reserved names in the application.

The 120-character maximum is an application validation limit on a valid manifest slug. Filesystem path and filename limits imposed by the host operating system also apply.

Valid examples:

```text
insurance-emails
claim-2026
records2
a
```

Invalid examples:

```text
Insurance-emails      # uppercase letter
insurance_emails      # underscore
insurance emails      # space
-insurance-emails     # leading hyphen
insurance-emails-     # trailing hyphen
insurance--emails     # repeated hyphen
```

No shorter operational limit is enforced. For readability and portable paths, prefer a concise, stable slug that describes the chain without embedding sensitive identifiers.

## 3.1 Optional `archive.yml` organization

`archive.yml` is an optional UTF-8 YAML mapping directly under the archive root. It creates a virtual two-level collection/category hierarchy while all leaf chain directories remain flat. Missing `archive.yml` is valid and shows every valid chain as ungrouped.

<!-- contract-example:archive-manifest -->
```yaml
collections:
  - slug: insurance-records
    resourceId: 11111111-1111-4111-8111-111111111111
    title: Fictional Insurance Records
    description: Sanitized records grouped by subject.
    displayOrder: 10
    categories:
      - slug: property
        title: Property
        description: Fictional property correspondence and documents.
        displayOrder: 10
      - slug: vehicles
        title: Vehicles
        displayOrder: 20
```

The root mapping has one required `collections` array, which may be empty. Each collection has required `slug` and `title`, a stable `resourceId` required for new/shareable content, plus optional `description`, `displayOrder`, and `categories`. `categories` is an array of category mappings with the same editorial fields but no `resourceId`; categories cannot nest further.

| Field | Applies to | Required | Constraints and behavior |
| --- | --- | --- | --- |
| `resourceId` | Collection only | Required for new/shareable content; legacy omission is migration-compatible | UUID. Immutable authorization identity used by revocable share grants. Categories do not have resource IDs. |
| `slug` | Collection and category | Yes | Uses the chain-slug syntax and 1–120 character limit from Section 3. Collection slugs are unique archive-wide; category slugs are unique within their collection. |
| `title` | Collection and category | Yes | Nonblank trimmed string, 1–240 characters. |
| `description` | Collection and category | No | Nonblank trimmed string when supplied, 1–2,000 characters. |
| `displayOrder` | Collection and category | No | Any finite number. Items sort ascending; missing values sort last, then ties sort by title and slug. |
| `categories` | Collection only | No | Strict array of category mappings. Omission is equivalent to no categories. |

Unknown fields, duplicate slugs at the scopes above, invalid YAML, unsafe symbolic-link escape, a directory in place of the file, or any invalid nested item invalidates the entire organization manifest. It does **not** invalidate or hide valid chains: the application displays a safe archive-level diagnostic and shows all valid chains as ungrouped. Category slugs may repeat in different collections because category routes and references are scoped by collection.

Chains may belong directly to a collection or to a category inside that collection. An empty collection or category remains visible, which permits authors to establish the intended structure before adding content. The homepage links to `/collections/[collection]`; category cards link to `/collections/[collection]/[category]`; both ultimately link to the unchanged leaf route `/chains/[chain]`.

## 4. `chain.yml` contract

`chain.yml` is a UTF-8 YAML mapping located directly inside the chain directory.

<!-- contract-example:chain-manifest -->
```yaml
slug: insurance-emails
resourceId: 22222222-2222-4222-8222-222222222222
title: Fictional Insurance Correspondence
description: Sanitized correspondence used to demonstrate the archive format.
displayOrder: 10
collection: insurance-records
category: property
```

| Field | Type | Required | Purpose | Accepted format and default | Hard validation constraints | Recommended convention | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `resourceId` | UUID string | Required for new/shareable content; legacy omission is migration-compatible | Immutable chain identity for revocable share grants | Standard UUID; no generated default while parsing | When present it must be a valid UUID; sharing additionally requires it and archive-wide uniqueness | Generate once with the repository migration/import workflow; never edit or reuse it | `22222222-2222-4222-8222-222222222222` |
| `slug` | string | Yes | Stable chain identifier and route segment | Lowercase slug; no default | 1–120 characters; must match the slug pattern in Section 3 and the parent directory exactly | Keep stable after links are shared | `insurance-emails` |
| `title` | string | Yes | Human-readable chain name | YAML string; surrounding whitespace is trimmed | 1–240 characters after trimming; blank is rejected | Use a short descriptive title without private account numbers | `Fictional Insurance Correspondence` |
| `description` | string | No | Additional summary on the homepage and chain page | YAML string; omitted when not needed | 1–2,000 characters after trimming; blank is rejected | One or two plain-language sentences | `Sanitized correspondence…` |
| `displayOrder` | finite number | No | Primary homepage ordering key | Any finite YAML number; missing chains sort after chains that supply a value | `NaN` and infinities are rejected; integers, decimals, zero, and negative numbers are accepted | Use spaced integers such as `10`, `20`, `30` to permit insertion | `10` |
| `collection` | string slug | No | Assigns the chain to a collection declared in `archive.yml` | Lowercase slug; omission leaves the chain ungrouped | 1–120 characters and the slug pattern in Section 3 | Keep stable with the referenced collection slug | `insurance-records` |
| `category` | string slug | No | Assigns the chain to a category inside its collection | Lowercase slug; omission places the chain directly in its collection | Requires `collection`; 1–120 characters and the slug pattern in Section 3 | Copy the category slug exactly | `property` |

Unknown fields are rejected rather than stripped. For example, `sortOrder` is not supported. Missing or invalid `chain.yml`, invalid YAML, a blank required value, a category without a collection, or a slug/directory mismatch makes the chain invalid. Archive-wide discovery omits that chain and displays a safe warning; opening the chain directly displays a content error. A legacy manifest without `resourceId` remains readable during migration but cannot be shared. Run `pnpm archive:resource-ids --check --archive-root <path>` to audit and the separately authorized `--write` mode to assign missing IDs atomically per file. Existing valid IDs are preserved.

An unknown `collection` or `category` reference is handled differently because the leaf manifest itself is structurally valid: the chain remains visible in the ungrouped list and a safe diagnostic identifies the unresolved slug. Invalid organization metadata likewise never hides an otherwise valid chain.

The application reads the file as UTF-8 and has no encoding declaration or fallback. Author it as UTF-8. No field has a default except that omission of `description` and `displayOrder` means those values are absent.

Chains are sorted by ascending `displayOrder`; chains without one come afterward. Ties are resolved by title and then slug using the server's locale-aware string comparison.

## 5. Email Markdown filename contract

Files are discovered only when they are direct children of `emails/` and their names end in `.md`, case-insensitively. `.markdown`, `.txt`, and other extensions are not entries. A directory named with a `.md` suffix is not an entry.

Filenames do not supply the entry ID or date. Chronological order comes from validated frontmatter. Equal timestamps are ordered by `id`; the parser has a final filename tie-breaker, but duplicate IDs make a chain invalid, so filenames do not affect the order of a valid chain.

The filesystem requires filenames within one `emails/` directory to be unique. The application imposes no additional filename-length limit; the host filesystem does. Files beginning with a dot are **not** ignored if they end in `.md`, so `.draft.md` is discovered and must be valid. Avoid hidden entry files unless they are intentional.

Nested entry directories are not traversed. Entry-file symbolic links are considered, but a link that resolves outside the owning chain is rejected. Discovered entry filenames also pass single-segment path-safety decoding before they are read, so avoid backslashes, NUL/control characters, and percent-encoded names even when the host filesystem permits them.

Recommended filename form:

```text
YYYY-MM-DD_HHmm_short-description.md
```

The timestamp and wording are recommendations for human navigation only. Examples:

| Filename | Result |
| --- | --- |
| `2026-06-25_1044_estimate-sent.md` | Discovered; recommended form |
| `note.md` | Discovered; valid but less descriptive |
| `REPORT.MD` | Discovered because extension matching is case-insensitive |
| `.draft.md` | Discovered; valid but discouraged |
| `message.markdown` | Ignored |
| `message.txt` | Ignored |
| `2026/06/message.md` | Ignored because nested directories are not traversed |

Prefer conservative portable filename characters, keep names reasonably short, and avoid control characters. These are operational recommendations, not additional application validation rules.

## 6. Email Markdown file anatomy

The file starts with YAML frontmatter between `---` delimiters. Everything after the closing delimiter is the Markdown body.

<!-- contract-example:email-complete -->
```markdown
---
id: estimate-sent-2026-06-25
chain: insurance-emails
date: 2026-06-25T10:44:00-04:00
from: Fictional Estimator <estimator@example.test>
to:
  - Archive Owner <archive.owner@example.test>
  - Project Desk <project.desk@example.test>
cc:
  - Records Coordinator <records.coordinator@example.test>
subject: Fictional estimate sent for review
attachments:
  - title: Sanitized estimate
    file: attachments/2026-06-25_1044/estimate.pdf
    type: application/pdf
  - title: Exterior reference photograph
    file: attachments/2026-06-25_1044/exterior-photo.jpg
    type: image/jpeg
---

The fictional estimate is attached for review.

- Review the scope.
- Record any clarifications.

See the [fictional project notes](https://example.test/project-notes).

| Item | Status |
| --- | --- |
| Sample estimate | Ready |
| Example photograph | Attached |
```

A minimal valid entry may omit `cc`, `attachments`, and the body:

<!-- contract-example:email-minimal -->
```markdown
---
id: acknowledgement-2026-06-25
chain: insurance-emails
date: 2026-06-25T14:43:00Z
from: Archive Owner <archive.owner@example.test>
to:
  - Fictional Estimator <estimator@example.test>
subject: Fictional acknowledgement
---
```

The application reads entry files as UTF-8. It uses GitHub-flavored Markdown, including paragraphs, lists, links, emphasis, and tables. Use a blank line between paragraphs; a single newline normally remains part of the same Markdown paragraph. Raw HTML is skipped and is not rendered. Inline Markdown image syntax is replaced with an “Inline image omitted” note; store important images as attachments instead. An empty body is allowed.

There is no explicit application-level maximum for the body. The filesystem and available server memory impose practical limits because entry Markdown is read as text. Keep individual entries to a reviewable size.

## 7. Email frontmatter contract

| Field | Type | Required | Purpose | Accepted format and default | Hard validation constraints | Recommended convention | Example |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | string | Yes | Stable entry identity within one chain | Any nonblank YAML string; surrounding whitespace is trimmed | 1–160 characters; unique within the chain | Use a stable lowercase identifier tied to the source message, not only its subject | `estimate-sent-2026-06-25` |
| `chain` | string | Yes | Associates the entry with its containing chain | Chain slug | 1–120 characters; slug pattern from Section 3; must exactly match the containing chain directory | Copy the manifest slug exactly | `insurance-emails` |
| `date` | string | Yes | Chronology and displayed time | ISO 8601/RFC 3339 datetime with `Z` or an explicit numeric UTC offset | Timezone is mandatory; a local datetime without `Z` or offset is rejected | Preserve source timezone when known | `2026-06-25T10:44:00-04:00` |
| `from` | string | Yes | Sender display value | Any nonblank string; surrounding whitespace is trimmed | 1–500 characters | `Display Name <address@example.test>` when available | `Fictional Estimator <estimator@example.test>` |
| `to` | array of strings | Yes | Primary recipients | YAML sequence; no scalar shorthand | At least one item; every item is 1–500 characters after trimming | One recipient per YAML line | `[Archive Owner <archive.owner@example.test>]` |
| `cc` | array of strings | No | Carbon-copy recipients | YAML sequence; omitted by default; an empty sequence is accepted | Every supplied item is 1–500 characters after trimming | Omit instead of writing an empty list | `[Records Coordinator <records.coordinator@example.test>]` |
| `subject` | string | Yes | Entry heading | Any nonblank string; surrounding whitespace is trimmed | 1–1,000 characters | Preserve the source subject; keep generated document titles readable | `Fictional estimate sent for review` |
| `attachments` | array of attachment mappings | No | Associates files with this entry | YAML sequence; omitted becomes an empty array; an empty sequence is accepted | Every item must satisfy Section 8 | Omit when there are no attachments | See Section 8 |

`to` and `cc` must be YAML lists. A single string is not converted into a one-item list. `to: []` is invalid; `cc: []` is valid. IDs must be unique within a chain, but the same ID may appear in a different chain. Duplicate subjects are allowed.

Unknown frontmatter fields are rejected rather than stripped. Blank or whitespace-only values are rejected for `id`, `from`, recipient items, and `subject`. The limits above are the complete explicit application limits for those text fields; no separate address, display-name, or subject sub-limit is enforced.

The date field has no separate character-count limit; the ISO datetime validator defines the accepted shape. There is no explicit application-level maximum number of recipients or CC recipients, although every individual value has the 500-character limit shown above.

Malformed YAML, a missing required field, a timezone-free date, a chain mismatch, an unknown field, or any invalid nested attachment makes the entire chain fail. The application does not skip only the malformed entry and does not repair it. Archive discovery omits the affected chain with a visible warning; direct chain access displays the validation error.

## 8. Attachment metadata contract

Each item in `attachments` is a strict YAML mapping:

<!-- contract-example:attachment -->
```yaml
title: Sanitized estimate
file: attachments/2026-06-25_1044/estimate.pdf
type: application/pdf
```

| Field | Type | Required | Purpose | Accepted format | Hard validation | Example |
| --- | --- | --- | --- | --- | --- | --- |
| `title` | string | Yes | Human-readable attachment label | Any nonblank YAML string; surrounding whitespace is trimmed | 1–500 characters | `Sanitized estimate` |
| `file` | string | Yes | Locates the physical file within the owning chain | Forward-slash-separated chain-relative path | 1–1,024 characters; must pass Section 9 path validation | `attachments/2026-06-25_1044/estimate.pdf` |
| `type` | string | Yes | MIME hint for display and chain-page preview selection | MIME form `type/subtype`, optionally with parameters | 3–255 characters; must match the accepted MIME syntax | `application/pdf` |

Unknown attachment fields are rejected. `title` does not need to match the physical filename. A missing or syntactically invalid `type` invalidates the entry and therefore the chain. A syntactically valid but incorrect `type` is accepted as a hint rather than security authority. The file route derives its response MIME type and safe disposition from the resolved filename. The chain timeline uses the metadata hint to choose whether to offer an in-app preview, so an incorrect hint can produce confusing UI without weakening file-serving protections.

A missing referenced file, a directory where a file is expected, or an unsafe symbolic link invalidates the chain during normal discovery. Duplicate attachment references are not rejected: each reference remains associated with the entry containing it and is counted separately. Avoid accidental duplicates.

There is no explicit application-level maximum number of attachments per entry.

## 9. Attachment storage and path rules

The `file` value is relative to the **owning chain directory**. It is not relative to the archive root, the Markdown file, or necessarily the `attachments/` directory.

For this metadata:

```yaml
file: attachments/2026-06-25_1044/estimate.pdf
```

and chain `insurance-emails`, the physical file is:

```text
archive-root/insurance-emails/attachments/2026-06-25_1044/estimate.pdf
```

The application does not currently require paths to begin with `attachments/`, although using that directory is the canonical organization. Nested directories are permitted. Spaces and Unicode characters are accepted when the underlying filesystem supports them, and matching is case-sensitive on the application's Linux server.

Store ordinary filesystem-relative paths with `/` separators. Do not put URL-encoded paths in frontmatter; the URL builder encodes each segment for browser requests. Path validation defensively decodes percent sequences up to three times to reject encoded traversal. Some harmless encoded names may happen to resolve, but that behavior is not a canonical storage convention. Literal percent characters may also be rejected as malformed encoding, so avoid them in attachment path segments.

The following are enforced:

- the entire `file` string is 1–1,024 characters;
- it is not a POSIX or Windows absolute path;
- backslashes are rejected;
- each `/`-separated segment is nonempty and is not `.` or `..`;
- encoded or repeatedly encoded separators, dot segments, NUL bytes, and malformed percent encoding are rejected;
- the normalized path must remain inside the owning chain directory;
- the real path must also remain inside the chain, preventing symbolic-link escapes; and
- the final target must exist and be a regular file, not a directory.

Valid examples:

```text
attachments/estimate.pdf
attachments/2026-06-25_1044/exterior photo.jpg
attachments/参考/说明.txt
documents/example-note.txt
```

Rejected examples:

```text
/etc/passwd
C:\private\file.txt
../outside.pdf
attachments/../outside.pdf
attachments//estimate.pdf
attachments/./estimate.pdf
attachments/%2e%2e/outside.pdf
attachments/%252e%252e/outside.pdf
```

An attachment symlink whose target remains inside the same chain may resolve successfully. A symlink to another chain, a sibling directory, or anywhere outside the chain is rejected. If a file disappears between indexing and download, the request returns a safe not-found response without exposing server paths.

No application-specific limit is placed on an individual path segment beyond the 1,024-character total; operating-system filename limits still apply. Prefer portable filenames without control characters and with conservative segment lengths.

## 10. Attachment-directory naming convention

No naming convention below `attachments/` is enforced. A flat directory and nested organization are both valid within the path-safety rules.

Recommended organization:

```text
attachments/2026-06-25_1044/
```

Using the owning entry's recommended date/time filename prefix groups files with their source message, reduces filename collisions, and makes manual auditing easier. This convention is not used for sorting or association; frontmatter is authoritative.

Multiple emails may reference the same physical file, and every reference is displayed and counted. Reuse is acceptable for a genuinely shared original, but duplicating references merely to organize the file browser is discouraged.

## 11. Supported file behavior

Attachment support is broader than preview support: any existing regular file may be attached when `type` contains a syntactically valid MIME value and the path is safe. The route derives the actual response MIME type from the filename, applies `X-Content-Type-Options: nosniff`, and uses a private no-store response.

| Category | Expected MIME type | In-app preview | Route disposition without `?download=1` | Security and fallback behavior |
| --- | --- | --- | --- | --- |
| PDF | `application/pdf` | Native browser `<object>` | Inline | Browser-native rendering only; Download remains available |
| Raster images | `image/avif`, `image/gif`, `image/jpeg`, `image/png`, `image/webp` | Responsive native image | Inline | No custom gallery or decoder |
| SVG | `image/svg+xml` | No | Attachment | Active image content is not rendered on the application origin; Open causes safe download behavior |
| Plain text | `text/plain` | Fetched and rendered as wrapped text | Inline | Fetched through the protected route |
| Markdown | `text/markdown` | Fetched and rendered with the same safe Markdown renderer | Inline | GitHub-flavored Markdown; raw HTML skipped; inline images omitted |
| HTML | `text/html` | No | Attachment | Never rendered inline on the application origin |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | No | Attachment | Open/download original; no Office conversion |
| XLSX | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | No | Attachment | Open/download original; no spreadsheet renderer |
| Other Office files | Standard Word, Excel, PowerPoint, OpenDocument, or legacy Office MIME | No | Attachment | Open/download original |
| Unknown binary | Usually `application/octet-stream` | No | Attachment | Safe original download/open fallback |

Adding `?download=1` forces attachment disposition even for normally inline-safe types. Other raster formats may be categorized as images by MIME metadata but are not on the route's inline-safe list; they therefore fall back to attachment behavior.

## 12. Sorting and display behavior

Entries are sorted by parsed `date`, ascending. Equal instants are ordered by `id` using locale-aware comparison, then by source filename as a final deterministic fallback. Duplicate IDs are rejected, so the filename fallback does not normally decide order for valid content. Filename timestamps never override frontmatter.

Chains are ordered by ascending `displayOrder`. A chain without `displayOrder` sorts after every chain with one. Remaining ties use title, then slug.

The chain date range is the first and last entry after chronological sorting. A chain with no entries has no date range. Entry count is the number of valid discovered Markdown entries.

Attachment count is the number of frontmatter attachment references whose files resolve safely, not the number of unique physical files. Unreferenced files do not count. Repeated references count repeatedly. A missing or unsafe referenced file invalidates the chain, so the chain is omitted rather than shown with a reduced count.

The cross-chain file list is sorted by related entry date, then chain title, then attachment title. Within one chain's attachment enumeration, ties use attachment title and then chain-relative file path.

## 13. Invalid-content behavior

| Condition | Actual behavior |
| --- | --- |
| Missing `archive.yml` | Valid; all valid chains are displayed as ungrouped |
| Invalid `archive.yml`, duplicate organization slug, or unsafe root-manifest link | Collections are unavailable; every otherwise valid chain remains visible as ungrouped with a safe warning |
| Unknown collection or category reference | Referencing chain remains visible as ungrouped with a safe warning |
| Category supplied without a collection in `chain.yml` | Chain manifest is invalid |
| Missing `chain.yml` | Chain is invalid; omitted from homepage/files with a warning; direct chain view shows a content error |
| Invalid `chain.yml` or malformed YAML | Same invalid-chain behavior; no automatic repair |
| Directory slug mismatch | Manifest is invalid because `slug` must exactly match the directory |
| Missing `emails/` directory | Accepted as an empty chain with zero entries and attachments |
| Malformed email YAML | Entire chain is invalid and omitted with a warning; direct view shows an email validation error |
| Missing required email field | Entire chain is invalid |
| Invalid date | Entire chain is invalid |
| Date lacking timezone | Entire chain is invalid |
| Duplicate email ID within a chain | Entire chain is invalid; IDs may repeat across different chains |
| Missing attachment | Entire chain is invalid during discovery/enumeration |
| Unsafe attachment path | Rejected by schema or containment checks; entire chain is invalid |
| Unsupported file type | Accepted when the file exists and metadata MIME is syntactically valid; presented with safe open/download fallback |
| Unreadable manifest or email | Chain is omitted with a safe metadata/filesystem diagnostic; details are logged server-side |
| Attachment becomes unreadable or disappears at request time | File request returns a safe `404`; no absolute path is exposed |
| Extra unknown manifest, email, or attachment field | Rejected because all three schemas are strict; affected chain is invalid |

An absent archive root is an archive-level error rather than invalid chain content. A non-directory or unreadable archive root produces the archive-unavailable state.

Extra unreferenced files are ignored. An extra non-hidden directory at the archive root is treated as a chain candidate and can therefore produce a skipped-content warning if it lacks a valid manifest.

## 14. Conversion workflow from a PDF email export

This section summarizes the conversion contract. The intended operational
workflow is for a local coding agent to follow the bundled
[`import-email-export` skill](../.github/skills/import-email-export/SKILL.md).
See [Agent-assisted imports](agent-assisted-imports.md) for setup, input
preparation, prompts, review responsibilities, and privacy guidance.

1. Choose a stable valid chain slug using Section 3.
2. Create `archive-root/<slug>/`, then create `emails/` and the recommended `attachments/` directory.
3. Create `chain.yml` with the same slug and a descriptive title.
4. Identify each distinct message or document in the PDF or text export.
5. Extract the sender, recipients, optional CC, subject, date, and readable body for each message.
6. Normalize every timestamp to ISO 8601 with an explicit `Z` or numeric UTC offset. If the source timezone is unknown, investigate the source context; do not invent an offset silently. Record any unavoidable assumption outside the archive or plainly in the body.
7. Assign a stable ID unique within the chain. Duplicate subjects do not require duplicate IDs; include a date, message identifier, or sequence in the ID.
8. Create one direct `.md` file in `emails/` for each message, using the recommended filename convention.
9. Extract available attachments as their original files. Do not create placeholder files with misleading extensions.
10. Place attachments below the owning chain, preferably in a directory named for the owning entry, such as `attachments/2026-06-25_1044/`.
11. Add `title`, chain-relative `file`, and accurate MIME `type` metadata to the owning entry.
12. Check the frontmatter dates and confirm the resulting oldest-to-newest order. Filenames do not correct an inaccurate date.
13. Point `ARCHIVE_DATA_DIR` at the archive root, start the application, and refresh the homepage, chain view, and file browser.
14. Resolve every skipped-content warning, validation error, and missing-file result before treating the conversion as complete.

Conversion guidance for common export artifacts:

- **Repeated quoted history:** Prefer one clean body per distinct message. Remove repeated earlier-message quotations when those messages are already separate entries, unless the quotation itself is evidentiary context.
- **Forwarded messages:** Represent a forwarded message as a separate entry when its sender/date/body can be identified reliably. Otherwise preserve it as readable quoted content in the forwarding entry.
- **Missing timezone:** Do not use a timezone-free value. Determine the offset from export metadata, message headers, or known source context. If it cannot be determined, pause and record the unresolved source-data issue rather than fabricating precision.
- **Duplicate subjects:** Keep the original subjects; use unique IDs and filenames.
- **Inline images:** Extract important images as ordinary attachments and reference them in frontmatter. Markdown image embedding is intentionally omitted by the renderer.
- **Unavailable attachments:** Do not add a frontmatter reference until the original file is available. A listed-but-missing attachment invalidates the chain. A body note may record that the export mentioned an unavailable file.
- **HTML email:** Convert the readable content to Markdown or plain text. Do not paste active HTML expecting it to render; raw HTML is skipped.
- **OCR/PDF artifacts:** Correct obvious character recognition errors only when the intended text is clear. Preserve meaningful uncertainty and do not silently invent missing content.
- **Page headers and footers:** Remove repeated PDF page numbers, export timestamps, legal footers, and headers that are not part of the message body.

This is a local, agent-guided preparation workflow, not an application
importer. The running application does not perform PDF extraction, OCR,
message splitting, metadata inference, or archive writes.

## 15. Copyable templates

### Recommended directory tree

<!-- contract-example:template-tree -->
```text
archive-root/
├── archive.yml
└── example-chain/
    ├── chain.yml
    ├── emails/
    │   ├── 2026-01-15_0900_example-message.md
    │   └── 2026-01-15_1030_example-with-attachments.md
    └── attachments/
        └── 2026-01-15_1030/
            ├── example-note.txt
            └── example-details.md
```

### Optional `archive.yml`

```yaml
collections:
  - slug: example-records
    resourceId: 44444444-4444-4444-8444-444444444444
    title: Example Records
    description: Optional virtual organization for the flat example chain.
    displayOrder: 10
    categories:
      - slug: correspondence
        title: Correspondence
        displayOrder: 10
```

### `chain.yml`

<!-- contract-example:template-chain-manifest -->
```yaml
slug: example-chain
resourceId: 55555555-5555-4555-8555-555555555555
title: Fictional Example Chain
description: Copyable sanitized template content with no private records.
displayOrder: 100
collection: example-records
category: correspondence
```

### Minimal email with no attachment

<!-- contract-example:template-email-minimal -->
```markdown
---
id: example-message
chain: example-chain
date: 2026-01-15T09:00:00Z
from: Example Sender <sender@example.test>
to:
  - Example Recipient <recipient@example.test>
subject: Fictional example message
---

This is sanitized template content.
```

### Email with CC and multiple attachments

<!-- contract-example:template-email-attachments -->
```markdown
---
id: example-with-attachments
chain: example-chain
date: 2026-01-15T10:30:00+00:00
from: Example Recipient <recipient@example.test>
to:
  - Example Sender <sender@example.test>
  - Example Records Desk <records@example.test>
cc:
  - Example Observer <observer@example.test>
subject: Fictional example with sanitized attachments
attachments:
  - title: Example plain-text note
    file: attachments/2026-01-15_1030/example-note.txt
    type: text/plain
  - title: Example Markdown details
    file: attachments/2026-01-15_1030/example-details.md
    type: text/markdown
---

The sanitized example attachments are ready for review.

- The text file demonstrates a plain-text preview.
- The Markdown file demonstrates safe formatted content.
```

The same complete template is committed under `examples/archive-template/` and is intended for copying, not as private runtime data.

## 16. Validation checklist

- [ ] The chain slug uses only lowercase letters, digits, and single internal hyphens and is at most 120 characters.
- [ ] If `archive.yml` is present, its collection slugs are unique and each category slug is unique within its collection.
- [ ] Every new chain and collection has a unique generated `resourceId`; existing IDs were preserved unchanged.
- [ ] `chain.yml` exists, contains only supported fields, and its slug exactly matches its directory.
- [ ] Every `collection`/`category` reference exactly matches `archive.yml`, and no `category` appears without `collection`.
- [ ] Each entry is a direct `.md` file in `emails/` with every required frontmatter field.
- [ ] Every date contains `Z` or an explicit UTC offset.
- [ ] Entry IDs are unique within the chain.
- [ ] `to` and any `cc` value are YAML lists.
- [ ] Attachment paths are ordinary chain-relative paths using `/` and pass the path-safety rules.
- [ ] Every referenced attachment exists as a regular file inside the owning chain.
- [ ] Attachment MIME hints are accurate even though response security derives type from the filename.
- [ ] No private archive file is placed in `public/` or committed as an example.
- [ ] Markdown contains no unintended OCR artifacts, repeated page headers, or export footers.
- [ ] The chain renders in the intended chronological order.
- [ ] Each attachment's preview, open, and download behavior is appropriate for its actual type.
