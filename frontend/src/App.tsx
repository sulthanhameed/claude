import { useState } from "react";
import type { FoodItem } from "./data/menu";
import { CartProvider, useCart } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { MenuProvider } from "./context/MenuContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import FeaturedCarousel from "./components/FeaturedCarousel";
import MenuSection from "./components/MenuSection";
import ChefSurprise from "./components/ChefSurprise";
import OrderTracking from "./components/OrderTracking";
import Reviews from "./components/Reviews";
import PromoVideo from "./components/PromoVideo";
import TopFoods from "./components/TopFoods";
import Footer from "./components/Footer";
import FoodDetailModal from "./components/FoodDetailModal";
import CartDrawer from "./components/CartDrawer";
import CheckoutModal from "./components/CheckoutModal";
import SearchModal from "./components/SearchModal";
import AuthModal from "./components/AuthModal";
import AdminDashboard from "./components/AdminDashboard";
import MyOrdersModal from "./components/MyOrdersModal";
import ScrollProgressBar from "./components/ScrollProgressBar";
import IntroExperience, { shouldPlayIntro } from "./components/intro/IntroExperience";
import BrandFilmPage, { isBrandFilmRoute } from "./components/intro/BrandFilmPage";
import { CartIcon } from "./components/Icons";

function FloatingCartButton() {
  const { count, openCart, total } = useCart();
  if (count === 0) return null;
  return (
    <button
      onClick={openCart}
      className="fixed bottom-5 right-5 z-30 flex items-center gap-3 rounded-full bg-khang-ink px-6 py-3.5 text-white shadow-[0_15px_40px_rgba(10,10,10,0.25)] transition hover:scale-105 hover:bg-khang-red animate-fade-up sm:hidden"
    >
      <CartIcon className="h-5 w-5" />
      <span className="font-mono text-sm font-semibold tracking-wider">
        {count} · ₹{total}
      </span>
    </button>
  );
}

function Shell() {
  const [activeItem, setActiveItem] = useState<FoodItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  return (
    <div className="min-h-screen bg-khang-bg">
      <ScrollProgressBar />
      <Navbar
        onSearch={() => setSearchOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onOpenOrders={() => setOrdersOpen(true)}
      />

      <main>
        <Hero />
        <FeaturedCarousel />
        <MenuSection onView={setActiveItem} />
        <PromoVideo />
        <TopFoods onView={setActiveItem} />
        <ChefSurprise onView={setActiveItem} />
        <OrderTracking />
        <Reviews />
      </main>

      <Footer />

      <FoodDetailModal item={activeItem} onClose={() => setActiveItem(null)} />
      <CartDrawer onCheckout={() => setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onPick={setActiveItem} />
      <AuthModal />
      <AdminDashboard open={adminOpen} onClose={() => setAdminOpen(false)} />
      <MyOrdersModal open={ordersOpen} onClose={() => setOrdersOpen(false)} />
      <FloatingCartButton />
    </div>
  );
}

export default function App() {
  // The brand film has a page of its own; everything else is the restaurant.
  return isBrandFilmRoute() ? <BrandFilmPage /> : <Site />;
}

function Site() {
  // Plays once per browser session; `?intro=1` replays it, `?intro=0` skips it.
  const [introActive, setIntroActive] = useState(() => shouldPlayIntro());

  return (
    <>
      <div inert={introActive ? true : undefined}>
        <AuthProvider>
          <MenuProvider>
            <CartProvider>
              <Shell />
            </CartProvider>
          </MenuProvider>
        </AuthProvider>
      </div>

      {introActive && <IntroExperience onDone={() => setIntroActive(false)} />}
    </>
  );
}
