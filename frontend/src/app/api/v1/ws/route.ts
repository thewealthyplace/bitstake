// GET /api/v1/ws
// Server-Sent Events (SSE) endpoint that streams live pool stats updates.
// Clients connect and receive pool_stats_update, new_block, and cycle_change events.
// (Next.js App Router does not natively upgrade to WebSocket; SSE is the supported pattern.)

import { NextRequest } from "next/server";
import { registerClient, connectToHiro } from "@/lib/ws/server";
import type { WsMessage } from "@/types/api";

// Lazily connect to Hiro WebSocket on first SSE client
let hiroConnected = false;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  if (!hiroConnected) {
    connectToHiro();
    hiroConnected = true;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send connected event immediately
      const connected: WsMessage = {
        event: "connected",
        data: { message: "Bitstake live feed connected" },
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connected)}\n\n`));

      // Register this client for broadcasts
      const unregister = registerClient((msg: WsMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          unregister();
        }
      });

      // Heartbeat every 15 seconds to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unregister();
        }
      }, 15_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",  // disable nginx buffering
    },
  });
}
