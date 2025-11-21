
export enum UserRole {
  CONSUMER = 'CONSUMER',
  SUPPLIER_OWNER = 'SUPPLIER_OWNER',
  SUPPLIER_MANAGER = 'SUPPLIER_MANAGER',
  SUPPLIER_SALES = 'SUPPLIER_SALES'
}

export enum CompanyType {
  SUPPLIER = 'SUPPLIER',
  CONSUMER = 'CONSUMER'
}

export enum LinkStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IN_DELIVERY = 'IN_DELIVERY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum ComplaintStatus {
  OPEN = 'OPEN',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED'
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  company_id?: number;
}

export interface Company {
  id: number;
  name: string;
  type: CompanyType;
  kyb_status: boolean;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Link {
  id: number;
  supplier_id: number;
  consumer_id: number;
  status: LinkStatus;
}

export interface Product {
  id: number;
  supplier_id: number;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  min_order_qty: number;
  is_active: boolean;
  image_url?: string;
}

export interface OrderItem {
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price_at_time: number;
}

export interface Order {
  id: number;
  consumer_id: number;
  supplier_id: number;
  status: OrderStatus;
  total_amount: number;
  items: OrderItem[];
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  message_type: string; // 'TEXT', 'PDF', 'AUDIO', 'IMAGE'
  attachment_url?: string;
  file_name?: string;
  file_size?: number;
  timestamp: string;
}

export interface Complaint {
  id: number;
  order_id: number;
  created_by: number | null;  // User ID who created the complaint
  consumer_id: number;  // Company ID
  handler_id?: number;
  handler_name?: string;  // Email of the handler
  handler_role?: string;  // Role of the handler
  status: ComplaintStatus;
  description: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Connection {
  id: number;
  supplier_id: number;
  consumer_id: number;
  status: string;
  consumer_name: string;
  is_blacklisted: boolean;
}

export interface BlacklistEntry {
  id: number;
  supplier_id: number;
  consumer_id: number;
  blocked_at: string;
  blocked_by: number | null;
  reason: string | null;
  consumer_name: string;
  blocker_email: string | null;
}
