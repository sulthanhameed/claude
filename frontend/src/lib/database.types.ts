/**
 * The database, as TypeScript.
 *
 * `createClient<Database>()` in `supabase.ts` turns every `from("products")`,
 * `.eq("category", …)` and `rpc("place_order", …)` into a checked query: a
 * column that does not exist, or an argument with the wrong name, is a
 * compile error rather than a 400 at runtime.
 *
 * Keep this file in step with `supabase/migrations/`. When the schema changes,
 * regenerate it from the live project instead of editing by hand:
 *
 *   npm run types        (supabase gen types typescript --project-id …
 *                         > src/lib/database.types.ts)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** `public.user_role` */
export type UserRole = "user" | "admin";
/** `public.order_status` */
export type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
/** `public.payment_method` */
export type PaymentMethod = "upi" | "card" | "wallet" | "cod";
/** `public.payment_status` */
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
/** `public.payment_gateway` */
export type PaymentGateway = "razorpay" | "cod" | "none";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          chinese_name: string | null;
          category: string;
          price: number;
          description: string;
          ingredients: string[];
          image: string;
          images: string[];
          rating: number;
          reviews_count: number;
          spicy: number;
          veg: boolean;
          featured: boolean;
          prep_time: string;
          in_stock: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          chinese_name?: string | null;
          category: string;
          price: number;
          description?: string;
          ingredients?: string[];
          image?: string;
          images?: string[];
          rating?: number;
          reviews_count?: number;
          spicy?: number;
          veg?: boolean;
          featured?: boolean;
          prep_time?: string;
          in_stock?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          chinese_name?: string | null;
          category?: string;
          price?: number;
          description?: string;
          ingredients?: string[];
          image?: string;
          images?: string[];
          rating?: number;
          reviews_count?: number;
          spicy?: number;
          veg?: boolean;
          featured?: boolean;
          prep_time?: string;
          in_stock?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      reviews: {
        Row: {
          id: string;
          user_id: string | null;
          product_id: string | null;
          rating: number;
          body: string;
          user_name: string | null;
          location: string | null;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          product_id?: string | null;
          rating: number;
          body: string;
          user_name?: string | null;
          location?: string | null;
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          product_id?: string | null;
          rating?: number;
          body?: string;
          user_name?: string | null;
          location?: string | null;
          verified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      orders: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          customer_name: string | null;
          customer_phone: string | null;
          customer_email: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          subtotal: number;
          tax: number;
          delivery: number;
          discount: number;
          total: number;
          payment_method: PaymentMethod;
          payment_gateway: PaymentGateway;
          payment_status: PaymentStatus;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          razorpay_signature: string | null;
          paid_at: string | null;
          refunded_at: string | null;
          refund_id: string | null;
          status: OrderStatus;
          estimated_delivery: string | null;
          delivered_at: string | null;
          customer_email_sent_at: string | null;
          owner_email_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          subtotal: number;
          tax: number;
          delivery?: number;
          discount?: number;
          total: number;
          payment_method: PaymentMethod;
          payment_gateway?: PaymentGateway;
          payment_status?: PaymentStatus;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          razorpay_signature?: string | null;
          paid_at?: string | null;
          refunded_at?: string | null;
          refund_id?: string | null;
          status?: OrderStatus;
          estimated_delivery?: string | null;
          delivered_at?: string | null;
          customer_email_sent_at?: string | null;
          owner_email_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          subtotal?: number;
          tax?: number;
          delivery?: number;
          discount?: number;
          total?: number;
          payment_method?: PaymentMethod;
          payment_gateway?: PaymentGateway;
          payment_status?: PaymentStatus;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          razorpay_signature?: string | null;
          paid_at?: string | null;
          refunded_at?: string | null;
          refund_id?: string | null;
          status?: OrderStatus;
          estimated_delivery?: string | null;
          delivered_at?: string | null;
          customer_email_sent_at?: string | null;
          owner_email_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          name: string;
          chinese_name: string | null;
          image: string | null;
          price: number;
          qty: number;
          position: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          name: string;
          chinese_name?: string | null;
          image?: string | null;
          price: number;
          qty: number;
          position?: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          name?: string;
          chinese_name?: string | null;
          image?: string | null;
          price?: number;
          qty?: number;
          position?: number;
        };
        Relationships: [];
      };

      order_tracking: {
        Row: {
          id: string;
          order_id: string;
          stage: OrderStatus;
          note: string | null;
          at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          stage: OrderStatus;
          note?: string | null;
          at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          stage?: OrderStatus;
          note?: string | null;
          at?: string;
        };
        Relationships: [];
      };

      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          source: string;
          active: boolean;
          subscribed_at: string;
          unsubscribed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string;
          active?: boolean;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          source?: string;
          active?: boolean;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      order_payload: { Args: { p_order_id: string }; Returns: Json };
      place_order: {
        Args: {
          p_user: string;
          p_items: Json;
          p_customer: Json;
          p_address: Json;
          p_payment_method: string;
        };
        Returns: Json;
      };
      mark_order_paid: {
        Args: {
          p_order_id: string;
          p_razorpay_order_id: string | null;
          p_payment_id: string | null;
          p_signature: string | null;
        };
        Returns: Json;
      };
      mark_order_emailed: {
        Args: { p_order_id: string; p_audience: string };
        Returns: undefined;
      };
      mark_order_refunded: {
        Args: { p_order_id: string; p_refund_id: string };
        Returns: Json;
      };
      mark_order_failed: { Args: { p_order_id: string }; Returns: Json };
      track_order: { Args: { p_order_id: string }; Returns: Json };
      my_orders: { Args: Record<string, never>; Returns: Json[] };
      get_my_order: { Args: { p_order_id: string }; Returns: Json };
      admin_list_orders: { Args: { p_status?: string | null }; Returns: Json[] };
      admin_set_order_status: {
        Args: { p_order: string; p_status: string; p_note?: string | null };
        Returns: Json;
      };
      subscribe_newsletter: {
        Args: { p_email: string; p_source?: string };
        Returns: Json;
      };
    };

    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      payment_gateway: PaymentGateway;
    };

    CompositeTypes: Record<string, never>;
  };
}
