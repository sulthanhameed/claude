import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { productsApi, type KhangProduct } from "../lib/api";
import { MENU, type Category, type FoodItem } from "../data/menu";

/**
 * Loads the live menu from Supabase (`products`).
 *
 * The static `MENU` in `src/data/menu.ts` is only a visual fallback for when
 * the project cannot be reached. Cart + checkout require `live === true`
 * because an order must reference real product ids.
 */
interface MenuContextValue {
  items: FoodItem[];
  loading: boolean;
  live: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const MenuContext = createContext<MenuContextValue | null>(null);

const CATEGORY_NAMES: Category[] = [
  "Dim Sum",
  "Noodles & Soups",
  "Rice & Curry",
  "Snacks",
  "Drinks",
];

function toFoodItem(p: KhangProduct): FoodItem {
  return {
    id: p._id,
    slug: p.slug,
    name: p.name,
    chineseName: p.chineseName || "",
    category: (CATEGORY_NAMES.includes(p.category as Category)
      ? p.category
      : "Dim Sum") as Category,
    price: p.price,
    rating: p.rating,
    reviews: p.reviewsCount,
    description: p.description,
    ingredients: p.ingredients || [],
    image: p.image,
    spicy: p.spicy,
    veg: p.veg,
    featured: p.featured,
    prepTime: p.prepTime || "15 min",
  };
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FoodItem[]>(MENU);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { items: products } = await productsApi.list();
      if (products.length > 0) {
        setItems(products.map(toFoodItem));
        setLive(true);
        setError(null);
      } else {
        // Postgres answered, but `products` has no rows yet. The schema went
        // in without the seed, so the fix is the data file, not the code.
        setItems(MENU);
        setLive(false);
        setError(
          "The menu is empty — the database has no dishes. Run supabase/seed-only.sql in the SQL Editor, or `npm run db:check` to see why.",
        );
      }
    } catch (err) {
      setItems(MENU);
      setLive(false);
      setError(
        err instanceof Error
          ? `Could not load the menu from Supabase — ${err.message}`
          : "Could not load the menu from Supabase",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ items, loading, live, error, refresh }),
    [items, loading, live, error, refresh],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used within MenuProvider");
  return ctx;
}
