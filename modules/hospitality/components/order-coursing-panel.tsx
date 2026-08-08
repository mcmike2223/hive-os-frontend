"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRightLeft, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchHospitalityTables,
  holdHospitalityCourse,
  releaseHospitalityCourse,
  transferHospitalityOrderItemSeat,
  transferHospitalityOrderTable,
} from "@/modules/hospitality/api";
import type {
  HospitalityLocation,
  HospitalityServiceOrder,
  HospitalityServiceOrderItem,
} from "@/modules/hospitality/types";
import { usePermissions } from "@/hooks/use-permissions";

const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : undefined;

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.errors
    ? String(Object.values(error.response.data.errors)[0])
    : error?.response?.data?.message || fallback;

/**
 * Coursing and reallocation controls for an existing order.
 *
 * The backend has held courses, seat transfer and table transfer since phase 3,
 * all permission-guarded and idempotent, but nothing rendered them, so a manager
 * could not course or move an order anywhere in the product. This panel is that
 * missing surface.
 */
export default function OrderCoursingPanel({
  order,
  onChanged,
}: {
  order: HospitalityServiceOrder;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canCourse = hasAnyPermission([
    "release_hospitality_courses",
    "manage_hospitality_service_orders",
  ]);
  const canMoveSeats = hasAnyPermission([
    "transfer_hospitality_order_items",
    "manage_hospitality_service_orders",
  ]);
  const canMoveTables = hasAnyPermission([
    "transfer_hospitality_tables",
    "manage_hospitality_service_orders",
  ]);

  const [seatDrafts, setSeatDrafts] = useState<Record<number, string>>({});
  const [destinationTableId, setDestinationTableId] = useState("");
  const [tableReason, setTableReason] = useState("");

  const isFinalized = ["closed", "cancelled", "voided", "refunded", "paid"].includes(
    String(order.status),
  );

  const items = useMemo(() => order.items ?? [], [order.items]);

  // Group by course so the controls act on a course, which is what the backend
  // endpoint takes. Items without a course number belong to course 1.
  const courses = useMemo(() => {
    const grouped = new Map<number, HospitalityServiceOrderItem[]>();
    for (const item of items) {
      const course = Number(item.course_number ?? 1);
      grouped.set(course, [...(grouped.get(course) ?? []), item]);
    }

    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [items]);

  const { data: tables = [] } = useQuery({
    queryKey: ["hospitality", "tables", "transfer-targets"],
    queryFn: () => fetchHospitalityTables({ per_page: 200 }),
    enabled: canMoveTables && !isFinalized,
  });

  const settled = () => {
    queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
    onChanged?.();
  };

  const courseMutation = useMutation({
    mutationFn: ({ courseNumber, operation }: { courseNumber: number; operation: "hold" | "release" }) =>
      operation === "hold"
        ? holdHospitalityCourse(order.id, courseNumber, {
            reason: "Held from the order detail panel",
            idempotencyKey: newIdempotencyKey(),
          })
        : releaseHospitalityCourse(order.id, courseNumber, {
            idempotencyKey: newIdempotencyKey(),
          }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.operation === "hold"
          ? `Course ${variables.courseNumber} held.`
          : `Course ${variables.courseNumber} released to the kitchen.`,
      );
      settled();
    },
    onError: (error: any) => {
      toast.error(errorMessage(error, "Could not change the course."));
    },
  });

  const seatMutation = useMutation({
    mutationFn: ({ itemId, seat }: { itemId: number; seat: number }) =>
      transferHospitalityOrderItemSeat(order.id, itemId, {
        to_seat_number: seat,
        reason: "Moved from the order detail panel",
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: (_data, variables) => {
      toast.success(`Item moved to seat ${variables.seat}.`);
      setSeatDrafts((current) => ({ ...current, [variables.itemId]: "" }));
      settled();
    },
    onError: (error: any) => {
      toast.error(errorMessage(error, "Could not move the item."));
    },
  });

  const tableMutation = useMutation({
    mutationFn: () =>
      transferHospitalityOrderTable(order.id, {
        destination_location_id: Number(destinationTableId),
        reason: tableReason.trim(),
        idempotencyKey: newIdempotencyKey(),
      }),
    onSuccess: () => {
      toast.success("Order moved to the new table.");
      setDestinationTableId("");
      setTableReason("");
      settled();
    },
    onError: (error: any) => {
      toast.error(errorMessage(error, "Could not move the order."));
    },
  });

  if (!canCourse && !canMoveSeats && !canMoveTables) return null;

  const busy = courseMutation.isPending || seatMutation.isPending || tableMutation.isPending;

  return (
    <div className="space-y-4 rounded-lg border p-4" data-testid="order-coursing-panel">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
        <h4 className="text-sm font-black uppercase tracking-widest">Coursing &amp; Transfers</h4>
      </div>

      {isFinalized ? (
        <p className="text-sm text-muted-foreground" data-testid="coursing-finalized-note">
          This order is {order.status}. Coursing and transfers need the authorized reversal
          workflow.
        </p>
      ) : (
        <>
          {canCourse && (
            <div className="space-y-2" data-testid="course-controls">
              <Label className="text-xs uppercase tracking-widest">Courses</Label>
              {courses.map(([courseNumber, courseItems]) => {
                const held = courseItems.filter(
                  (item) => item.preparation_status === "held",
                ).length;
                const holdable = courseItems.some((item) => item.preparation_status === "new");

                return (
                  <div
                    key={courseNumber}
                    className="flex items-center justify-between gap-3 rounded border px-3 py-2"
                    data-testid={`course-row-${courseNumber}`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold">Course {courseNumber}</span>
                      <span className="text-muted-foreground">
                        {courseItems.length} item{courseItems.length === 1 ? "" : "s"}
                      </span>
                      {held > 0 && (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 py-0 text-[11px] font-black uppercase tracking-widest text-amber-600"
                          data-testid={`course-${courseNumber}-held-badge`}
                        >
                          {held} held
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !holdable}
                        data-testid={`hold-course-${courseNumber}`}
                        onClick={() =>
                          courseMutation.mutate({ courseNumber, operation: "hold" })
                        }
                      >
                        <PauseCircle className="mr-1 h-3.5 w-3.5" />
                        Hold
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || held === 0}
                        data-testid={`release-course-${courseNumber}`}
                        onClick={() =>
                          courseMutation.mutate({ courseNumber, operation: "release" })
                        }
                      >
                        <PlayCircle className="mr-1 h-3.5 w-3.5" />
                        Release
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {canMoveSeats && items.length > 0 && (
            <div className="space-y-2" data-testid="seat-controls">
              <Label className="text-xs uppercase tracking-widest">Seats</Label>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2"
                  data-testid={`seat-row-${item.id}`}
                >
                  <div className="text-sm">
                    <span className="font-semibold">{item.item_name}</span>
                    <span className="ml-2 text-muted-foreground">
                      seat {item.seat_number ?? "shared"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      className="h-8 w-20"
                      aria-label={`Move ${item.item_name} to seat`}
                      data-testid={`seat-input-${item.id}`}
                      value={seatDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setSeatDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy || !seatDrafts[item.id]}
                      data-testid={`move-seat-${item.id}`}
                      onClick={() =>
                        seatMutation.mutate({
                          itemId: item.id,
                          seat: Number(seatDrafts[item.id]),
                        })
                      }
                    >
                      Move
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canMoveTables && (
            <div className="space-y-2" data-testid="table-transfer-controls">
              <Label className="text-xs uppercase tracking-widest" htmlFor="transfer_table">
                Move to another table
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={destinationTableId} onValueChange={setDestinationTableId}>
                  <SelectTrigger id="transfer_table" className="sm:w-56" data-testid="table-transfer-select">
                    <SelectValue placeholder="Destination table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables
                      .filter((table: HospitalityLocation) => table.id !== order.location_id)
                      .map((table: HospitalityLocation) => (
                        <SelectItem
                          key={table.id}
                          value={String(table.id)}
                          data-testid={`table-option-${table.id}`}
                        >
                          {table.label} ({table.status})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Reason (required)"
                  aria-label="Table transfer reason"
                  data-testid="table-transfer-reason"
                  value={tableReason}
                  onChange={(event) => setTableReason(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy || !destinationTableId || !tableReason.trim()}
                  data-testid="table-transfer-submit"
                  onClick={() => tableMutation.mutate()}
                >
                  {tableMutation.isPending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Transfer
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
