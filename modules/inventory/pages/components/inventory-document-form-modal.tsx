"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInventoryDocument, fetchInventoryItems } from "@/modules/inventory/api";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

const DOCUMENT_TYPES = [
  { value: "purchase_request", label: "Purchase Request" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "goods_receiving_note", label: "Goods Receiving Note" },
  { value: "production_order", label: "Production Order" },
  { value: "store_voucher", label: "Store Voucher" },
  { value: "finished_goods_transfer", label: "Finished Goods Transfer" },
  { value: "sales_order", label: "Sales Order" },
  { value: "delivery_note", label: "Delivery Note" },
  { value: "goods_return_note", label: "Goods Return Note" },
  { value: "dispatch", label: "Dispatch" },
  { value: "sales_summary", label: "Sales Summary" },
  { value: "waste_voucher", label: "Waste Voucher" },
];

type DocumentItem = {
  id: string;
  inventory_item_id: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  total_price: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function InventoryDocumentFormModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [documentType, setDocumentType] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<DocumentItem[]>([
    { id: "1", inventory_item_id: "", description: "", quantity: "", unit: "", unit_price: "", total_price: "" },
  ]);

  const { data: inventoryItemsData, isLoading: isLoadingItems } = useQuery({
    queryKey: ["inventory", "items"],
    queryFn: () => fetchInventoryItems({ per_page: 100 }),
    enabled: open,
  });

  const inventoryItems = inventoryItemsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createInventoryDocument,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Document created successfully.",
        submittedMessage: "Document submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory", "documents"] });
      handleClose();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to create document.");
    },
  });

  const handleAddItem = () => {
    const newId = String(items.length + 1);
    setItems([...items, { id: newId, inventory_item_id: "", description: "", quantity: "", unit: "", unit_price: "", total_price: "" }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) {
      toast.error("At least one item is required.");
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof DocumentItem, value: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentType) {
      toast.error("Please select a document type.");
      return;
    }

    const validItems = items.filter((item) => item.quantity && parseFloat(item.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("At least one item with a valid quantity is required.");
      return;
    }

    const payload = {
      type: documentType,
      title: title || null,
      notes: notes || null,
      items: validItems.map((item) => ({
        inventory_item_id: item.inventory_item_id || null,
        description: item.description || null,
        quantity: parseFloat(item.quantity),
        unit: item.unit || null,
        unit_price: item.unit_price ? parseFloat(item.unit_price) : null,
        total_price: item.total_price ? parseFloat(item.total_price) : null,
      })),
    };

    createMutation.mutate(payload);
  };

  const handleClose = () => {
    setDocumentType("");
    setTitle("");
    setNotes("");
    setItems([{ id: "1", inventory_item_id: "", description: "", quantity: "", unit: "", unit_price: "", total_price: "" }]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
        <DialogHeader>
          <DialogTitle>Create Inventory Document</DialogTitle>
          <DialogDescription>
            Create a new inventory document with items for approval or direct creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type *</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger id="documentType">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes (optional)"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={item.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item {index + 1}</span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`item-${item.id}-inventory`}>Inventory Item</Label>
                    <Select
                      value={item.inventory_item_id}
                      onValueChange={(value) => handleItemChange(item.id, "inventory_item_id", value)}
                      disabled={isLoadingItems}
                    >
                      <SelectTrigger id={`item-${item.id}-inventory`}>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((invItem: any) => (
                          <SelectItem key={invItem.id} value={String(invItem.id)}>
                            {invItem.name} ({invItem.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`item-${item.id}-description`}>Description</Label>
                    <Input
                      id={`item-${item.id}-description`}
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                      placeholder="Item description"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`item-${item.id}-quantity`}>Quantity *</Label>
                    <Input
                      id={`item-${item.id}-quantity`}
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`item-${item.id}-unit`}>Unit</Label>
                    <Input
                      id={`item-${item.id}-unit`}
                      value={item.unit}
                      onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                      placeholder="e.g., pcs, kg, liters"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`item-${item.id}-unitPrice`}>Unit Price</Label>
                    <Input
                      id={`item-${item.id}-unitPrice`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(item.id, "unit_price", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`item-${item.id}-totalPrice`}>Total Price</Label>
                    <Input
                      id={`item-${item.id}-totalPrice`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.total_price}
                      onChange={(e) => handleItemChange(item.id, "total_price", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Document"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
