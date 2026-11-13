import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { SavedProvider } from './contexts/SavedContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute, RoleRoute } from './components/common/Guards';
import { Layout } from './components/common/Layout';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './components/auth/Login';
import Browse from './pages/Browse';

// checkout, orders and the Artist screens load only when visited
const ArtworkPage = lazy(() => import('./pages/ArtworkPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const ArtistInbox = lazy(() => import('./pages/ArtistInbox'));
const NewArtwork = lazy(() => import('./pages/NewArtwork'));
const MyWorks = lazy(() => import('./pages/MyWorks'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const ArtistPage = lazy(() => import('./pages/ArtistPage'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const Privacy = lazy(() => import('./pages/Privacy'));
const InstagramDeletion = lazy(() => import('./pages/InstagramDeletion'));
const InstagramReturn = lazy(() => import('./pages/InstagramReturn'));
const NotFound = lazy(() => import('./pages/NotFound'));


// every route gets its own boundary, so one broken screen never blanks the app
const screen = (el, guard) => (
  <ErrorBoundary>
    <Suspense fallback={<main className="wrap page"><div className="skeleton" style={{ height: 200 }} aria-busy="true" /></main>}>
      {guard ? guard(el) : el}
    </Suspense>
  </ErrorBoundary>
);
const signedIn = (el) => <ProtectedRoute>{el}</ProtectedRoute>;
const artistOnly = (el) => <RoleRoute role="artist">{el}</RoleRoute>;
// eslint-disable-next-line no-unused-vars -- the Admin screens (P09) wrap their routes with this
const adminOnly = (el) => <RoleRoute role="admin">{el}</RoleRoute>;

// an old path keeps its query string and hash
function Moved({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <NotificationsProvider>
            <SavedProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={screen(<Browse />)} />
                <Route path="/browse" element={screen(<Browse />)} />
                <Route path="/artwork/:id" element={screen(<ArtworkPage />)} />
                <Route path="/artist/:id" element={screen(<ArtistPage />)} />
                <Route path="/login" element={screen(<Login />)} />
                <Route path="/legal/privacy" element={screen(<Privacy />)} />
                <Route path="/privacy" element={<Moved to="/legal/privacy" />} />
                <Route path="/instagram-deletion" element={screen(<InstagramDeletion />)} />
                <Route path="/instagram/return" element={screen(<InstagramReturn />)} />
                <Route path="/cart" element={screen(<CartPage />, signedIn)} />
                <Route path="/checkout" element={screen(<CheckoutPage />, signedIn)} />
                <Route path="/wishlist" element={screen(<WishlistPage />, signedIn)} />
                <Route path="/wishlist/:collectionId" element={screen(<WishlistPage />, signedIn)} />
                <Route path="/orders" element={screen(<OrdersPage />, signedIn)} />
                <Route path="/orders/:id" element={screen(<OrderPage />, signedIn)} />
                <Route path="/dashboard/orders" element={screen(<ArtistInbox />, artistOnly)} />
                <Route path="/dashboard/artworks" element={screen(<MyWorks />, artistOnly)} />
                <Route path="/dashboard/artworks/new" element={screen(<NewArtwork />, artistOnly)} />
                <Route path="/dashboard/settings" element={screen(<ProfileEdit />, artistOnly)} />
                <Route path="/dashboard/instagram" element={screen(<ProfileEdit />, artistOnly)} />
                <Route path="/dashboard/works" element={<Moved to="/dashboard/artworks" />} />
                <Route path="/dashboard/new" element={<Moved to="/dashboard/artworks/new" />} />
                <Route path="/dashboard/profile" element={<Moved to="/dashboard/settings" />} />
                <Route path="*" element={screen(<NotFound />)} />
              </Route>
            </Routes>
            </SavedProvider>
          </NotificationsProvider>
        </CartProvider>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
