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
