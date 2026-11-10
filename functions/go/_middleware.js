// The /go/ ad bridge pages lead to the program sales pages, so the First 1,000 redirect (campaign.json) covers them too.
import { campaignRedirect } from "../_lib/campaign-redirect.js";

export async function onRequest({ request, env, next }) {
  return (await campaignRedirect(request, env)) || next();
}
