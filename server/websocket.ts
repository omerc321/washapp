import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Job } from "@shared/schema";

interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId?: number | string;
  subscriptions?: Set<string>;
}

let wss: WebSocketServer | null = null;

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocketClient) => {
    ws.isAlive = true;
    ws.subscriptions = new Set();

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle subscription messages
        if (message.type === "subscribe") {
          // Subscribe to specific job updates
          if (message.jobId) {
            ws.subscriptions?.add(`job:${message.jobId}`);
          }
          // Subscribe to all jobs for a customer
          if (message.customerId) {
            ws.subscriptions?.add(`customer:${message.customerId}`);
          }
          // Subscribe to cleaner's jobs
          if (message.cleanerId) {
            ws.subscriptions?.add(`cleaner:${message.cleanerId}`);
          }
          // Subscribe to company's jobs
          if (message.companyId) {
            ws.subscriptions?.add(`company:${message.companyId}`);
          }
        }

        // Handle unsubscribe messages
        if (message.type === "unsubscribe") {
          if (message.jobId) {
            ws.subscriptions?.delete(`job:${message.jobId}`);
          }
          if (message.customerId) {
            ws.subscriptions?.delete(`customer:${message.customerId}`);
          }
          if (message.cleanerId) {
            ws.subscriptions?.delete(`cleaner:${message.cleanerId}`);
          }
          if (message.companyId) {
            ws.subscriptions?.delete(`company:${message.companyId}`);
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      ws.subscriptions?.clear();
    });
  });

  // Heartbeat to detect broken connections
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws: WebSocket) => {
      const client = ws as WebSocketClient;
      if (!client.isAlive) {
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  console.log("WebSocket server initialized");
}

// Broadcast job updates to subscribed clients
export function broadcastJobUpdate(job: Job) {
  if (!wss) return;

  const message = JSON.stringify({
    type: "job_update",
    job,
  });

  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as WebSocketClient;
    
    if (ws.readyState === WebSocket.OPEN) {
      const shouldSend = 
        client.subscriptions?.has(`job:${job.id}`) ||
        client.subscriptions?.has(`customer:${job.customerId}`) ||
        client.subscriptions?.has(`cleaner:${job.cleanerId}`) ||
        client.subscriptions?.has(`company:${job.companyId}`);

      if (shouldSend) {
        ws.send(message);
      }
    }
  });
}

// Broadcast cleaner status updates
export function broadcastCleanerUpdate(cleanerId: number, status: string) {
  if (!wss) return;

  const message = JSON.stringify({
    type: "cleaner_update",
    cleanerId,
    status,
  });

  wss.clients.forEach((ws: WebSocket) => {
    const client = ws as WebSocketClient;
    
    if (ws.readyState === WebSocket.OPEN) {
      const shouldSend = client.subscriptions?.has(`cleaner:${cleanerId}`);
      if (shouldSend) {
        ws.send(message);
      }
    }
  });
}
