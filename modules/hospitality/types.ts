export type HospitalityStaff = {
  id: number;
  name: string;
  email: string;
  avatar_path?: string | null;
};

export type HospitalityZone = {
  id: number;
  tenant_id: string;
  name: string;
  description?: string | null;
  locations_count?: number;
  locations?: HospitalityLocation[];
};

export type HospitalityLocation = {
  id: number;
  tenant_id: string;
  zone_id?: number | null;
  label: string;
  capacity: number;
  min_spend: string;
  status: "available" | "reserved" | "occupied" | "dirty";
  assigned_staff_id?: number | null;
  table_type: string;
  is_active: boolean;
  notes?: string | null;
  layout_x?: string | null;
  layout_y?: string | null;
  layout_width?: string | null;
  layout_height?: string | null;
  layout_rotation?: string | null;
  grid_position?: { x: number; y: number } | null;
  upcoming_reservations_count?: number;
  staff?: HospitalityStaff | null;
  zone?: HospitalityZone | null;
};

export type HospitalityReservation = {
  id: number;
  location_id: number;
  event_id?: number | null;
  customer_profile_id?: number | null;
  reservation_code?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  reservation_time: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  guest_count: number;
  special_requests?: string | null;
  source?: string | null;
  expected_spend?: string | null;
  cancellation_reason?: string | null;
  location?: {
    id: number;
    label: string;
    status?: "available" | "reserved" | "occupied" | "dirty";
  } | null;
  host?: HospitalityStaff | null;
};

export type HospitalityServiceOrderItem = {
  id: number;
  menu_item_id?: number | null;
  inventory_item_id?: number | null;
  item_name: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  pricing_snapshot?: Record<string, unknown> | null;
  currency?: string | null;
  seat_number?: number | null;
  course_number?: number | null;
  preparation_status?: string | null;
  station_id?: number | null;
  notes?: string | null;
  is_comp?: boolean;
  comp_reason?: string | null;
  stock_deducted?: boolean;
};

export type HospitalityServiceOrder = {
  id: number;
  order_number: string;
  location_id: number;
  reservation_id?: number | null;
  status: "pending" | "preparing" | "served" | "closed" | "cancelled";
  notes?: string | null;
  total_amount: string;
  served_by_id?: number | null;
  created_at?: string;
  updated_at?: string;
  location?: {
    id: number;
    name?: string;
    label?: string;
    table_type?: string;
  } | null;
  reservation?: HospitalityReservation | null;
  served_by?: HospitalityStaff | null;
  items: HospitalityServiceOrderItem[];
};

export type HospitalityMenuCategory = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  items?: HospitalityMenuItem[];
};

export type HospitalityModifierOption = {
  id: number;
  modifier_group_id: number;
  name: string;
  price_adjustment?: string | number | null;
  cost_adjustment?: string | number | null;
  is_available?: boolean;
  sort_order?: number | null;
};

export type HospitalityModifierGroup = {
  id: number;
  name: string;
  description?: string | null;
  min_selections?: number | null;
  max_selections?: number | null;
  is_required?: boolean;
  is_active?: boolean;
  options?: HospitalityModifierOption[];
};

export type HospitalityMenuItemVariant = {
  id: number;
  menu_item_id: number;
  name: string;
  sku?: string | null;
  price: string | number;
  cost_price?: string | number | null;
  is_available?: boolean;
  sort_order?: number | null;
};

export type HospitalityMenuItem = {
  id: number;
  category_id: number;
  inventory_item_id?: number | null;
  name: string;
  description?: string | null;
  price: string;
  cost_price?: string | null;
  is_available: boolean;
  is_featured: boolean;
  preparation_time_minutes?: number | null;
  allergens?: string[] | null;
  tags?: string[] | null;
  image_url?: string | null;
  model_3d_url?: string | null;
  sort_order?: number | null;
  category?: HospitalityMenuCategory | null;
  variants?: HospitalityMenuItemVariant[];
  modifier_groups?: HospitalityModifierGroup[];
  modifierGroups?: HospitalityModifierGroup[];
};

export type HospitalityEvent = {
  id: number;
  name: string;
  description?: string | null;
  event_type: "party" | "private" | "corporate" | "promotion" | "live_music" | "other";
  start_at: string;
  end_at: string;
  is_private: boolean;
  min_guests?: number | null;
  max_guests?: number | null;
  ticket_price?: string | null;
  status: "draft" | "published" | "cancelled" | "completed";
  organizer_id?: number | null;
  cover_image_url?: string | null;
  notes?: string | null;
  organizer?: HospitalityStaff | null;
  blocked_locations_count?: number;
  reservations_count?: number;
};

export type HospitalityStaffShift = {
  id: number;
  staff_id: number;
  shift_date: string;
  start_at: string;
  end_at: string;
  zone?: string | null;
  role?: "host" | "waiter" | "bartender" | "chef" | "manager" | "security" | "other" | null;
  is_confirmed: boolean;
  notes?: string | null;
  staff?: HospitalityStaff | null;
  created_by?: HospitalityStaff | null;
};

