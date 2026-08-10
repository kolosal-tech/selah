// k6 load : montée à 200 VU, 5 min — comportement nominal sous charge.
// Usage : k6 run -e BASE_URL=https://selah.example k6/load.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "3m", target: 200 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function loadScenario() {
  check(http.get(`${BASE}/`), { "landing 200": (r) => r.status === 200 });
  check(http.get(`${BASE}/login`), { "login 200": (r) => r.status === 200 });
  sleep(Math.random() * 2);
}
