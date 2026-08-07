// k6 smoke : 5 VU, 30 s — l'app répond-elle ?
// Usage : k6 run -e BASE_URL=https://selah.example k6/smoke.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const pages = ["/", "/login", "/signup"];
  for (const p of pages) {
    const res = http.get(`${BASE}${p}`);
    check(res, { [`${p} → 200`]: (r) => r.status === 200 });
  }
  sleep(1);
}
