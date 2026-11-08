/**
 * What kind of system a product is, why that matters to a business, and the plain first step.
 * A fixed table matched on vendor and product names, the same for every reader. No model writes it.
 * The first category whose pattern matches wins, so specific products come before broad words.
 */

export type CategoryId =
  | "edge"
  | "remote-it"
  | "file-transfer"
  | "email"
  | "collaboration"
  | "website"
  | "developer"
  | "endpoint"
  | "server-backup"
  | "identity"
  | "network-device"
  | "business-app"
  | "ai"
  | "other";

export interface Category {
  id: CategoryId;
  /** Short label, for a chip. */
  label: string;
  /** Why this kind of system matters, in one sentence a non-specialist understands. */
  why: string;
  /** The first step, for a small business and a large one alike. */
  doThis: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  edge: {
    id: "edge",
    label: "VPN, firewall or gateway",
    why: "It sits at the edge of your network and faces the internet, so attackers can reach it directly.",
    doThis: "If you have it, patch it today. If you cannot, block access to it from the internet until you can.",
  },
  "remote-it": {
    id: "remote-it",
    label: "Remote support or IT management",
    why: "It controls many computers at once, so one break-in can reach all of them.",
    doThis: "Patch it today, or ask your IT provider if they run it for you.",
  },
  "file-transfer": {
    id: "file-transfer",
    label: "File transfer",
    why: "It holds files you swap with customers and partners, a common target for bulk data theft.",
    doThis: "Patch it today and check it for files or accounts you do not recognize.",
  },
  email: {
    id: "email",
    label: "Email",
    why: "It carries internal and customer mail.",
    doThis: "Patch it, or ask your email provider whether they have.",
  },
  collaboration: {
    id: "collaboration",
    label: "Documents and collaboration",
    why: "It holds shared documents and internal pages.",
    doThis: "Patch it, or ask your provider whether they have.",
  },
  website: {
    id: "website",
    label: "Website or online store",
    why: "It runs public websites, online stores or the software behind them.",
    doThis: "Ask whoever runs your website or store to update it.",
  },
  developer: {
    id: "developer",
    label: "Developer tools",
    why: "It holds source code and the keys used to build and ship software.",
    doThis: "Patch it. If it faced the internet, change the keys and passwords stored in it.",
  },
  endpoint: {
    id: "endpoint",
    label: "Computers, phones and browsers",
    why: "It runs on staff computers, phones or browsers.",
    doThis: "Install the latest updates on every device, and turn on automatic updates.",
  },
  "server-backup": {
    id: "server-backup",
    label: "Servers and backups",
    why: "It runs or protects many systems at once, including your backups.",
    doThis: "Patch it and keep its admin access off the internet.",
  },
  identity: {
    id: "identity",
    label: "Logins and access",
    why: "It controls who can log in to what.",
    doThis: "Patch it and review who has admin access.",
  },
  "network-device": {
    id: "network-device",
    label: "Routers, cameras and devices",
    why: "Routers, cameras and recorders are often forgotten and rarely updated.",
    doThis: "Update it or replace it. Never leave its admin page open to the internet.",
  },
  "business-app": {
    id: "business-app",
    label: "Business software",
    why: "It runs day-to-day business work such as finance, printing, phones or manufacturing.",
    doThis: "Ask the vendor or the team that owns it whether the fix is in.",
  },
  ai: {
    id: "ai",
    label: "AI tools",
    why: "It connects to AI models and often holds the keys to paid services and data.",
    doThis: "Update it and change any API keys stored in it.",
  },
  other: {
    id: "other",
    label: "Other software",
    why: "Software we have not put in a category yet. Your IT team or provider will know whether you run it.",
    doThis: "Find out if you use it. If you do, apply the vendor's fix.",
  },
};

// Patterns run against "vendor product" in lower case. Order matters.
const RULES: [CategoryId, RegExp][] = [
  ["remote-it", /\b(screenconnect|beyondtrust|remote support|anydesk|teamviewer|n-central|n-able|kaseya|solarwinds|manageengine|desktop central|rmm|simplehelp|splashtop)\b/],
  ["file-transfer", /\b(moveit|goanywhere|crushftp|cleo|sharefile|mft|file transfer|proftpd|vsftpd|filezilla|ftp)\b/],
  ["email", /\b(exchange|zimbra|roundcube|email gateway|mail|smtp|postfix|exim)\b/],
  [
    "edge",
    /\b(vpn|firewall|pan-os|globalprotect|fortinet|fortios|fortigate|fortiproxy|fortiweb|fortinac|fortimanager|connect secure|policy secure|netscaler|citrix adc|citrix gateway|asa|firepower|secure firewall|sma1000|sma ?\d+|sonicwall|check point|big-ip|sd-wan|velocloud|gateway|edge)\b/,
  ],
  ["identity", /\b(identity|active directory|okta|entra|azure ad|sso|ldap|radius|ise|keycloak|duo)\b/],
  ["collaboration", /\b(sharepoint|confluence|jira|atlassian|onlyoffice|collabora|owncloud|nextcloud|office online|zammad|helpdesk)\b/],
  ["developer", /\b(gitlab|gitea|github|jenkins|teamcity|artifactory|jfrog|bitbucket|kestra|mlflow|airflow)\b/],
  ["ai", /\b(litellm|langchain|ollama|openai|llm|comfyui)\b/],
  ["server-backup", /\b(esxi|vcenter|vmware|hyper-v|veeam|acronis|ahsay|backup|bind|sql server|database|oracle database|postgres|mysql|redis)\b/],
  [
    "network-device",
    /\b(router|routeros|mikrotik|netgear|linksys|tp-link|d-link|dgn\d*|hg\d+|dvr|nvr|cctv|camera|video recorder|switch|switches|zyxel|ruijie|rg-\w+|tvt|tbk|vacron|iot)\b/,
  ],
  [
    "website",
    /\b(wordpress|drupal|joomla|magento|commerce|php|struts|next\.?js|nextjs|strapi|starlette|django|laravel|apache http|nginx|tomcat|iis|ajax\.net|wso2|siteguard|cms)\b/,
  ],
  ["endpoint", /\b(windows|macos|ios|ipados|android|pixel|chrome|chromium|firefox|safari|edge browser|linux kernel|kernel|apple|libuser|brotli|bug reporting)\b/],
  ["business-app", /\b(papercut|sap|oracle e-business|netsuite|switchvox|sangoma|tracksys|siemens|erp|crm)\b/],
];

export function categorize(vendor: string | null | undefined, product: string | null | undefined): Category {
  const hay = `${vendor ?? ""} ${product ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();
  if (!hay) return CATEGORIES.other;
  for (const [id, re] of RULES) if (re.test(hay)) return CATEGORIES[id];
  return CATEGORIES.other;
}

/** Shown under every first step, for readers without their own IT staff. */
export const NOT_SURE = "Not sure if you use it? Send this page to your IT provider or security lead and ask.";
