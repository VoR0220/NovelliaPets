import type { Response } from "express";
import type { NotificationDto } from "@novellia/shared";

type Client = {
  humanId: string;
  res: Response;
};

const clients = new Set<Client>();

export function addSseClient(humanId: string, res: Response): () => void {
  const client: Client = { humanId, res };
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

export function pushNotificationToHuman(
  humanId: string,
  notification: NotificationDto
): void {
  for (const client of clients) {
    if (client.humanId === humanId) {
      client.res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    }
  }
}

export function sseHeartbeat(): void {
  for (const client of clients) {
    client.res.write(`: ping\n\n`);
  }
}
