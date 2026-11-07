import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute, RoleRoute } from './components/common/Guards';
import { Layout } from './components/common/Layout';
import { Login } from './components/auth/Login';
import Browse from './pages/Browse';

// checkout, orders and the Artist screens load only when visited
const ArtworkPage = lazy(() => import('./pages/ArtworkPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const ArtistPages = lazy(() => import('./pages/ArtistPages').then((m) => ({ default: m.ArtistInbox })));
const NewArtwork = lazy(() => import('./pages/ArtistPages').then((m) => ({ default: m.NewArtwork })));

const NotFound = () => (
  <main className="wrap page"><div className="empty"><h3>We couldn’t find that page</h3><Link className="btn btn-primary" to="/">Go home</Link></div></main>
);

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <NotificationsProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={screen(<Browse />)} />
                <Route path="/browse" element={screen(<Browse />)} />
                <Route path="/artwork/:id" element={screen(<ArtworkPage />)} />
                <Route path="/login" element={screen(<Login />)} />
                <Route path="/cart" element={screen(<CartPage />, signedIn)} />
                <Route path="/checkout" element={screen(<CheckoutPage />, signedIn)} />
                <Route path="/orders" element={screen(<OrdersPage />, signedIn)} />
                <Route path="/orders/:id" element={screen(<OrderPage />, signedIn)} />
                <Route path="/dashboard/orders" element={screen(<ArtistPages />, artistOnly)} />
                <Route path="/dashboard/new" element={screen(<NewArtwork />, artistOnly)} />
                <Route path="*" element={screen(<NotFound />)} />
              </Route>
            </Routes>
          </NotificationsProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
