import type { Domain } from "../engine/types";
import { barista } from "./barista";
import { robovac } from "./robovac";
import { butler } from "./butler";
import { coding } from "./coding";
import { diagram } from "./diagram";
import { onboarding } from "./onboarding";

/** Every domain on the hub, in display order. Add new domains here. */
export const DOMAINS: Domain[] = [barista, robovac, butler, coding, diagram, onboarding];
export const DOMAIN_BY_ID: Record<string, Domain> = Object.fromEntries(DOMAINS.map(d => [d.id, d]));
