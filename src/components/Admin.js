import React, { useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { getAuthSessionId } from '../utils/authStorage';

export default function AdminLayout() {
  const sessionKey = localStorage.getItem("_id") || getAuthSessionId() || "guest";
  const location = useLocation();

  // Close sidebar drawer on tablet/mobile when navigating between routes
  useEffect(() => {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const mainWrapper = document.querySelector('.main-wrapper');

    if (sidebar) sidebar.classList.remove('opened');
    if (sidebarOverlay) sidebarOverlay.classList.remove('opened');
    if (mainWrapper) mainWrapper.classList.remove('slide-nav');
    document.documentElement.classList.remove('menu-opened');
  }, [location.pathname]);

  const handleOverlayClick = () => {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const mainWrapper = document.querySelector('.main-wrapper');

    if (sidebar) sidebar.classList.remove('opened');
    if (sidebarOverlay) sidebarOverlay.classList.remove('opened');
    if (mainWrapper) mainWrapper.classList.remove('slide-nav');
    document.documentElement.classList.remove('menu-opened');
  };

  return (
    <div className="main-wrapper">
      <Navbar key={`navbar-${sessionKey}`} />
      <Sidebar key={`sidebar-${sessionKey}`} />
      <Outlet key={`outlet-${sessionKey}`} />
      <div 
        className="sidebar-overlay" 
        onClick={handleOverlayClick}
        data-reff="#sidebar"
      />
    </div>
  );
}
