"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { getBackendApiRoot, getPublicServeUrl, getTenantHeaders, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { ArrowLeft, Check, Globe, Send } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchPublicSubscriptionCatalog,
  submitDemoRequest,
} from "@/modules/subscription/api";
import { DemoScopeSelector } from "@/modules/subscription/components/demo-scope-selector";
import type { SignupCatalogModule } from "@/modules/subscription/components/signup-catalog-selector";

const COMPANY_SIZES = [
  ["1-10", "1-10 employees"],
  ["11-50", "11-50 employees"],
  ["51-200", "51-200 employees"],
  ["201-500", "201-500 employees"],
  ["500+", "500+ employees"],
] as const;

type BusinessType = {
  key: string;
  label: string;
  description?: string;
};

function createClientRequestId() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function RequestDemoPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const workspaceScope = getWorkspaceScopeKey();

  const { data: brandData } = useQuery({
    queryKey: ["publicBrandSettings", workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch public brand settings");
      return res.json();
    },
    staleTime: 600000,
    retry: 1,
  });

  const brandSettings = brandData?.data;
  const displayPortalName = brandSettings?.app_title || "HIVE.OS";
  const activeLogoPath =
    resolvedTheme === "dark"
      ? brandSettings?.logo_dark || brandSettings?.logo_light
      : brandSettings?.logo_light || brandSettings?.logo_dark;
  const activeLogoUrl = getPublicServeUrl(activeLogoPath);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const requestIdRef = React.useRef("");
  const initializedRef = React.useRef(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [companySize, setCompanySize] = React.useState("");
  const [businessType, setBusinessType] = React.useState("");
  const [selectedModules, setSelectedModules] = React.useState<string[]>([]);
  const [selectedSubmodules, setSelectedSubmodules] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState("");

  const { data: catalogResponse, isLoading: catalogLoading, isError: catalogError } = useQuery({
    queryKey: ["public-subscription-catalog", "demo-request"],
    queryFn: fetchPublicSubscriptionCatalog,
    staleTime: 60_000,
  });
  const catalog = catalogResponse?.data ?? {};
  const modules = React.useMemo(
    () => (catalog.catalog ?? []) as SignupCatalogModule[],
    [catalog.catalog],
  );
  const businessTypes = React.useMemo(
    () => (catalog.business_types ?? []) as BusinessType[],
    [catalog.business_types],
  );

  React.useEffect(() => {
    requestIdRef.current ||= createClientRequestId();
  }, []);

  React.useEffect(() => {
    if (initializedRef.current || !businessTypes.length || !modules.length) return;

    const initialBusinessType = businessTypes[0].key;
    setBusinessType(initialBusinessType);
    initializedRef.current = true;
  }, [businessTypes, modules]);

  const handleBusinessTypeChange = (nextBusinessType: string) => {
    const compatibleSlugs = new Set(
      modules
        .filter((module) => !module.business_types?.length || module.business_types.includes(nextBusinessType))
        .map((module) => module.slug),
    );
    setBusinessType(nextBusinessType);
    setSelectedModules((current) => current.filter((slug) => compatibleSlugs.has(slug)));
    setSelectedSubmodules((current) => current.filter((key) => compatibleSlugs.has(key.split(":")[0])));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!selectedModules.length) {
      setError("Choose at least one module for the demo.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    setSubmitting(true);
    try {
      await submitDemoRequest({
        client_request_id: requestIdRef.current || createClientRequestId(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        company: company.trim(),
        company_size: companySize,
        business_type: businessType,
        requested_modules: selectedModules,
        requested_submodules: selectedSubmodules,
        message: message.trim() || undefined,
      });
      setSuccess(true);
    } catch (caught: unknown) {
      const detail = getErrorMessage(caught, "We could not submit the request. Please try again.");
      setError(detail.includes("Failed to fetch")
        ? "The demo service is temporarily unreachable. Keep this page open and try again."
        : detail);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="demo-lease flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check aria-hidden="true" />
            </span>
            <CardTitle><h1 className="text-3xl">Your demo scope is saved</h1></CardTitle>
            <CardDescription>
              Our team will review your selected modules, confirm the expiration date, and send access instructions to {email}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => router.push("/")}>Back to home</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="demo-lease min-h-screen bg-background text-foreground">
      <a href="#demo-request-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:p-3 focus:shadow-lg">
        Skip to demo request
      </a>
      <header className="border-b bg-background/95">
        <nav aria-label="Primary" className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label={`${displayPortalName} home`} className="flex min-h-11 items-center gap-2 font-bold">
            {activeLogoUrl ? (
              <img
                src={activeLogoUrl}
                alt={`${displayPortalName} logo`}
                className="h-8 w-auto max-w-[200px] object-contain"
              />
            ) : (
              <>
                <Globe aria-hidden="true" /> {displayPortalName}
              </>
            )}
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/sign-in"><ArrowLeft data-icon="inline-start" aria-hidden="true" />Sign in</Link>
          </Button>
        </nav>
      </header>

      <main id="demo-request-main" className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="demo-request-heading" className="min-w-0">
          <div className="mb-8 flex flex-col gap-3">
            <Badge variant="secondary" className="w-fit">Configurable demo lease</Badge>
            <h1 id="demo-request-heading" className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Request a demo built around your actual business
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Choose the business type, modules, and sub-modules you need. Your administrator can adjust the scope and set an exact expiration before access is issued.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <Card>
              <CardHeader>
                <CardTitle><h2>Contact and organization</h2></CardTitle>
                <CardDescription>We use these details only to prepare and deliver your demo.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field><FieldLabel htmlFor="demo-first-name">First name</FieldLabel><Input id="demo-first-name" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field>
                    <Field><FieldLabel htmlFor="demo-last-name">Last name</FieldLabel><Input id="demo-last-name" autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field>
                    <Field><FieldLabel htmlFor="demo-email">Work email</FieldLabel><Input id="demo-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
                    <Field><FieldLabel htmlFor="demo-phone">Phone <span className="text-muted-foreground">(optional)</span></FieldLabel><Input id="demo-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
                    <Field><FieldLabel htmlFor="demo-company">Company</FieldLabel><Input id="demo-company" autoComplete="organization" required value={company} onChange={(event) => setCompany(event.target.value)} /></Field>
                    <Field>
                      <FieldLabel htmlFor="demo-company-size">Company size</FieldLabel>
                      <NativeSelect id="demo-company-size" className="h-11 w-full" required value={companySize} onChange={(event) => setCompanySize(event.target.value)}>
                        <NativeSelectOption value="">Select company size</NativeSelectOption>
                        {COMPANY_SIZES.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
                      </NativeSelect>
                    </Field>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><h2>Business and demo scope</h2></CardTitle>
                <CardDescription>The options below come from the same live catalog used for subscriptions.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-7">
                {catalogLoading ? (
                  <div className="flex flex-col gap-3" aria-label="Loading module catalog"><Skeleton className="h-11 w-full" /><Skeleton className="h-40 w-full" /></div>
                ) : catalogError ? (
                  <Alert variant="destructive"><AlertTitle>Catalog unavailable</AlertTitle><AlertDescription>Refresh the page before submitting a demo request.</AlertDescription></Alert>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="demo-business-type">Business type</FieldLabel>
                      <NativeSelect id="demo-business-type" className="h-11 w-full" required value={businessType} onChange={(event) => handleBusinessTypeChange(event.target.value)}>
                        {businessTypes.map((option) => <NativeSelectOption key={option.key} value={option.key}>{option.label}</NativeSelectOption>)}
                      </NativeSelect>
                      <FieldDescription>Only compatible catalog modules are shown.</FieldDescription>
                    </Field>
                    <DemoScopeSelector
                      modules={modules}
                      businessType={businessType}
                      selectedModules={selectedModules}
                      selectedSubmodules={selectedSubmodules}
                      onChange={(nextModules, nextSubmodules) => { setSelectedModules(nextModules); setSelectedSubmodules(nextSubmodules); }}
                      disabled={submitting}
                      idPrefix="public-demo"
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <FieldSet>
              <FieldLegend>Anything else we should know?</FieldLegend>
              <Field>
                <FieldLabel htmlFor="demo-message">Requirements <span className="text-muted-foreground">(optional)</span></FieldLabel>
                <Textarea id="demo-message" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Integrations, workflows, user count, or a preferred demo date" />
              </Field>
            </FieldSet>

            {error ? (
              <Alert ref={errorRef} tabIndex={-1} variant="destructive">
                <AlertTitle>Check the demo request</AlertTitle>
                <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" disabled={submitting || catalogLoading || catalogError} className="min-h-11 w-full sm:w-fit">
              {submitting ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" aria-hidden="true" />}
              {submitting ? "Submitting request" : "Request this demo"}
            </Button>
            <p className="text-sm text-muted-foreground">
              By submitting, you agree to the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link>.
            </p>
          </form>
        </section>

        <aside aria-labelledby="demo-lease-heading" className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle id="demo-lease-heading">How the demo lease works</CardTitle>
              <CardDescription>Clear scope, clear end date, no hidden access.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm">
                <li><strong>Choose scope.</strong> Select live modules and sub-modules.</li>
                <li><strong>We configure it.</strong> An administrator confirms plan, tenant, domain, and expiry.</li>
                <li><strong>Access ends automatically.</strong> Protected features stop working at the exact expiration time.</li>
              </ol>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
