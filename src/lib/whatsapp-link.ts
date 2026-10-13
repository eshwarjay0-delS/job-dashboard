// Which MarketFit account a WhatsApp number saves into: the rules are in whatsapp-link-core.ts (and why it works
// this way is written there); here they are tied to the real store.
import { blob } from "@/lib/storage"
import { linksOver } from "@/lib/whatsapp-link-core"

export { CODE_MINUTES, showCode, tidyCode, type Claim } from "@/lib/whatsapp-link-core"
export const { newLinkCode, claimLinkCode, linkedUserId, linkedNumbers, unlinkAll } = linksOver(blob)
