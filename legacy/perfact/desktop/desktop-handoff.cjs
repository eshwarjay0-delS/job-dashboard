// Short, one-use MarketFit website -> Windows desktop connector.
// Never log session data, refresh tokens, or capability tickets.
function ticketFromArgv(argv) {
  const raw = (argv || []).find(arg => typeof arg === "string" && /^marketfit-kompas:\/\/open(?:\/)?\?/i.test(arg));
  if (!raw || raw.length > 200) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "marketfit-kompas:" || url.hostname !== "open" || (url.pathname && url.pathname !== "/")) return null;
    if ([...url.searchParams.keys()].length !== 1 || !url.searchParams.has("ticket")) return null;
    const ticket = url.searchParams.get("ticket");
    return /^[A-Za-z0-9_-]{43}$/.test(ticket || "") ? ticket : null;
  } catch { return null; }
}

async function redeemTicket(fetchFn, origin, ticket) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket || "")) throw Error("Invalid connection ticket");
  const response = await fetchFn(origin + "/api/kompas/desktop-handoff/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ticket }),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw Error("The saved interview connection expired or was unavailable. Press Connect & start again.");
  const answer = await response.json();
  if (!answer || answer.ok !== true || !answer.session ||
      answer.session.site !== "marketfit" || typeof answer.session.id !== "string" || !answer.session.id) {
    throw Error("Could not retrieve your interview session. Press Connect & start again.");
  }
  return answer.session;
}

module.exports = { ticketFromArgv, redeemTicket };
