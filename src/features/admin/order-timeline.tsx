"use client";

import {
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  MapPin,
  ShoppingBag,
  StickyNote,
  Truck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { date, timelineLabels } from "./format";
import type { OrderTimelineEntry, TimelineKind } from "@/lib/api/types";

const icons: Record<TimelineKind, LucideIcon> = {
  created: ShoppingBag,
  slip_uploaded: Upload,
  slip_rejected: CircleX,
  paid: CircleCheck,
  cancelled: Ban,
  expired: Clock,
  tracking_set: Truck,
  address_updated: MapPin,
  note: StickyNote,
};

/** Read-only order history, oldest first (the API always sends at least the `created` entry). */
export function OrderTimeline({ entries }: { entries: OrderTimelineEntry[] }) {
  return (
    <section className="order-section" aria-labelledby="order-timeline-title">
      <h3 id="order-timeline-title">ประวัติของออเดอร์</h3>
      <ol className="order-timeline">
        {entries.map((entry) => {
          const Icon = icons[entry.kind];
          return (
            <li key={entry.id} className={`timeline-${entry.kind}`}>
              <span className="timeline-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div>
                <b>{timelineLabels[entry.kind]}</b>
                <small>
                  {date(entry.at, true)}
                  {entry.actor ? ` · ${entry.actor.name}` : ""}
                </small>
                {entry.detail && <p>{entry.detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
