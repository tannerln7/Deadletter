---
name: import-email-export
description: Extract and normalize messy PDF or text email exports into the archive's canonical chain, Markdown, and attachment structure. Use when importing correspondence into this repository.
argument-hint: "[source path] [chain slug or title] [optional archive root]"
user-invocable: true
disable-model-invocation: false
---

# Import an Email Export

Convert exports into Deadletter content. Preserve evidence; normalize
structure, not meaning.

Read [Archive Content Format Specification](../../../docs/archive-content-format.md)
first. It is canonical for syntax, schemas, limits, dates, attachments, paths,
failures, and file handling. If it appears inconsistent with code, inspect
`lib/server/schemas.ts` and the `chains.ts`, `emails.ts`, `files.ts`, and
`path-safety.ts` modules beside it, plus related tests. Do not guess or invent
fields, limits, or behavior.

## 1. Establish input and destination

1. Resolve all export and original attachment paths.
2. Determine title, new/existing chain, slug, archive root, and whether the
   sources represent one chain or several.
3. Apply `ARCHIVE_DATA_DIR` semantics from the specification; do not assume the
   default root when an override is supplied.
4. Determine attachment availability and authority to extend or replace files.
5. Obtain an approved default timezone for timestamps without offsets. Never
   infer it silently from the server or guess daylight-saving behavior.
6. Inspect the target archive before writing.

For an existing chain, read `chain.yml`, IDs, filenames, and likely overlaps.
Preserve its stable `resourceId`, valid content, and identifiers; never silently
replace or renumber entries. For a new chain, select a valid slug, generate its
stable UUID `resourceId` once, and create only required structure. Never reuse
or regenerate a resource ID. Present an
ambiguous title or slug before writing.

## 2. Preserve and inspect the source

- Keep sources read-only; never edit, rename, or overwrite them.
- Work in a separate temporary directory outside the archive. Keep OCR text,
  page images, logs, and other intermediates out of final content.
- Record source file and page, bookmark, or section per candidate when practical.
- Process private content locally by default. Never send documents, bodies,
  addresses, attachments, claim data, or credentials to an external service
  without explicit authorization for that disclosure.

## 3. Extract source content

For PDFs:

1. Check for a usable embedded text layer and prefer direct extraction when its
   reading order is reliable.
2. Use OCR only for pages or documents lacking usable text.
3. When extraction is ambiguous, inspect only the affected rendered pages and
   verify consequential names, addresses, dates, identifiers, filenames,
   amounts, punctuation, and digits against the source.

For text or Markdown, preserve source encoding, detect repeated headers, and
distinguish visual wraps from real breaks. Do not blindly join lists, addresses,
signatures, or quotations.

For overlapping sources, build one inventory, track support, and prefer the
clearest copy. Do not duplicate a message found in several exports. Use local
document conversion when helpful, but keep archive decisions here.

## 4. Identify individual messages

Prefer complete `From`/`Sent` or `Date`/`To`/`CC`/`Subject` blocks, Message-ID,
explicit separators, repeated mail-client headers, forwarded-message headers,
and export indexes or bookmarks. Never rely on page boundaries alone.

When uncertain, preserve the section and competing interpretations. Avoid
speculative entries; ask if the choice affects chronology, authorship, or
attachment ownership.

## 5. Normalize metadata and body

Collect stable ID, chain, timestamp, sender, ordered recipients and CC, subject,
attachments, and Markdown body. Follow the specification's field contract.

- Preserve legible names and addresses; never invent missing addresses.
- Use recipient lists required by the schema.
- Normalize dates to accepted ISO 8601 with `Z` or an explicit approved offset;
  never silently guess a timezone.
- Preserve subjects except for proven extraction whitespace. Do not merge by
  subject or misrepresent forwarded content.
- Search other source sections for missing metadata. Stop and ask when a
  required value cannot be satisfied truthfully.

When no stable ID or filename exists, derive it from normalized time and a short
lowercase subject slug. Default to
`YYYY-MM-DD-HHmm-subject-slug` for ID and
`YYYY-MM-DD_HHmm_subject-slug.md` for filename. Check existing and planned
collisions. Prefer a stable source Message-ID fragment as a suffix; otherwise
assign `-2`, `-3`, and later suffixes in deterministic source-location order.
Never renumber unrelated existing entries.

