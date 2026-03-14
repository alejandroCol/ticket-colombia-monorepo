import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import LoginScreen from '@pages/login';
import { 
  onAuthStateChange, 
  logoutUser, 
  hasAdminAccess 
} from '@services';
import DashboardScreen from '@pages/dashboard';
import EventFormScreen from '@pages/EventForm';
import TicketValidationScreen from '@pages/TicketValidation';
import ConfigScreen from '@pages/Config';
import BannersScreen from '@pages/Banners';
import EventStatsScreen from '@pages/EventStats';
import BalanceScreen from '@pages/Balance';

// Dashboard and other pages would be imported here
// import Dashboard from '../dashboard';

const MainLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Subscribe to authentication state changes
    const unsubscribe = onAuthStateChange(async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // Check if user has admin access
        const adminAccess = await hasAdminAccess(authUser.uid);
        setIsAdmin(adminAccess);
        
        if (!adminAccess) {
          // If not admin, log them out immediately
          await logoutUser();
          setUser(null);
        }
      } else {
        setIsAdmin(false);
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
            (user && isAdmin) ? <Navigate to="/dashboard" /> : <LoginScreen />
          } 
        />
        
        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            (user && isAdmin) ? (
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
            (user && isAdmin) ? (
              <EventFormScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Event Form Route - For editing existing events */}
        <Route 
          path="/events/:eventId" 
          element={
            (user && isAdmin) ? (
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
            (user && isAdmin) ? (
              <EventFormScreen isRecurring={true} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Recurring Event Form Route - For editing existing recurring events */}
        <Route 
          path="/recurring-events/:eventId" 
          element={
            (user && isAdmin) ? (
              <EventFormScreen isRecurring={true} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Ticket Validation Route */}
        <Route 
          path="/validate-ticket/:ticketId" 
          element={
            (user && isAdmin) ? (
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
            (user && isAdmin) ? (
              <ConfigScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Event Stats Route */}
        <Route 
          path="/events/:eventId/stats" 
          element={
            (user && isAdmin) ? (
              <EventStatsScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Balance Route */}
        <Route 
          path="/balance" 
          element={
            (user && isAdmin) ? (
              <BalanceScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Banners Route */}
        <Route 
          path="/banners" 
          element={
            (user && isAdmin) ? (
              <BannersScreen />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        
        {/* Default Route - Redirect to login or dashboard based on auth status */}
        <Route 
          path="*" 
          element={
            <Navigate to={(user && isAdmin) ? "/dashboard" : "/login"} />
          } 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default MainLayout;
