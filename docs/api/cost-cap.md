# src/lib/prototype/cost-cap.ts

`src/lib/prototype/cost-cap.ts`: `takeModelCall(cookie, today)` allows `MODEL_CALL_LIMIT` (20) real model calls per browser per day, counted in the httpOnly cookie `wp_try_model_calls`.

`isModelCallLimitOn(env)` reads the server-only setting `MODEL_CALL_LIMIT_ENABLED` (#256): `0` turns the limit off; unset, empty or `1` keeps it on; any other value keeps it on and logs `limit_switch_invalid` once per server process. `splitGoal` skips `takeModelCall` and the cookie write when the limit is off.
