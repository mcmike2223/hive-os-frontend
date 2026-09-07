"use client";

import * as React from "react";
import {
  BookOpenCheck,
  Check,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  answerAssistantGap,
  approveLearnedAnswer,
  fetchAssistantGaps,
  fetchAssistantMetrics,
  fetchLearnedAnswers,
  rejectLearnedAnswer,
  teachAssistant,
  type CopilotAssistantMetrics,
  type CopilotGap,
  type CopilotLearnedAnswer,
} from "@/modules/support-bot/api/copilot-api";

/**
 * What the assistant could not answer, and what it has been taught.
 *
 * The assistant records every question it failed on and groups them by meaning,
 * so one missing answer is one item here rather than forty unread log lines.
 * What it never does is write the answer: a person does that, another person
 * approves it, and only then is it served. That step is the difference between
 * an assistant that learns and an assistant that repeats the last thing it was
 * told — which is easier to build and much worse to live with.
 */
export default function AssistantLearningPage() {
  const [metrics, setMetrics] = React.useState<CopilotAssistantMetrics | null>(null);
  const [gaps, setGaps] = React.useState<CopilotGap[]>([]);
  const [answers, setAnswers] = React.useState<CopilotLearnedAnswer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [m, g, a] = await Promise.all([
        fetchAssistantMetrics(30),
        fetchAssistantGaps(50),
        fetchLearnedAnswers(),
      ]);
      setMetrics(m);
      setGaps(g);
      setAnswers(a);
    } catch {
      setError("Could not load what the assistant has learned. Check that the module is enabled.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    );
  }

  const pending = answers.filter((answer) => answer.status === "pending");
  const approved = answers.filter((answer) => answer.status === "approved");

  return (
    <div className="support-bot-accessible space-y-6 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teach the assistant</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Questions it could not answer, grouped by what they mean rather than how they were
            worded. Answer one here and it answers all of them from then on — after somebody
            approves it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {metrics && <MetricsRow metrics={metrics} />}

      <Tabs defaultValue="gaps">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="gaps" className="min-h-11 whitespace-normal">
            Unanswered
            {gaps.length > 0 && <Badge className="ml-2">{gaps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pending" className="min-h-11 whitespace-normal">
            Awaiting approval
            {pending.length > 0 && <Badge className="ml-2">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="approved" className="min-h-11 whitespace-normal">
            In use ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="new" className="min-h-11 whitespace-normal">
            Add an answer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gaps" className="mt-4 space-y-3">
          {gaps.length === 0 ? (
            <EmptyState
              icon={<MessageCircleQuestion className="h-5 w-5" />}
              title="Nothing unanswered"
              body="Either the assistant is answering everything it is asked, or nobody has asked it anything yet. Gaps are grouped overnight, so a question asked today appears tomorrow."
            />
          ) : (
            gaps.map((gap) => <GapCard key={gap.id} gap={gap} onDone={load} />)
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <EmptyState
              icon={<Check className="h-5 w-5" />}
              title="Nothing waiting"
              body="Answers written by a support agent or a curator land here until somebody approves them. Until then the assistant does not use them."
            />
          ) : (
            pending.map((answer) => (
              <AnswerCard key={answer.id} answer={answer} onDone={load} reviewable />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4 space-y-3">
          {approved.length === 0 ? (
            <EmptyState
              icon={<BookOpenCheck className="h-5 w-5" />}
              title="Nothing approved yet"
              body="Approved answers are served ahead of the generated documentation when somebody asks the same thing."
            />
          ) : (
            approved.map((answer) => <AnswerCard key={answer.id} answer={answer} onDone={load} />)
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-4">
          <NewAnswerForm onDone={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricsRow({ metrics }: { metrics: CopilotAssistantMetrics }) {
  const tiles = [
    {
      label: "Questions",
      value: metrics.total.toLocaleString(),
      hint: `since ${metrics.since}`,
    },
    {
      label: "Answered",
      value: metrics.answered_rate === null ? "—" : `${metrics.answered_rate}%`,
      // Named carefully: this counts answers given, not answers that were
      // right. The helpful rate beside it is the one about being right.
      hint: "got an answer rather than a shrug",
    },
    {
      label: "Found helpful",
      value: metrics.helpful_rate === null ? "—" : `${metrics.helpful_rate}%`,
      hint: metrics.rated > 0 ? `of ${metrics.rated} rated` : "nobody has rated one yet",
    },
    {
      label: "Handed to a person",
      value: metrics.escalation_rate === null ? "—" : `${metrics.escalation_rate}%`,
      hint: "asked for a human",
    },
    {
      label: "Typical reply",
      value:
        metrics.median_latency_ms === null
          ? "—"
          : `${(metrics.median_latency_ms / 1000).toFixed(1)}s`,
      hint: "median, not average",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GapCard({ gap, onDone }: { gap: CopilotGap; onDone: () => Promise<void> }) {
  const [answer, setAnswer] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const answerId = `assistant-gap-${gap.id}-answer`;
  const errorId = `assistant-gap-${gap.id}-error`;

  const submit = async (approve: boolean) => {
    if (!answer.trim()) return;
    setSaving(true);
    setFailed(null);

    try {
      await answerAssistantGap(gap.id, { answer: answer.trim(), approve });
      await onDone();
    } catch {
      setFailed("That could not be saved.");
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug">{gap.question}</h2>
            <CardDescription className="mt-1">
              Asked {gap.occurrences} {gap.occurrences === 1 ? "time" : "times"}
              {gap.module ? ` · ${gap.module}` : ""}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            ×{gap.occurrences}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {gap.examples.length > 1 && (
          <div className="rounded-md bg-muted/50 p-2.5">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Also asked as
            </p>
            <ul className="space-y-0.5">
              {gap.examples.slice(0, 5).map((example, index) => (
                <li key={index} className="text-xs text-muted-foreground">
                  “{example}”
                </li>
              ))}
            </ul>
          </div>
        )}

        <label htmlFor={answerId} className="block text-sm font-medium">
          Answer <span className="text-muted-foreground">(required)</span>
        </label>
        <Textarea
          id={answerId}
          rows={4}
          placeholder="Write the answer once. Every phrasing above will get it."
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          required
          aria-invalid={failed ? true : undefined}
          aria-describedby={failed ? errorId : undefined}
        />

        {failed && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {failed}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving || !answer.trim()} onClick={() => void submit(true)}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Save and use it
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving || !answer.trim()}
            onClick={() => void submit(false)}
          >
            Save for review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnswerCard({
  answer,
  onDone,
  reviewable = false,
}: {
  answer: CopilotLearnedAnswer;
  onDone: () => Promise<void>;
  reviewable?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);

  const act = async (approve: boolean) => {
    setBusy(true);

    try {
      await (approve ? approveLearnedAnswer(answer.id) : rejectLearnedAnswer(answer.id));
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug">{answer.question}</h2>
            <CardDescription className="mt-1">
              {answer.source === "agent_reply"
                ? "Written by a support agent in the inbox"
                : answer.source === "cluster"
                  ? "Written to close a gap"
                  : "Written by a curator"}
              {answer.hits > 0 ? ` · used ${answer.hits}×` : ""}
              {answer.positive + answer.negative > 0
                ? ` · ${answer.positive} helpful, ${answer.negative} not`
                : ""}
            </CardDescription>
          </div>
          <Badge variant={answer.status === "approved" ? "default" : "secondary"}>
            {answer.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{answer.answer}</p>

        {answer.variants.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Also recognised as: {answer.variants.slice(0, 3).join(" · ")}
          </p>
        )}

        {reviewable && (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void act(true)}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(false)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewAnswerForm({ onDone }: { onDone: () => Promise<void> }) {
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const submit = async () => {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setDone(false);
    setFailed(false);

    try {
      await teachAssistant({ question: question.trim(), answer: answer.trim() });
      setQuestion("");
      setAnswer("");
      setDone(true);
      await onDone();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold">Add an answer</h2>
        <CardDescription>
          For something people ask that the platform documentation does not cover — a policy, a
          local process, a workaround. It is saved for review; approve it on the tab above before
          the assistant uses it.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="new-assistant-question" className="block text-sm font-medium">
              Question <span className="text-muted-foreground">(required)</span>
            </label>
            <Input
              id="new-assistant-question"
              placeholder="The question, in the words people actually use"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-assistant-answer" className="block text-sm font-medium">
              Answer <span className="text-muted-foreground">(required)</span>
            </label>
            <Textarea
              id="new-assistant-answer"
              rows={6}
              placeholder="The answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              required
            />
          </div>
          {failed && (
            <p role="alert" className="text-xs text-destructive">
              The question and answer could not be saved. Try again.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving || !question.trim() || !answer.trim()}>
              {saving && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              Save for review
            </Button>
            {done && (
              <span role="status" className="text-xs text-muted-foreground">
                Saved.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <div className="mb-2 text-muted-foreground" aria-hidden="true">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
