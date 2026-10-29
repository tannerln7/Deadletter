"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

type ShareControlsProps = { initialActive: boolean; initialGrantId?: string; resourceId: string; resourceKind: "chain" | "collection" };
type MutationResult = { active?: boolean; grantId?: string; shareUrl?: string; error?: string };

const triggerClass = "min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
const primaryClass = "min-h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] outline-none hover:bg-[var(--accent-hover)] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--modal-overlay)] p-4">{children}</div>;
}

export default function ShareControls({ initialActive, initialGrantId, resourceId, resourceKind }: ShareControlsProps) {
  const [active, setActive] = useState(initialActive);
  const [grantId, setGrantId] = useState(initialGrantId);
  const [shareUrl, setShareUrl] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function mutate(path: string, body: unknown, action: "create" | "regenerate" | "revoke") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Archive-Request": "share-management" }, body: JSON.stringify(body), cache: "no-store" });
      const result = await response.json() as MutationResult;
      if (!response.ok) throw new Error(result.error ?? "Sharing request failed.");
      setActive(Boolean(result.active)); setGrantId(result.grantId); setShareUrl(result.shareUrl);
      if (action === "revoke") setMessage("Share revoked.");
      else { setDialogOpen(true); setMessage(""); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sharing request failed."); }
    finally { setBusy(false); }
  }

  return <div className="mt-5 flex flex-wrap items-center gap-2">
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]" : "bg-[var(--surface-subtle)] text-[var(--muted)]"}`}>{active ? "Shared" : "Private"}</span>
    <Dialog.Root open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setShareUrl(undefined); setMessage(""); } }}>
      {!active ? <Dialog.Trigger asChild><button type="button" className={triggerClass}>Share</button></Dialog.Trigger> : null}
      <Dialog.Portal><Dialog.Overlay asChild><Overlay><Dialog.Content className="w-full max-w-lg rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-5 shadow-[var(--modal-shadow)]">
        <div className="flex items-start justify-between gap-3"><Dialog.Title className="text-lg font-semibold">{shareUrl ? "Share link created" : "Create public link?"}</Dialog.Title><Dialog.Close asChild><button type="button" className="min-h-11 rounded-md px-3 text-sm font-semibold">Close</button></Dialog.Close></div>
        <Dialog.Description className="mt-4 text-sm leading-6 text-[var(--muted)]">{shareUrl ? "Copy this URL now. Its secret cannot be displayed again." : "Anyone possessing the generated URL can view this live resource."}</Dialog.Description>
        {shareUrl ? <><input aria-label="Share URL" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-3 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface-subtle)] p-3 text-sm" /><button type="button" className={`${primaryClass} mt-3`} onClick={async () => { await navigator.clipboard.writeText(shareUrl); setMessage("Link copied."); }}>Copy link</button></> : <div className="mt-5 flex justify-end gap-2"><Dialog.Close asChild><button type="button" className="min-h-11 rounded-md px-4 text-sm font-semibold">Cancel</button></Dialog.Close><button type="button" disabled={busy} className={primaryClass} onClick={() => mutate("/api/shares", { resourceKind, resourceId }, "create")}>{busy ? "Working…" : "Create link"}</button></div>}
        {message ? <p aria-live="polite" className="mt-3 text-sm text-[var(--muted)]">{message}</p> : null}
      </Dialog.Content></Overlay></Dialog.Overlay></Dialog.Portal>
    </Dialog.Root>
    {active && grantId ? <>
      <AlertDialog.Root><AlertDialog.Trigger asChild><button type="button" className={triggerClass}>Regenerate</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay asChild><Overlay><AlertDialog.Content className="w-full max-w-lg rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-5 shadow-[var(--modal-shadow)]"><AlertDialog.Title className="text-lg font-semibold">Regenerate public link?</AlertDialog.Title><AlertDialog.Description className="mt-4 text-sm leading-6 text-[var(--muted)]">The previous URL will stop working immediately.</AlertDialog.Description><div className="mt-5 flex justify-end gap-2"><AlertDialog.Cancel asChild><button type="button" className="min-h-11 rounded-md px-4 text-sm font-semibold">Cancel</button></AlertDialog.Cancel><AlertDialog.Action asChild><button type="button" disabled={busy} className={primaryClass} onClick={() => mutate(`/api/shares/${grantId}/regenerate`, {}, "regenerate")}>Regenerate</button></AlertDialog.Action></div></AlertDialog.Content></Overlay></AlertDialog.Overlay></AlertDialog.Portal></AlertDialog.Root>
      <AlertDialog.Root><AlertDialog.Trigger asChild><button type="button" className={`${triggerClass} text-[var(--danger)]`}>Revoke</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay asChild><Overlay><AlertDialog.Content className="w-full max-w-lg rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] p-5 shadow-[var(--modal-shadow)]"><AlertDialog.Title className="text-lg font-semibold">Revoke public link?</AlertDialog.Title><AlertDialog.Description className="mt-4 text-sm leading-6 text-[var(--muted)]">This permanently disables the current link. Sharing again creates a new grant.</AlertDialog.Description><div className="mt-5 flex justify-end gap-2"><AlertDialog.Cancel asChild><button type="button" className="min-h-11 rounded-md px-4 text-sm font-semibold">Cancel</button></AlertDialog.Cancel><AlertDialog.Action asChild><button type="button" disabled={busy} className={primaryClass} onClick={() => mutate(`/api/shares/${grantId}/revoke`, {}, "revoke")}>Revoke</button></AlertDialog.Action></div></AlertDialog.Content></Overlay></AlertDialog.Overlay></AlertDialog.Portal></AlertDialog.Root>
    </> : null}
    {!dialogOpen && message ? <p aria-live="polite" className="w-full text-sm text-[var(--muted)]">{message}</p> : null}
  </div>;
}
