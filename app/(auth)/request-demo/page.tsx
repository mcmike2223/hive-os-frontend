"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Globe, Loader2, Mail, Phone, Building2, Users, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { submitDemoRequest } from "@/modules/subscription/api";

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "500+", label: "500+ employees" },
];

const INTERESTS = [
  "Hospitality Management",
  "Inventory Control",
  "Project Management",
  "Workflow Automation",
  "API & Integrations",
  "Fleet Management",
  "Advanced Analytics",
  "All Modules",
];

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  companySize: string;
  interests: string[];
  message: string;
};

export default function RequestDemoPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState("");

  const [formData, setFormData] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    companySize: "",
    interests: [],
    message: "",
  });

  const handleInputChange = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => {
      const interests = prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!formData.companySize) {
      setError("Please select your company size.");
      setLoading(false);
      return;
    }

    try {
      await submitDemoRequest({
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        company: formData.company.trim(),
        company_size: formData.companySize,
        interests: formData.interests,
        message: formData.message.trim() || undefined,
      });

      setSuccess(true);
    } catch (err: unknown) {
      let message = getErrorMessage(err, "Failed to submit request. Please try again.");

      if (err instanceof Error && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        message =
          "Cannot connect to the server right now. Please check that the app and backend are running, then try again.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black">Request Received!</h1>
          <p className="text-muted-foreground">
            Thank you for your interest in Hive.OS. Our sales team will contact you within 24 hours to schedule your
            personalized demo.
          </p>
          <Button onClick={() => router.push("/")} className="rounded-full">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-space text-xl font-black tracking-tight">
          <Globe className="h-5 w-5 text-primary" />
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">HIVE.OS</span>
        </Link>
        <Link href="/sign-in">
          <Button variant="outline" size="sm" className="rounded-full font-bold text-xs gap-1.5">
            Sign In <ArrowLeft className="h-3 w-3" />
          </Button>
        </Link>
      </nav>

      <div className="pt-24 px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-primary/10 text-primary border-none font-mono text-[10px] tracking-widest uppercase">
              Enterprise Demo
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-black font-space tracking-tight mb-3">
              Request a <span className="text-primary">Personalized Demo</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              See how Hive.OS can transform your business operations. Our experts will guide you through the features
              that matter most to your organization.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  First Name *
                </Label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    required
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    placeholder="Abebe"
                    className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Last Name *
                </Label>
                <Input
                  required
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  placeholder="Kebede"
                  className="h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Work Email *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="abebe@company.com"
                    className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+251 91 234 5678"
                    className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Company Name *
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    required
                    value={formData.company}
                    onChange={(e) => handleInputChange("company", e.target.value)}
                    placeholder="Techive Technology"
                    className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Company Size *
                </Label>
                <Select value={formData.companySize} onValueChange={(value) => handleInputChange("companySize", value)}>
                  <SelectTrigger className="h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 shadow-xl">
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Interested Modules (Select all that apply)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INTERESTS.map((interest) => (
                  <button
                    type="button"
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={cn(
                      "p-3 rounded-xl border text-sm text-left transition-all",
                      formData.interests.includes(interest)
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border/50 bg-background hover:bg-muted/30",
                    )}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Additional Message
              </Label>
              <Textarea
                value={formData.message}
                onChange={(e) => handleInputChange("message", e.target.value)}
                placeholder="Tell us about your specific needs and requirements..."
                className="min-h-[120px] bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm whitespace-pre-line">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full rounded-full h-12 text-base font-bold gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Request Demo
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By submitting this form, you agree to our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
