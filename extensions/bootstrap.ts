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
  // Use the context event for idiomatic Pi context injection
  pi.on("context", (_event: unknown, _ctx: unknown) => {
    return {
      sections: [
        {
          title: "Superpowers Skills Framework",
          content: getContent(),
        },
      ],
    };
  });
}
