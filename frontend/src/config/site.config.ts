export const siteConfig = {
  name: "CYBSEC PMO",
  description: "Cybersec PMO Platform",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  links: {
    github: "https://github.com/your-org/nextjs-enterprise-boilerplate",
  },
};

export type SiteConfig = typeof siteConfig;
