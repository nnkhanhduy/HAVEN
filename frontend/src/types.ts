export type Profile = {
  user_id: string;
  couple_id: string;
  display_name?: string | null;
  role?: string | null;
};

export type Memory = {
  id: string;
  content?: string | null;
  image_url?: string | null;
  image_signed_url?: string | null;
  location?: string | null;
  sentiment?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
};

export type Preference = {
  id: string;
  category: string;
  detail_json: Record<string, unknown>;
  updated_at?: string | null;
};

export type WishlistItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status: string;
};

export type ImportantDate = {
  id: string;
  title: string;
  date_value: string;
  date_type: string;
  notes?: string | null;
};

export type AskResponse = {
  answer: string;
  sources: Memory[];
};
