# Realtime mobile architecture

MarketFit's mobile realtime path is designed around deterministic session state, authenticated event delivery, recovery after network loss, and asynchronous AI actions.

## Runtime shape

The mobile client authenticates with the existing Supabase identity and sends its access token as a bearer token to MarketFit APIs. The server creates or resumes a user-scoped realtime session. Supabase Realtime carries server events to the device while the HTTP event API remains the durable source for catch-up after disconnects.

The client state machine is:

`idle -> connecting -> live -> reconnecting -> live`

with explicit `background`, `offline`, `ended`, and `error` states.

The client never treats the websocket subscription as the database. Every server event is written to `realtime_mobile_events` before it is observed by the device. On reconnect, the client asks for every event after its last durable cursor. Duplicate client actions use a stable client event id and the database unique constraint makes ingestion idempotent.

## Mobile lifecycle rules

When the app enters the background, it marks the session as `background`, stops the heartbeat, and removes the realtime channel. When it returns to the foreground, it resumes the session, re-subscribes, performs durable catch-up, flushes the bounded offline queue, and restarts the heartbeat.

When network connectivity disappears, outgoing client events are queued locally. The queue is bounded so an extended outage cannot grow storage without limit. Reconnect uses exponential backoff with jitter.

## Async AI vertical slice

`POST /api/realtime/mobile/actions/interview-prep` is the first end-to-end realtime AI action.

The request is acknowledged with HTTP 202 after the server has durably recorded the request event. AI work continues through Next.js `after()`. The mobile app receives durable status events:

- `workflow.accepted`
- `workflow.running`
- `workflow.completed`
- `workflow.failed`

The underlying interview-prep workflow still uses the production workflow runtime, subscription gate, strict structured output, cache, provider routing, and shared usage ledger.

## Security boundaries

The client receives no service-role key and no AI-provider secret. It uses the user's Supabase access token only. All session and event rows are user-scoped with RLS. Mutations occur through authenticated server routes using the service role after ownership has been established from the user token.

Realtime payloads are size-bounded, event names are validated, and duplicate client actions are rejected by durable idempotency rather than process memory.

## Physical-device validation

A browser responsive preview is not a release test. Before a native release, validate on at least one low-to-mid-tier Android device and one physical iPhone. Test:

- background -> foreground recovery;
- airplane-mode loss and recovery;
- switching Wi-Fi to cellular during a live session;
- OS navigation gestures and safe-area behavior;
- long-session memory growth;
- battery impact of heartbeats/reconnects;
- cold launch and expired auth;
- duplicate taps during reconnect;
- app termination during an async workflow and catch-up after relaunch.

Realtime correctness is the combination of low latency while connected and deterministic recovery when the mobile environment is not cooperative.