export type HospitalityCustomer = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  date_of_birth?: string | null;
  tier?: "bronze" | "silver" | "gold" | "platinum" | "none" | null;
  preferences?: string[] | null;
  allergies?: string[] | null;
  notes?: string | null;
  loyalty_points: number;
  total_spend?: string;
  last_visit_at?: string | null;
  reservations_count?: number;
};

export type HospitalityWaitlistEntry = {
  id: number;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  preferred_zone?: string | null;
  notes?: string | null;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show";
  estimated_wait_minutes?: number | null;
  seated_at?: string | null;
  reservation_id?: number | null;
  created_at: string;
  reservation?: {
    id: number;
    reservation_code: string;
  } | null;
};

export type HospitalityFeedback = {
  id: number;
  reservation_id?: number | null;
  service_order_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  rating: number;
  food_rating?: number | null;
  service_rating?: number | null;
  ambiance_rating?: number | null;
  comment?: string | null;
  tags?: string[] | null;
  is_published: boolean;
  response?: string | null;
  responded_at?: string | null;
  responded_by_id?: number | null;
  created_at: string;
  reservation?: {
    id: number;
    reservation_code: string;
  } | null;
  respondedBy?: {
    id: number;
    name: string;
    email: string;
  } | null;
};



export type HospitalityOverview = {
  tables: {
    total: number;
    available: number;
    reserved: number;
    occupied: number;
    active: number;
  };
  reservations: {
    today_total: number;
    pending: number;
    confirmed: number;
    completed_today: number;
    cancelled_today: number;
  };
  orders: {
    open: number;
    closed_today: number;
    revenue_today: number;
  };
  upcoming_reservations: HospitalityReservation[];
  analytics?: {
    guest_arrivals?: { status: string; count: number }[];
    promoter_stats?: HospitalityPromoterCommission[];
    popular_items?: { name: string; quantity: number }[];
    table_status_breakdown?: { status: string; count: number }[];
    table_type_breakdown?: { type: string; count: number }[];
    revenue_trend?: { date: string; revenue: number }[];
    busy_hours?: { hour: string; count: number }[];
    weekly_reservations_trend?: { date: string; count: number }[];
    comps_breakdown?: { reason: string; value: number }[];
  };
  financials?: {
    daily: { income: number; expenses: number; comps: number; net_revenue: number };
    weekly: { income: number; expenses: number; comps: number; net_revenue: number };
    monthly: { income: number; expenses: number; comps: number; net_revenue: number };
  };
  business_type?: string;
};

export type HospitalityGuestList = {
  id: number;
  tenant_id: string;
  promoter_id?: number | null;
  guest_name: string;
  expected_party_size: number;
  actual_arrived_count: number;
  status: "pending" | "arrived" | "no-show";
  promoter?: {
    id: number;
    name: string;
  } | null;
  created_at: string;
};

export type HospitalityPromoterCommission = {
  id: number;
  tenant_id: string;
  promoter_id: number;
  date: string;
  total_guests_brought: number;
  commission_earned: string;
  status: "unpaid" | "paid";
  promoter?: {
    id: number;
    name: string;
  } | null;
};

export type HospitalityRoomType = {
  id: number;
  code: string;
  name: string;
  max_adults: number;
  max_children: number;
  base_rate: string;
  amenities?: string[] | null;
  is_active: boolean;
  description?: string | null;
  rooms_count?: number;
};

export type HospitalityRoom = {
  id: number;
  room_type_id: number;
  room_number: string;
  floor?: string | null;
  status: "available" | "reserved" | "occupied" | "dirty" | "cleaning" | "inspected" | "maintenance" | "out_of_service";
  is_active: boolean;
  notes?: string | null;
  room_type: HospitalityRoomType;
  stays?: HospitalityStay[];
};

export type HospitalityFolioEntry = {
  id: number;
  stay_id: number;
  entry_type: "charge" | "payment" | "refund" | "adjustment";
  category: string;
  description: string;
  amount: string;
  payment_method?: string | null;
  reference?: string | null;
  business_date: string;
};

export type HospitalityStay = {
  id: number;
  room_id: number;
  confirmation_code: string;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
  arrival_date: string;
  departure_date: string;
  status: "tentative" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  adults: number;
  children: number;
  nightly_rate: string;
  tax_rate: string;
  deposit_amount: string;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  special_requests?: string | null;
  room: HospitalityRoom;
  folio_entries?: HospitalityFolioEntry[];
  folio_balance?: number;
  nights?: number;
};

export type HospitalityHousekeepingTask = {
  id: number;
  room_id: number;
  stay_id?: number | null;
  task_type: "checkout_clean" | "stayover_clean" | "inspection" | "maintenance" | "deep_clean";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "assigned" | "in_progress" | "completed" | "verified" | "cancelled";
  assigned_to_id?: number | null;
  due_at?: string | null;
  notes?: string | null;
  room: HospitalityRoom;
  stay?: Pick<HospitalityStay, "id" | "guest_name" | "arrival_date" | "departure_date"> | null;
  assigned_to?: HospitalityStaff | null;
};
