export const siteConfig = {
  name: "Enterprise Boilerplate",
  description: "Next.js 16 Enterprise-grade Boilerplate with Domain-Driven Design",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  links: {
    github: "https://github.com/your-org/nextjs-enterprise-boilerplate",
  },
};

export type SiteConfig = typeof siteConfig;
