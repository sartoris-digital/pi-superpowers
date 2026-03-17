/**
 * Bootstrap extension for pi-superpowers.
 *
 * Injects the using-superpowers skill content into every Pi session
 * via the context event, so the agent knows about available skills
 * and how to use them.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildBootstrapContent } from "./bootstrap-utils.js";

// Assemble content once at load time, serve many times
let cachedContent: string | null = null;

function getContent(): string {
  if (!cachedContent) {
    cachedContent = buildBootstrapContent();
  }
  return cachedContent;
}

export default function (pi: ExtensionAPI) {
  // Inject superpowers content into the system prompt before each agent loop
  pi.on("before_agent_start", () => {
    return {
      systemPrompt: `## Superpowers Skills Framework\n\n${getContent()}`,
    };
  });
}
