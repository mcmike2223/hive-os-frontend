export interface WarehouseOverview {
    period: { from: string; to: string };
    stock: {
        on_hand: number;
        reserved: number;
        available: number;
        in_transit: number;
        stock_value: number;
        uncosted_lines: number;
        distinct_products: number;
        stock_lines: number;
        negative_lines: number;
    };
    movements: {
        total: number;
        received_quantity: number;
        issued_quantity: number;
        transfer_quantity: number;
        adjustment_quantity: number;
        net_quantity: number;
    };
    daily_movements: Array<{ date: string; movements: number; received: number; issued: number }>;
    movement_mix: Array<{ type: string; count: number; quantity: number }>;
    capacity: Array<{
        warehouse_id: number;
        name: string;
        code: string;
        is_active: boolean;
        locations: number;
        occupied_locations: number;
        utilisation_percent: number;
        on_hand: number;
    }>;
    expiry_bands: Array<{ key: string; label: string; severity: string; count: number; quantity: number }>;
    top_products: Array<{ product_id: number; on_hand: number; lines: number }>;
    dead_stock: { lines: number; quantity: number; value: number; products: number };
}

export interface Warehouse {
    id: number;
    tenant_id: string;
    name: string;
    code: string;
    type: string;
    is_active: boolean;
    address?: string;
    contact_person?: string;
    phone?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface WarehouseLocation {
    id: number;
    tenant_id: string;
    warehouse_id: number;
    parent_id?: number;
    type: string; // 'zone', 'shelf', 'bin', 'box'
    code: string;
    name?: string;
    description?: string;
    max_weight?: number;
    max_volume?: number;
    is_active: boolean;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
    warehouse?: Warehouse;
    parent?: WarehouseLocation;
    children?: WarehouseLocation[];
}

export interface WarehouseStock {
    id: number;
    tenant_id: string;
    warehouse_location_id: number;
    product_id: number;
    batch_number?: string;
    serial_number?: string;
    expiry_date?: string;
    on_hand: number;
    reserved: number;
    in_transit: number;
    created_at: string;
    updated_at: string;
    location?: WarehouseLocation;
}
