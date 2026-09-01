import "./globals.css";

import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import localFont from "next/font/local";

import Providers from "@/components/providers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import BrandCursor from "@/components/brand-cursor";
import { PublicBrandSyncProvider } from "@/components/providers/public-brand-sync-provider";
import { formatDocumentTitle } from "@/lib/document-title";
import { fetchPublicBrandSettings, fetchSeoSettings } from "@/lib/seo";

// 🚀 IMPORT OUR NEW GLOBAL SETTINGS PROVIDER
import { SettingsProvider } from "@/components/providers/settings-provider";

// Self-hosted from app/fonts rather than next/font/google. The build machine's
// route to fonts.gstatic.com takes 3-4s per file across ~20 files, so the fetch
// intermittently timed out and next/font silently degraded every family to
// local("Arial") metrics — shipping Arial with no error. Local files make the
// build deterministic and offline-safe, and drop the render-blocking fetch.
// Each file is the variable font covering the full weight range.
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin.woff2", style: "normal" },
    { path: "./fonts/inter-latin-ext.woff2", style: "normal" },
  ],
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const spaceGrotesk = localFont({
  src: [
    { path: "./fonts/space-grotesk-latin.woff2", style: "normal" },
    { path: "./fonts/space-grotesk-latin-ext.woff2", style: "normal" },
  ],
  weight: "300 700",
  display: "swap",
  variable: "--font-space",
  fallback: ["ui-sans-serif", "sans-serif"],
});

// Editorial accent face — used for the single italic word in display headlines
// (landing hero, auth headings). Not a variable font, so both cuts are listed
// explicitly; `style` must be set per file or next/font maps italic to the
// upright file and the browser synthesises a slant.
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin.woff2", style: "normal", weight: "400" },
    { path: "./fonts/instrument-serif-latin-ext.woff2", style: "normal", weight: "400" },
    { path: "./fonts/instrument-serif-italic-latin.woff2", style: "italic", weight: "400" },
    { path: "./fonts/instrument-serif-italic-latin-ext.woff2", style: "italic", weight: "400" },
  ],
  display: "swap",
  variable: "--font-serif",
  fallback: ["ui-serif", "Georgia", "serif"],
});

const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin.woff2", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-ext.woff2", style: "normal" },
  ],
  weight: "100 800",
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

// Render metadata at request time so titles/description reflect the live central
// SEO config (the backend is unreachable during build, which would bake defaults).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const [seo, brand] = await Promise.all([
    fetchSeoSettings(),
    fetchPublicBrandSettings(requestHeaders),
  ]);
  const siteName = formatDocumentTitle(brand.app_title || seo.site_name || "HIVE.OS");
  const title = formatDocumentTitle(brand.app_title || seo.default_title || siteName);
  const description = brand.meta_description || seo.meta_description || "The neural network for modern enterprise.";
  const ogImage = brand.og_image || seo.og_image;
  const ogImages = ogImage ? [ogImage] : undefined;
  const indexable = seo.allow_indexing !== false;

  const meta: Metadata = {
    title: {
      default: title,
      template: (seo.title_template || "%page% | %site%").replace("%site%", siteName).replace("%page%", "%s"),
    },
    description,
    keywords: seo.keywords ? seo.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    applicationName: siteName,
    icons: {
      icon: [
        { url: "/branding/favicon.ico" },
        { url: "/branding/hive-os-favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/branding/hive-os-favicon-48.png", sizes: "48x48", type: "image/png" },
      ],
      apple: [{ url: "/branding/hive-os-favicon-180.png", sizes: "180x180", type: "image/png" }],
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: { title, description, siteName, type: (seo.og_type || "website") as NonNullable<Metadata["openGraph"]> extends { type?: infer T } ? T : "website", images: ogImages },
    twitter: {
      card: (seo.twitter_card || "summary_large_image") as "summary" | "summary_large_image" | "app" | "player",
      site: seo.twitter_handle || undefined,
      title,
      description,
      images: ogImages,
    },
    verification: {
      google: seo.google_site_verification || undefined,
      other: seo.bing_site_verification ? { "msvalidate.01": seo.bing_site_verification } : undefined,
    },
  };

  if (seo.canonical_base_url) {
    try {
      meta.metadataBase = new URL(seo.canonical_base_url);
    } catch {
      /* ignore bad URL */
    }
  }

  return meta;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seo = await fetchSeoSettings();
  const ga = seo.google_analytics_id?.trim();
  const gtm = seo.google_tag_manager_id?.trim();
  const pixel = seo.facebook_pixel_id?.trim();
  const orgJsonLd = seo.organization_name
    ? {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: seo.organization_name,
        ...(seo.organization_logo ? { logo: seo.organization_logo } : {}),
        ...(seo.canonical_base_url ? { url: seo.canonical_base_url } : {}),
        ...(Array.isArray(seo.social_links) && seo.social_links.length ? { sameAs: seo.social_links } : {}),
      }
    : null;

  // Font variables live on <html> so they resolve at :root — `applyBrandRuntime`
  // writes --brand-font-family there, and Tailwind's --font-* theme keys are
  // emitted at :root too. On <body> they were out of scope for both.
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
    >
      <body
        suppressHydrationWarning
        className="font-sans bg-background text-foreground antialiased overflow-x-hidden"
      >
      {orgJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      )}
      {gtm && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script>
      )}
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
        </>
      )}
      {pixel && (
        <Script id="fb-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}</Script>
      )}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            {/* 🚀 WRAP THE APP IN SETTINGS SO AUTH-GUARD CAN READ THE TIMEOUT */}
            <SettingsProvider>
              <PublicBrandSyncProvider />
              <BrandCursor />
              {children}
              <Toaster />
            </SettingsProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
