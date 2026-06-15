import "./globals.css";

import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import Providers from "@/components/providers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import BrandCursor from "@/components/brand-cursor";
import { PublicBrandSyncProvider } from "@/components/providers/public-brand-sync-provider";
import { fetchSeoSettings } from "@/lib/seo";

// 🚀 IMPORT OUR NEW GLOBAL SETTINGS PROVIDER
import { SettingsProvider } from "@/components/providers/settings-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// Render metadata at request time so titles/description reflect the live central
// SEO config (the backend is unreachable during build, which would bake defaults).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchSeoSettings();
  const siteName = seo.site_name || "HIVE";
  const title = seo.default_title || `${siteName} | Enterprise Neural Network`;
  const description = seo.meta_description || "The neural network for modern enterprise.";
  const ogImages = seo.og_image ? [seo.og_image] : undefined;
  const indexable = seo.allow_indexing !== false;

  const meta: Metadata = {
    title: {
      default: title,
      template: (seo.title_template || "%page% | %site%").replace("%site%", siteName).replace("%page%", "%s"),
    },
    description,
    keywords: seo.keywords ? seo.keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    applicationName: siteName,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: { title, description, siteName, type: (seo.og_type as any) || "website", images: ogImages },
    twitter: {
      card: (seo.twitter_card as any) || "summary_large_image",
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

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans bg-background text-foreground antialiased overflow-x-hidden`}
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
