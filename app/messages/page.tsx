import Link from "next/link";
import { Megaphone, MessageSquare, Send, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requirePagePermission } from "@/lib/auth";
import { permissions, roleNames } from "@/lib/constants";
import { DeckCard } from "@/components/command-deck";
import { MarkThreadRead } from "@/components/mark-thread-read";
import { sendMessageAction } from "@/lib/actions";
import { listBroadcastMessages, listDirectMessages, listUsers } from "@/lib/data";
import { dateTimeShort } from "@/lib/format";
import { clsx } from "clsx";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission(permissions.dashboard);
  const params = (await searchParams) ?? {};
  const to = typeof params.to === "string" ? params.to : null;

  const [users, directMessages, broadcasts] = await Promise.all([listUsers(), listDirectMessages(user.id), listBroadcastMessages()]);
  const others = users.filter((candidate) => candidate.id !== user.id);

  const summaries = others
    .map((other) => {
      const thread = directMessages.filter((message) => (message.sender_id === user.id && message.recipient_id === other.id) || (message.sender_id === other.id && message.recipient_id === user.id));
      const last = thread[thread.length - 1] ?? null;
      const unread = thread.filter((message) => message.recipient_id === user.id && !message.read_at).length;
      return { other, last, unread };
    })
    .sort((a, b) => (b.last ? new Date(b.last.created_at).getTime() : 0) - (a.last ? new Date(a.last.created_at).getTime() : 0));

  const selected = to ?? (summaries.find((summary) => summary.last)?.other.id ?? (broadcasts.length ? "broadcast" : others[0]?.id ?? "broadcast"));
  const isBroadcast = selected === "broadcast";
  const selectedUser = isBroadcast ? null : others.find((other) => other.id === selected) ?? null;
  const thread = isBroadcast
    ? broadcasts
    : directMessages.filter((message) => (message.sender_id === user.id && message.recipient_id === selectedUser?.id) || (message.sender_id === selectedUser?.id && message.recipient_id === user.id));
  const selectedUnread = !isBroadcast && selectedUser ? thread.filter((message) => message.recipient_id === user.id && !message.read_at).length : 0;

  return (
    <AppShell>
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-accent-cyan">Comms</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-deck-text">Messages</h1>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Conversation list */}
        <DeckCard padding="p-0" className="flex h-full flex-col" glow={false}>
          <div className="shrink-0 border-b border-hairline px-4 py-3">
            <p className="font-display text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-deck-text">Conversations</p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <Link href="/messages?to=broadcast" className={clsx("flex items-center gap-3 border-b border-hairline px-4 py-3 transition", isBroadcast ? "bg-accent-cyan/[0.06]" : "hover:bg-white/[0.02]")}>
              <span className="grid size-9 place-items-center rounded-lg border border-accent-copper/30 bg-accent-copper/10 text-accent-copper"><Megaphone className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-deck-text">Team broadcast</p>
                <p className="truncate text-xs text-deck-muted">{broadcasts.length ? broadcasts[broadcasts.length - 1].body : "Company-wide announcements"}</p>
              </div>
            </Link>

            {summaries.length ? summaries.map(({ other, last, unread }) => (
              <Link key={other.id} href={`/messages?to=${other.id}`} className={clsx("flex items-center gap-3 border-b border-hairline px-4 py-3 transition", selected === other.id ? "bg-accent-cyan/[0.06]" : "hover:bg-white/[0.02]")}>
                <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-accent-copper to-accent-cyan font-mono text-xs font-bold text-deck-bg">{initials(other.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-deck-text">{other.name}</p>
                  <p className="truncate text-xs text-deck-muted">{last ? last.body : (other.role?.name ?? "No messages yet")}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {last ? <span className="font-mono text-[0.6rem] text-deck-muted">{dateTimeShort(last.created_at)}</span> : null}
                  {unread ? <span className="grid min-w-[1.1rem] place-items-center rounded-full bg-accent-cyan px-1 font-mono text-[0.6rem] font-bold text-deck-bg">{unread}</span> : null}
                </div>
              </Link>
            )) : <p className="px-4 py-8 text-center text-sm text-deck-muted">No teammates to message yet.</p>}
          </div>
        </DeckCard>

        {/* Thread */}
        <DeckCard padding="p-0" className="flex h-full min-h-0 flex-col" glow={false}>
          <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-3">
            <span className={clsx("grid size-9 place-items-center rounded-lg", isBroadcast ? "border border-accent-copper/30 bg-accent-copper/10 text-accent-copper" : "bg-gradient-to-br from-accent-copper to-accent-cyan font-mono text-xs font-bold text-deck-bg")}>
              {isBroadcast ? <Megaphone className="size-4" /> : initials(selectedUser?.name ?? "?")}
            </span>
            <div>
              <p className="text-sm font-semibold text-deck-text">{isBroadcast ? "Team broadcast" : selectedUser?.name ?? "Select a conversation"}</p>
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-deck-muted">{isBroadcast ? "Everyone" : selectedUser?.role?.name ?? ""}</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-auto px-5 py-4">
            {/* column-reverse keeps the latest message in view; iterate newest-first */}
            {thread.length ? [...thread].reverse().map((message) => {
              const mine = message.sender_id === user.id;
              const senderName = message.sender?.name ?? users.find((candidate) => candidate.id === message.sender_id)?.name ?? "Unknown";
              return (
                <div key={message.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={clsx("max-w-[78%] rounded-xl px-3 py-2 text-sm", mine ? "bg-accent-cyan/15 text-deck-text" : "bg-white/[0.04] text-deck-text")}>
                    {!mine ? <p className="mb-0.5 font-mono text-[0.65rem] text-accent-copper">{senderName}</p> : null}
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <p className="mt-1 text-right font-mono text-[0.6rem] text-deck-muted">{dateTimeShort(message.created_at)}</p>
                  </div>
                </div>
              );
            }) : <div className="flex flex-1 items-center justify-center text-sm text-deck-muted"><div className="text-center"><MessageSquare className="mx-auto mb-2 size-6 opacity-50" />No messages yet — say hello.</div></div>}
          </div>

          {(isBroadcast || selectedUser) ? (
            <form action={sendMessageAction} className="shrink-0 border-t border-hairline p-3">
              <input type="hidden" name="audience" value={isBroadcast ? "BROADCAST" : "DIRECT"} />
              {isBroadcast ? null : <input type="hidden" name="recipientId" value={selectedUser?.id ?? ""} />}
              {isBroadcast ? (
                <div className="mb-2 flex items-center gap-2 text-xs text-deck-muted">
                  <Users className="size-3.5" />
                  <span>Send to</span>
                  <select name="broadcastRole" defaultValue="" className="rounded-md border border-hairline bg-white/[0.03] px-2 py-1 font-mono text-xs text-deck-text outline-none focus:border-accent-cyan">
                    <option value="" className="bg-deck-panel">Everyone</option>
                    {roleNames.map((role) => <option key={role} value={role} className="bg-deck-panel">{role}</option>)}
                  </select>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea name="body" required rows={2} placeholder={isBroadcast ? "Write an announcement…" : `Message ${selectedUser?.name ?? ""}…`} className="flex-1 resize-none rounded-lg border border-hairline bg-deck-bg/60 px-3 py-2 text-sm text-deck-text outline-none transition placeholder:text-deck-muted focus:border-accent-cyan" />
                <button type="submit" className="flex items-center gap-2 rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-deck-bg transition hover:brightness-110">
                  <Send className="size-4" /> Send
                </button>
              </div>
            </form>
          ) : null}
        </DeckCard>
      </div>

        {!isBroadcast && selectedUser ? <MarkThreadRead to={selectedUser.id} enabled={selectedUnread > 0} /> : null}
      </div>
    </AppShell>
  );
}