Clean without rewriting: remove proven page/export artifacts, repair page-break
hyphenation, join visual wraps, normalize accidental whitespace, and restore
obvious lists or tables. Never paraphrase, correct grammar or tone, rewrite
signatures, remove disclaimers merely for repetition, or invent obscured text.
Use a marked transcription note only with approval.

## 6. Remove duplication without losing evidence

Compare Message-ID, timestamp, sender, recipients, subject, normalized body, and
attachment names. Never deduplicate by subject alone.

For quoted history, create one entry per supported message. Remove a later
quotation only when it is identical, represented separately, and has no unique
annotation or inline reply. Preserve interleaved replies and substantive forwards.

Skip and report exact matches. Treat one ID with different content as a conflict;
propose a deterministic ID or ask. Show differences before an authorized update.
Preserve and report possible duplication when uncertain.

## 7. Associate attachments

Inventory owner, source, original/archive names, MIME, destination, and bytes.

- Preserve original bytes and meaningful extensions. Sanitize filenames only
  for safe filesystem use and record any source-to-archive rename.
- Use ordinary unencoded chain-relative paths and current path-safety rules.
  Reject absolute paths, traversal, directories, and unsafe symbolic links.
- Never place archive content in `public/`.
- Never invent or create empty PDF, image, DOCX, XLSX, or other attachment files.
- If mentioned but unavailable, omit its reference, preserve useful body context,
  and report the missing file and owner.
- Verify an extracted embedded file's signature or ability to open before use.

## 8. Plan the output tree

For a nontrivial import, review an ephemeral plan: target; source, candidate, and
duplicate counts; IDs, filenames, and attachment destinations; missing data;
ambiguous boundaries; and existing overlaps.

Proceed directly for a small unambiguous import after checking the same facts
internally. Stop for a decision before destructive collisions, unresolved
required fields, ambiguous ownership, or unapproved replacement.

## 9. Write archive files

Create or update `chain.yml` and required directories per the specification.
Write one UTF-8 Markdown file per normalized message with valid YAML frontmatter;
quote values when YAML could reinterpret them. Copy each verified attachment to
its destination and reference it only from its owning message.

Avoid unrelated or temporary files. Stage and validate outside the final tree
for large, overlapping, collision-prone, existing-chain, or uncertain OCR work.

Make imports idempotent: compare planned entries with existing content, skip
exact matches, and never overwrite conflicts silently.

## 10. Validate the result

Use current schemas, parsers, tests, and repository commands—not a parallel
validator. Verify:

- archive-root resolution, chain discovery, valid manifest, and exact slug match;
- valid frontmatter, explicit timezones, unique IDs, and expected chronology;
- safe paths, regular attachments, reasonable MIME behavior, and no dangling
  references;
- no archive content in `public/` and no extraction artifacts in the archive;
- discovery without invalid-content warnings; and
- attachment preview/download links resolve when targeted verification is
  needed to investigate an error.

Validate large staging trees with focused parsers first. Run applicable canonical
checks, including `pnpm validate` when tracked content changes. Do not require a
representative visual comparison or routine browser review for an import. After
technical validation, ask the requester to perform the final content and visual
verification in the application.

## 11. Report completion and uncertainty

Report sources; root and chain; chain creation/extension; messages created,
skipped, or authorized updates; attachments copied/missing; ambiguities; approved
timezone; changed files; validation; and intentionally preserved artifacts.
State that final content verification is ready for the requester.

Avoid full private bodies and unnecessary personal details. Distinguish
confirmed source data, deterministic normalization, approved inference, and
unresolved ambiguity.

Before declaring uncertainty, check other pages or exports, repeated thread
copies, attachment metadata, bookmarks, and approved defaults. Never silently
invent dates, timezones, participants, subjects, filenames, body text, or message
boundaries. Stop and ask when required evidence remains unresolved.

Keep this workflow limited to converting existing exports. Do not modify the UI
or schema, build import/OCR services, databases, upload/edit features,
authentication, search, or a general email client, or commit or push.
