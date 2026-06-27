// k6 load test for the WhatsApp status webhook.
// Signs each body with HMAC-SHA256 (X-Hub-Signature-256) exactly like Meta does,
// so requests pass signature verification and exercise the real DB path.
//
// Run:
//   k6 run -e BASE_URL=http://localhost:3000 -e APP_SECRET=your-app-secret load/webhook-load.js
//
// Notes:
// - wamid values are random, so recipients won't match — this measures webhook
//   ingest + signature verify + MessageEvent insert throughput (the hot path),
//   not recipient updates. For end-to-end, seed real wamids first.

import http from "k6/http";
import crypto from "k6/crypto";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const APP_SECRET = __ENV.APP_SECRET || "test-secret";

export const options = {
  stages: [
    { duration: "30s", target: 50 },   // ramp up
    { duration: "1m", target: 200 },   // sustain
    { duration: "30s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],          // <1% errors
    http_req_duration: ["p(95)<300"],        // p95 under 300ms
  },
};

function statusBody() {
  const wamid = `wamid.${Math.random().toString(36).slice(2)}`;
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                { id: wamid, status: "delivered", recipient_id: "966500000000" },
              ],
            },
          },
        ],
      },
    ],
  });
}

export default function () {
  const body = statusBody();
  const sig = "sha256=" + crypto.hmac("sha256", APP_SECRET, body, "hex");

  const res = http.post(`${BASE_URL}/api/webhooks/whatsapp`, body, {
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sig },
  });

  check(res, {
    "status 200": (r) => r.status === 200,
    "acked": (r) => r.json("ok") === true,
  });
}
