import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import Loader from '../../components/Loader';
import LoginScreen from '../login';
import SignupScreen from '../signup';
import MarketplaceScreen from '../marketplace';
import Teatro911Screen from '../Teatro911';
import ProfileScreen from '../profile';
import TicketsScreen from '../tickets';
import EventDetailScreen from '../event';
import CheckoutScreen from '../Checkout';
import PurchaseFinishedScreen from '../PurchaseFinished';
import EditProfileScreen from '../editProfile';
import ForgetPasswordScreen from '../forgetPassword';
import DesignSystemDemo from '../DesignSystemDemo';
import { usePageTracking } from '../../hooks/useMetaPixel';
import { 
  onAuthStateChange, 
  logoutUser, 
  getUserData
} from '../../services';

// Dashboard and other pages would be imported here
// import Dashboard from '../dashboard';

// Componente para trackear páginas
const PageTracker: React.FC = () => {
  usePageTracking();
  return null;
};

// Redirect components for legacy routes with parameters
const EventRedirect: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  return <Navigate to={`/evento/${eventId}${location.search}`} replace />;
};

const CheckoutRedirect: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  return <Navigate to={`/compra/${eventId}${location.search}`} replace />;
};

const MainLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isUser, setIsUser] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChange(async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Check user role
        const userData = await getUserData(authUser.uid);
        
        if (userData) {
          // Set user role flags
          setIsAdmin(userData.role === 'ADMIN');
          setIsUser(userData.role === 'USER');
        } else {
          // No user data found
          setIsAdmin(false);
          setIsUser(false);
          // Log out user
          await logoutUser();
          setUser(null);
        }
      } else {
        setIsAdmin(false);
        setIsUser(false);
      }
      
      setIsLoading(false);
    });
    
    // Cleanup the subscription on unmount
    return () => unsubscribe();
  }, []);
  
  if (isLoading) {
    return <Loader size="large" color="accent" fullScreen />;
  }
  
  return (
    <BrowserRouter>
      <PageTracker />
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/iniciar-sesion" 
          element={
            (user && (isAdmin || isUser)) ? <Navigate to="/" /> : <LoginScreen />
          } 
        />
        
        <Route 
          path="/crear-cuenta" 
          element={
            (user && (isAdmin || isUser)) ? <Navigate to="/" /> : <SignupScreen />
          } 
        />
        
        <Route
          path="/olvide-contrasena"
          element={
            (user && (isAdmin || isUser)) ? <Navigate to="/" /> : <ForgetPasswordScreen />
          }
        />
        
        {/* Marketplace as main page */}
        <Route 
          path="/" 
          element={<MarketplaceScreen />} 
        />
        
        {/* Design System Demo */}
        <Route 
          path="/demo-design-system" 
          element={<DesignSystemDemo />} 
        />
        
        {/* Teatro 911 - Themed marketplace */}
        <Route 
          path="/911" 
          element={<Teatro911Screen />} 
        />
        
        {/* Event detail page - now using slug */}
        <Route 
          path="/evento/:slug" 
          element={<EventDetailScreen />} 
        />
        
        {/* Checkout page - now using slug */}
        <Route 
          path="/compra/:slug" 
          element={<CheckoutScreen />} 
        />
        
        {/* Purchase finished page */}
        <Route 
          path="/compra-finalizada" 
          element={<PurchaseFinishedScreen />} 
        />
        
        {/* Protected User Routes */}
        <Route 
          path="/perfil" 
          element={<ProfileScreen />} 
        />
        
        <Route 
          path="/editar-perfil" 
          element={
            user ? <EditProfileScreen /> : <Navigate to="/iniciar-sesion" />
          } 
        />
        
        <Route 
          path="/tickets" 
          element={<TicketsScreen />} 
        />
        
        {/* Protected Admin Routes */}
        <Route 
          path="/administrador" 
          element={
            (user && isAdmin) ? (
              <div>Admin Dashboard - Coming Soon</div>
            ) : (
              <Navigate to="/" />
            )
          } 
        />
        
        {/* Legacy routes redirects for compatibility */}
        <Route path="/login" element={<Navigate to="/iniciar-sesion" />} />
        <Route path="/signup" element={<Navigate to="/crear-cuenta" />} />
        <Route path="/forget-password" element={<Navigate to="/olvide-contrasena" />} />
        <Route path="/event/:eventId" element={<EventRedirect />} />
        <Route path="/checkout/:eventId" element={<CheckoutRedirect />} />
        <Route path="/profile" element={<Navigate to="/perfil" />} />
        <Route path="/edit-profile" element={<Navigate to="/editar-perfil" />} />
        <Route path="/admin" element={<Navigate to="/administrador" />} />
        
        {/* Default Route - Redirect to marketplace */}
        <Route 
          path="*" 
          element={<Navigate to="/" />} 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default MainLayout;
