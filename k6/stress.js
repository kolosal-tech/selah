// k6 stress : paliers jusqu'à 1000 VU — trouver le point de rupture.
// ATTENTION : à ne lancer que sur un environnement qu'on a le droit de stresser.
// Usage : k6 run -e BASE_URL=https://selah.example k6/stress.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 200 },
    { duration: "2m", target: 500 },
    { duration: "2m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function stressScenario() {
  check(http.get(`${BASE}/`), { "landing ok": (r) => r.status === 200 });
  sleep(Math.random());
}
