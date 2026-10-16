import { Schema, model, Types } from "mongoose";
import type { NotificationType } from "@novellia/shared";

export interface NotificationDoc {
  _id: Types.ObjectId;
  humanId: Types.ObjectId;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    humanId: { type: Schema.Types.ObjectId, ref: "Human", required: true, index: true },
    type: {
      type: String,
      enum: [
        "invite_received",
        "invite_accepted",
        "transfer_requested",
        "transfer_approved",
        "transfer_denied",
        "member_promoted",
        "merge_requested",
        "merge_approved",
        "merge_denied",
      ],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ humanId: 1, createdAt: -1 });

export const Notification = model<NotificationDoc>("Notification", notificationSchema);
