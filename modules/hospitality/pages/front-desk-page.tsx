"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, BrushCleaning, CalendarPlus, DoorOpen, Loader2, Plus, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  checkInHospitalityStay,
  checkOutHospitalityStay,
  createHospitalityRoom,
  createHospitalityRoomType,
  createHospitalityStay,
  fetchHospitalityHousekeeping,
  fetchHospitalityRooms,
  fetchHospitalityRoomTypes,
  fetchHospitalityStays,
  updateHospitalityHousekeepingTask,
} from "@/modules/hospitality/api";
import type { HospitalityHousekeepingTask, HospitalityRoom, HospitalityStay } from "@/modules/hospitality/types";

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
};

const roomStatusLabel: Record<HospitalityRoom["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  dirty: "Needs cleaning",
  cleaning: "Cleaning",
  inspected: "Inspected",
  maintenance: "Maintenance",
  out_of_service: "Out of service",
};

export default function FrontDeskPage() {
  const queryClient = useQueryClient();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<"type" | "room">("type");
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState("");

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ["hospitality", "rooms"],
    queryFn: () => fetchHospitalityRooms({ active_only: true }),
  });
  const { data: roomTypes = [] } = useQuery({
    queryKey: ["hospitality", "room-types"],
    queryFn: fetchHospitalityRoomTypes,
  });
  const { data: stays = [], isLoading: staysLoading } = useQuery({
    queryKey: ["hospitality", "stays"],
    queryFn: () => fetchHospitalityStays({ per_page: 100 }),
  });
  const { data: housekeeping = [] } = useQuery({
    queryKey: ["hospitality", "housekeeping"],
    queryFn: () => fetchHospitalityHousekeeping(),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hospitality", "rooms"] }),
      queryClient.invalidateQueries({ queryKey: ["hospitality", "room-types"] }),
      queryClient.invalidateQueries({ queryKey: ["hospitality", "stays"] }),
      queryClient.invalidateQueries({ queryKey: ["hospitality", "housekeeping"] }),
    ]);
  };

  const createType = useMutation({
    mutationFn: createHospitalityRoomType,
    onSuccess: async (roomType) => {
      await refresh();
      setSelectedRoomTypeId(String(roomType.id));
      setSetupStep("room");
      toast.success("Room type created");
    },
    onError: () => toast.error("Room type could not be created"),
  });

  const createRoom = useMutation({
    mutationFn: createHospitalityRoom,
    onSuccess: async () => {
      await refresh();
      setSetupOpen(false);
      toast.success("Room added to inventory");
    },
    onError: () => toast.error("Room could not be added"),
  });

  const createStay = useMutation({
    mutationFn: createHospitalityStay,
    onSuccess: async () => {
      await refresh();
      setBookingOpen(false);
      toast.success("Booking confirmed");
    },
    onError: () => toast.error("Booking could not be created. Check room availability and guest capacity."),
  });

  const stayAction = useMutation({
    mutationFn: ({ stay, action }: { stay: HospitalityStay; action: "check-in" | "check-out" }) =>
      action === "check-in" ? checkInHospitalityStay(stay.id) : checkOutHospitalityStay(stay.id),
    onSuccess: async (_, variables) => {
      await refresh();
      toast.success(variables.action === "check-in" ? "Guest checked in" : "Guest checked out; turnover task created");
    },
    onError: () => toast.error("The stay could not be updated. Checkout requires a zero folio balance."),
  });

  const housekeepingAction = useMutation({
    mutationFn: ({ task, status }: { task: HospitalityHousekeepingTask; status: string }) =>
      updateHospitalityHousekeepingTask(task.id, { status }),
    onSuccess: async () => {
      await refresh();
      toast.success("Housekeeping status updated");
    },
    onError: () => toast.error("That housekeeping transition is not allowed"),
  });

  const counts = useMemo(() => ({
    available: rooms.filter((room) => room.status === "available").length,
    occupied: rooms.filter((room) => room.status === "occupied").length,
    arrivals: stays.filter((stay) => stay.arrival_date.slice(0, 10) === today() && stay.status === "confirmed").length,
    departures: stays.filter((stay) => stay.departure_date.slice(0, 10) === today() && stay.status === "checked_in").length,
  }), [rooms, stays]);

  const submitRoomType = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createType.mutate({
      code: data.get("code"),
      name: data.get("name"),
      max_adults: Number(data.get("max_adults")),
      max_children: Number(data.get("max_children")),
      base_rate: Number(data.get("base_rate")),
      is_active: true,
    });
  };

  const submitRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createRoom.mutate({
      room_type_id: Number(data.get("room_type_id")),
      room_number: data.get("room_number"),
      floor: data.get("floor") || null,
      status: "available",
      is_active: true,
    });
  };

  const submitBooking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    createStay.mutate({
      room_id: Number(data.get("room_id")),
      guest_name: data.get("guest_name"),
      guest_phone: data.get("guest_phone") || null,
      guest_email: data.get("guest_email") || null,
      arrival_date: data.get("arrival_date"),
      departure_date: data.get("departure_date"),
      adults: Number(data.get("adults")),
      children: Number(data.get("children")),
      status: "confirmed",
      special_requests: data.get("special_requests") || null,
    });
  };

  const busy = roomsLoading || staysLoading;

  return (
    <main className="space-y-6 p-4 pb-20 sm:p-6 [&_button]:focus-visible:ring-amber-700 [&_input]:border-slate-500 [&_input]:focus-visible:ring-amber-700 [&_[data-slot=select-trigger]]:border-slate-500 [&_[data-slot=select-trigger]]:focus-visible:ring-amber-700">
      <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lodging operations</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Hotel front desk</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Control room inventory, arrivals, departures, guest stays, folios, and housekeeping from one shift-ready workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus aria-hidden="true" className="mr-2 h-4 w-4" />Set up rooms</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set up room inventory</DialogTitle>
                <DialogDescription>Create a sellable room type, then add a physical room.</DialogDescription>
              </DialogHeader>
              {setupStep === "type" ? (
                <form className="space-y-4" onSubmit={submitRoomType}>
                  <Field id="room-type-code" label="Room type code"><Input id="room-type-code" name="code" required placeholder="DELUXE" /></Field>
                  <Field id="room-type-name" label="Room type name"><Input id="room-type-name" name="name" required placeholder="Deluxe king" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="max-adults" label="Maximum adults"><Input id="max-adults" name="max_adults" type="number" min="1" defaultValue="2" required /></Field>
                    <Field id="max-children" label="Maximum children"><Input id="max-children" name="max_children" type="number" min="0" defaultValue="0" required /></Field>
                  </div>
                  <Field id="base-rate" label="Base nightly rate"><Input id="base-rate" name="base_rate" type="number" min="0" step="0.01" required /></Field>
                  <Button className="w-full" type="submit" disabled={createType.isPending}>Save room type</Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={submitRoom}>
                  <div className="space-y-2">
                    <Label htmlFor="room-type">Room type</Label>
                    <Select name="room_type_id" value={selectedRoomTypeId} onValueChange={setSelectedRoomTypeId} required>
                      <SelectTrigger id="room-type"><SelectValue placeholder="Choose room type" /></SelectTrigger>
                      <SelectContent>{roomTypes.map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Field id="room-number" label="Room number"><Input id="room-number" name="room_number" required placeholder="204" /></Field>
                  <Field id="room-floor" label="Floor (optional)"><Input id="room-floor" name="floor" placeholder="Second floor" /></Field>
                  <Button className="w-full" type="submit" disabled={createRoom.isPending || !selectedRoomTypeId}>Add room</Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
            <DialogTrigger asChild>
              <Button disabled={rooms.length === 0}><CalendarPlus aria-hidden="true" className="mr-2 h-4 w-4" />New booking</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create guest booking</DialogTitle>
                <DialogDescription>Only active, serviceable rooms are accepted; overlapping dates are rejected by the server.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submitBooking}>
                <div className="space-y-2">
                  <Label htmlFor="booking-room">Room</Label>
                  <Select name="room_id" required>
                    <SelectTrigger id="booking-room"><SelectValue placeholder="Choose an available room" /></SelectTrigger>
                    <SelectContent>{rooms.filter((room) => room.is_active && !["maintenance", "out_of_service"].includes(room.status)).map((room) => <SelectItem key={room.id} value={String(room.id)}>Room {room.room_number} · {room.room_type.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Field id="guest-name" label="Guest name"><Input id="guest-name" name="guest_name" autoComplete="name" required /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="guest-phone" label="Guest phone"><Input id="guest-phone" name="guest_phone" type="tel" autoComplete="tel" /></Field>
                  <Field id="guest-email" label="Guest email"><Input id="guest-email" name="guest_email" type="email" autoComplete="email" /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="arrival-date" label="Arrival date"><Input id="arrival-date" name="arrival_date" type="date" min={today()} defaultValue={today()} required /></Field>
                  <Field id="departure-date" label="Departure date"><Input id="departure-date" name="departure_date" type="date" min={tomorrow()} defaultValue={tomorrow()} required /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="guest-adults" label="Adults"><Input id="guest-adults" name="adults" type="number" min="1" defaultValue="1" required /></Field>
                  <Field id="guest-children" label="Children"><Input id="guest-children" name="children" type="number" min="0" defaultValue="0" required /></Field>
                </div>
                <Field id="special-requests" label="Special requests (optional)"><Input id="special-requests" name="special_requests" /></Field>
                <Button className="w-full" type="submit" disabled={createStay.isPending}>Confirm booking</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section aria-labelledby="shift-snapshot-heading">
        <h2 id="shift-snapshot-heading" className="sr-only">Shift snapshot</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Snapshot label="Available rooms" value={counts.available} icon={BedDouble} />
          <Snapshot label="Occupied rooms" value={counts.occupied} icon={DoorOpen} />
          <Snapshot label="Arrivals today" value={counts.arrivals} icon={CalendarPlus} />
          <Snapshot label="Departures today" value={counts.departures} icon={ReceiptText} />
        </div>
      </section>

      {busy ? (
        <div role="status" className="flex min-h-60 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />Loading front-desk operations…
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Room board</CardTitle>
              <CardDescription>Live sellable inventory and operational condition.</CardDescription>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? <EmptyState title="No rooms configured" description="Use Set up rooms to create your first room type and room." /> : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((room) => (
                    <article key={room.id} className="rounded-xl border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-bold">Room {room.room_number}</h3><p className="text-sm text-muted-foreground">{room.room_type.name}{room.floor ? ` · ${room.floor}` : ""}</p></div>
                        <Badge variant="outline">{roomStatusLabel[room.status]}</Badge>
                      </div>
                      <p className="mt-4 text-sm font-semibold">ETB {Number(room.room_type.base_rate).toLocaleString()} / night</p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Housekeeping queue</CardTitle><CardDescription>Room readiness is updated only after task verification.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {housekeeping.filter((task) => !["verified", "cancelled"].includes(task.status)).length === 0 ? <EmptyState title="No open turnover tasks" description="Checkout tasks will appear here automatically." /> : housekeeping.filter((task) => !["verified", "cancelled"].includes(task.status)).map((task) => (
                <article key={task.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">Room {task.room.room_number}</h3><p className="text-sm text-muted-foreground">{task.task_type.replaceAll("_", " ")}</p></div><Badge variant={task.priority === "urgent" ? "destructive" : "outline"}>{task.status.replaceAll("_", " ")}</Badge></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.status === "open" && <Button size="sm" variant="outline" onClick={() => housekeepingAction.mutate({ task, status: "in_progress" })}>Start cleaning</Button>}
                    {task.status === "in_progress" && <Button size="sm" variant="outline" onClick={() => housekeepingAction.mutate({ task, status: "completed" })}>Mark completed</Button>}
                    {task.status === "completed" && <Button size="sm" onClick={() => housekeepingAction.mutate({ task, status: "verified" })}>Verify room ready</Button>}
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Guest stays</CardTitle><CardDescription>Arrivals, in-house guests, departures, and completed stays.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Guest stays ordered by arrival date.</TableCaption>
            <TableHeader><TableRow><TableHead scope="col">Confirmation</TableHead><TableHead scope="col">Guest</TableHead><TableHead scope="col">Room</TableHead><TableHead scope="col">Dates</TableHead><TableHead scope="col">Status</TableHead><TableHead scope="col">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {stays.map((stay) => (
                <TableRow key={stay.id}>
                  <TableCell className="font-mono text-xs">{stay.confirmation_code}</TableCell>
                  <TableCell className="font-medium">{stay.guest_name}</TableCell>
                  <TableCell>{stay.room?.room_number ?? "—"}</TableCell>
                  <TableCell>{stay.arrival_date.slice(0, 10)} → {stay.departure_date.slice(0, 10)}</TableCell>
                  <TableCell><Badge variant="outline">{stay.status.replaceAll("_", " ")}</Badge></TableCell>
                  <TableCell>
                    {stay.status === "confirmed" && <Button size="sm" onClick={() => stayAction.mutate({ stay, action: "check-in" })}>Check in</Button>}
                    {stay.status === "checked_in" && <Button size="sm" variant="outline" onClick={() => stayAction.mutate({ stay, action: "check-out" })}>Check out</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {stays.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No stays have been booked yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Snapshot({ label, value, icon: Icon }: { label: string; value: number; icon: typeof BedDouble }) {
  return <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div><div className="rounded-xl border bg-muted p-3"><Icon aria-hidden="true" className="h-5 w-5" /></div></CardContent></Card>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed p-8 text-center"><BrushCleaning aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}
