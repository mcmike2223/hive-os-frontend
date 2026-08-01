"use client";

import { Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Table {
  id: number;
  label: string;
  capacity: number;
  status: string;
  table_type?: string;
  zone?: { name: string };
}

interface Props {
  tables: Table[];
  selectedTable: Table | null;
  onSelectTable: (table: Table) => void;
}

export function TableGridSelector({ tables, selectedTable, onSelectTable }: Props) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "occupied":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "reserved":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Dining Tables & Spaces</h2>
        <span className="text-xs text-muted-foreground">{tables.length} tables found</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tables.map((table) => {
          const isSelected = selectedTable?.id === table.id;
          return (
            <button
              key={table.id}
              onClick={() => onSelectTable(table)}
              className={`p-4 rounded-xl border flex flex-col justify-between items-start transition-all active:scale-95 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-lg ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-base text-foreground">{table.label}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getStatusColor(table.status)}`}>
                  {table.status}
                </span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Cap: {table.capacity} guests</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
