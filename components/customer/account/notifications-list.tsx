"use client";

import { useState, useTransition } from "react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/account";
import type { MyNotification } from "@/lib/queries/account";

export function NotificationsList({ notifications }: { notifications: MyNotification[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const unread = notifications.filter(n => !n.is_read).length;

  const markOne = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const res = await markNotificationRead(fd);
      if (res?.error) setError(res.error);
    });
  };
  const markAll = () =>
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (res?.error) setError(res.error);
    });

  if (notifications.length === 0) {
    return <p className="text-sm text-text-muted-wabs">You&apos;re all caught up — no notifications.</p>;
  }

  return (
    <div className="space-y-3" data-testid="notifications-list">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-muted-wabs">{unread} unread</p>
        {unread > 0 && (
          <button type="button" onClick={markAll} disabled={isPending} className="text-sm text-gold hover:underline">
            Mark all as read
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {notifications.map(n => (
          <li key={n.id} className={`px-4 py-3 flex gap-4 justify-between ${n.is_read ? "" : "bg-gold/5"}`}>
            <div>
              <p className={`text-sm text-navy ${n.is_read ? "" : "font-semibold"}`}>{n.title}</p>
              {n.body && <p className="text-sm text-text-muted-wabs mt-0.5">{n.body}</p>}
              <p className="text-xs text-text-muted-wabs mt-1">{n.created_at.slice(0, 16).replace("T", " ")}</p>
            </div>
            {!n.is_read && (
              <button type="button" onClick={() => markOne(n.id)} disabled={isPending} className="text-xs text-gold hover:underline shrink-0 self-start">
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
