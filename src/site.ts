/* Who and where. One place to change the domain, the author or the links. */

export const SITE = {
  name: "harness-hub",
  /** Absolute URL of the deployed site, no trailing slash. Override with VITE_SITE_URL at build time. */
  url: ((import.meta.env?.VITE_SITE_URL as string | undefined) ?? "https://ranjeet692.github.io/harness-hub").replace(/\/$/, ""),
  repo: "https://github.com/ranjeet692/harness-hub",
  tagline: "AI agent harness engineering, by example",
  description:
    "Six AI agents, each run in a hardened and a naive harness: see tool tiers, retries, approvals, injection defense and evals at work. Open source.",
  author: {
    name: "Ranjeet Kumar",
    github: "https://github.com/ranjeet692",
    /** Add your LinkedIn or personal site here; they appear on the About page and in structured data. */
    linkedin: "",
    website: "",
  },
  keywords: [
    "AI agent harness", "agent harness engineering", "AI agents", "LLM agents", "agentic AI", "Claude",
    "tool use", "agent evaluation", "prompt injection defense", "idempotency", "human in the loop", "AI engineering",
  ],
};

export const authorLinks = () => [SITE.author.github, SITE.author.linkedin, SITE.author.website].filter(Boolean);
