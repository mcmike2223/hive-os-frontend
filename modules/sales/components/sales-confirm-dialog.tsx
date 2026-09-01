"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/store/use-translation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type SalesConfirmRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

type ConfirmState = SalesConfirmRequest & {
  open: boolean;
};

const CLOSED_STATE: ConfirmState = {
  open: false,
  title: "",
  description: "",
  onConfirm: () => {},
};

export function useSalesConfirmDialog() {
  const [state, setState] = React.useState<ConfirmState>(CLOSED_STATE);

  const requestConfirm = React.useCallback((request: SalesConfirmRequest) => {
    setState({ ...request, open: true });
  }, []);

  const closeConfirm = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const confirmDialogProps = React.useMemo(
    () => ({
      open: state.open,
      title: state.title,
      description: state.description,
      confirmLabel: state.confirmLabel,
      onOpenChange: (open: boolean) => {
        if (!open) closeConfirm();
      },
      onConfirm: () => {
        state.onConfirm();
      },
    }),
    [closeConfirm, state],
  );

  return { requestConfirm, closeConfirm, confirmDialogProps };
}

export function SalesConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl" disabled={pending}>
            {t("sales.common.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive hover:bg-destructive/90"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel ?? t("sales.common.confirm", "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
