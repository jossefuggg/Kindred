import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, MapPin, MessagesSquare, Pin, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspacePage } from "@/components/layout/page";
import { Empty } from "@/components/layout/blocks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftQuery } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { shiftWhen, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shift/$id/chat")({
  head: () => ({ meta: [{ title: "Shift chat · Kindred" }, { name: "description", content: "Group chat for everyone on this shift." }] }),
  component: Chat,
});

type Msg = { id: string; user_id: string | null; author_name: string; body: string; pinned: boolean; created_at: string };

function Chat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const shift = useQuery(shiftQuery(id));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const msgs = useQuery({
    queryKey: ["chat", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("*").eq("shift_id", id).order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `shift_id=eq.${id}` }, (p) => {
        qc.setQueryData<Msg[]>(["chat", id], (old) => (old?.some((m) => m.id === (p.new as Msg).id) ? old : [...(old ?? []), p.new as Msg]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [msgs.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const { error } = await supabase.rpc("send_chat", { _shift: id, _body: body.slice(0, 1000) });
    setSending(false);
    if (error) return void toast.error(error.message.startsWith("Slow down") ? error.message : "Message not sent. Try again.");
    setText("");
    qc.invalidateQueries({ queryKey: ["chat", id] });
  }

  const pinned = (msgs.data ?? []).filter((m) => m.pinned);
  const list = (msgs.data ?? []).filter((m) => !m.pinned);
  const s = shift.data;

  const details = s && (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="font-display text-lg font-semibold text-text">{s.title}</p>
      <p className="flex items-center gap-2 text-sm text-text-2"><Clock className="size-4" /> {shiftWhen(s.starts_at, Number(s.duration_hours))}</p>
      <p className="flex items-center gap-2 text-sm text-text-2"><MapPin className="size-4" /> {s.address}, {s.city}</p>
      <Link to="/shift/$id" params={{ id }} className="text-sm font-semibold text-brand hover:underline">Shift details</Link>
    </div>
  );

  return (
    <WorkspacePage
      left={
        <div className="flex flex-col gap-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-text-2 hover:text-text"><ArrowLeft className="size-4" /> Dashboard</Link>
          {details}
        </div>
      }
      right={
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-text"><Pin className="size-4 text-brand" /> Pinned logistics</p>
          {pinned.length ? pinned.map((m) => <p key={m.id} className="text-sm text-text-2">{m.body}</p>) : <p className="text-sm text-text-3">Nothing pinned yet.</p>}
        </div>
      }
    >
      <div className="flex h-[calc(100dvh-10rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm md:h-[calc(100dvh-7rem)]">
        <div className="border-b border-border px-5 py-4">
          <p className="font-display text-lg font-semibold text-text">{s?.title ?? "Shift chat"}</p>
          <p className="text-xs text-text-3">Everyone booked + the coordinator</p>
          {pinned[0] && <p className="mt-2 flex items-start gap-2 rounded-lg bg-brand-soft p-2 text-xs text-text lg:hidden"><Pin className="mt-0.5 size-3 shrink-0" /> {pinned[0].body}</p>}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.isLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : msgs.error ? (
            <Empty icon={MessagesSquare} title="Chat not found" body="Book this shift to join its chat." action={<Button asChild><Link to="/shift/$id" params={{ id }}>View shift</Link></Button>} />
          ) : list.length === 0 ? (
            <Empty icon={MessagesSquare} title="No messages yet" body="Say hello to the team." />
          ) : (
            list.map((m) => {
              const mine = m.user_id === user?.id;
              const org = m.user_id === null && m.author_name === s?.charities?.name;
              return (
                <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", org ? "bg-forest text-on-brand" : "bg-brand-soft text-brand")}>
                    {initials(m.author_name || "?")}
                  </span>
                  <div className={cn("max-w-[75%]", mine && "text-right")}>
                    <p className="text-xs text-text-3">{m.user_id ? <Link to="/v/$id" params={{ id: m.user_id }} className="hover:text-brand">{m.author_name}</Link> : m.author_name}{org && <span className="ml-1 rounded-full bg-sage-soft px-2 py-0.5 font-semibold text-forest">Coordinator</span>}</p>
                    <p className={cn("mt-1 inline-block rounded-2xl px-4 py-2 text-left text-sm", mine ? "bg-brand text-on-brand" : "bg-surface-2 text-text")}>{m.body}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottom} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Message the team" aria-label="Message" />
          <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Send"><Send /></Button>
        </form>
      </div>
    </WorkspacePage>
  );
}
