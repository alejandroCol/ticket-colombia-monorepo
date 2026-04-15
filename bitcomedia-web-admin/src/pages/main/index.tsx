import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import LoginScreen from '@pages/login';
import { 
  onAuthStateChange, 
  logoutUser, 
  hasAdminAccess,
  hasPanelAccess,
  isSuperAdmin,
} from '@services';
import DashboardScreen from '@pages/dashboard';
import EventFormScreen from '@pages/EventForm';
import TicketValidationScreen from '@pages/TicketValidation';
import ConfigScreen from '@pages/Config';
import BannersScreen from '@pages/Banners';
import EventStatsScreen from '@pages/EventStats';
import EventTicketsScreen from '@pages/EventTickets';
import EventPromotersScreen from '@pages/EventPromoters';
import EventWidgetEmbedScreen from '@pages/EventWidgetEmbed';
import BalanceScreen from '@pages/Balance';
import ScanTicketsScreen from '@pages/ScanTickets';
import TaquillaSaleScreen from '@pages/TaquillaSale';
import AccountChangePasswordScreen from '@pages/AccountChangePassword';
import SuperAdminEarningsScreen from '@pages/SuperAdminEarnings';
import SuperAdminPartnersScreen from '@pages/SuperAdminPartners';
import SuperAdminAuditLogScreen from '@pages/SuperAdminAuditLog';

// Dashboard and other pages would be imported here
// import Dashboard from '../dashboard';

const MainLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [fullAdmin, setFullAdmin] = useState<boolean>(false);
  const [panelOk, setPanelOk] = useState<boolean>(false);
  const [superAdmin, setSuperAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChange(async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        const [adminAccess, panelAccess, superA] = await Promise.all([
          hasAdminAccess(authUser.uid),
          hasPanelAccess(authUser.uid),
          isSuperAdmin(authUser.uid),
        ]);
        setFullAdmin(adminAccess);
        setPanelOk(panelAccess);
        setSuperAdmin(superA);
        
        if (!panelAccess) {
          await logoutUser();
          setUser(null);
          setFullAdmin(false);
          setPanelOk(false);
          setSuperAdmin(false);
        }
      } else {
        setFullAdmin(false);
        setPanelOk(false);
        setSuperAdmin(false);
      }
      
      setIsLoading(false);
    });
    
    // Cleanup the subscription on unmount
    return () => unsubscribe();
  }, []);
  
  if (isLoading) {
    return <div className="loading-screen">Cargando...</div>;
  }
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            (user && panelOk) ? <Navigate to="/dashboard" /> : <LoginScreen />
          } 
        />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            (user && panelOk) ? (
              <DashboardScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Event Form Route - For new events */}
        <Route 
          path="/events/new" 
          element={
            (user && fullAdmin) ? (
              <EventFormScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          } 
        />

        {/* Por evento: rutas más específicas antes de /events/:eventId */}
        <Route
          path="/events/:eventId/promoters"
          element={
            user && panelOk ? <EventPromotersScreen /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/events/:eventId/widget"
          element={
            user && panelOk ? <EventWidgetEmbedScreen /> : <Navigate to="/login" />
          }
        />

        {/* Recurring: promotores y widget embebible */}
        <Route
          path="/recurring-events/:eventId/promoters"
          element={
            user && panelOk ? <EventPromotersScreen /> : <Navigate to="/login" />
          }
        />
        <Route
          path="/recurring-events/:eventId/widget"
          element={
            user && panelOk ? <EventWidgetEmbedScreen /> : <Navigate to="/login" />
          }
        />
        
        {/* Event Form Route - For editing existing events */}
        <Route 
          path="/events/:eventId" 
          element={
            (user && panelOk) ? (
              <EventFormScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Recurring Event Form Route - For new recurring events */}
        <Route 
          path="/recurring-events/new" 
          element={
            (user && fullAdmin) ? (
              <EventFormScreen isRecurring={true} />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          } 
        />
        
        {/* Recurring Event Form Route - For editing existing recurring events */}
        <Route 
          path="/recurring-events/:eventId" 
          element={
            (user && panelOk) ? (
              <EventFormScreen isRecurring={true} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Scan Tickets Route - Taquillas de entrada */}
        <Route 
          path="/scan-tickets" 
          element={
            (user && panelOk) ? (
              <ScanTicketsScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route
          path="/taquilla"
          element={user && panelOk ? <TaquillaSaleScreen /> : <Navigate to="/login" />}
        />

        <Route
          path="/account/password"
          element={user && panelOk ? <AccountChangePasswordScreen /> : <Navigate to="/login" />}
        />

        {/* Ticket Validation Route */}
        <Route 
          path="/validate-ticket/:ticketId" 
          element={
            (user && panelOk) ? (
              <TicketValidationScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Config Route */}
        <Route 
          path="/config" 
          element={
            (user && fullAdmin) ? (
              <ConfigScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          } 
        />

        {/* Event Stats Route */}
        <Route 
          path="/events/:eventId/stats" 
          element={
            (user && panelOk) ? (
              <EventStatsScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Event Tickets Route */}
        <Route 
          path="/events/:eventId/tickets" 
          element={
            (user && panelOk) ? (
              <EventTicketsScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Balance Route */}
        <Route 
          path="/balance" 
          element={
            (user && fullAdmin) ? (
              <BalanceScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          } 
        />

        {/* Banners: solo super admin (carrusel página principal) */}
        <Route 
          path="/banners" 
          element={
            (user && superAdmin) ? (
              <BannersScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          } 
        />

        <Route
          path="/super-admin/earnings"
          element={
            user && fullAdmin ? (
              <SuperAdminEarningsScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          }
        />

        <Route
          path="/super-admin/partners"
          element={
            user && fullAdmin ? (
              <SuperAdminPartnersScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          }
        />

        <Route
          path="/super-admin/audit-log"
          element={
            user && fullAdmin ? (
              <SuperAdminAuditLogScreen />
            ) : (
              <Navigate to={user && panelOk ? '/dashboard' : '/login'} />
            )
          }
        />
        
        {/* Default Route - Redirect to login or dashboard based on auth status */}
        <Route 
          path="*" 
          element={
            <Navigate to={(user && panelOk) ? "/dashboard" : "/login"} />
          } 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default MainLayout;
