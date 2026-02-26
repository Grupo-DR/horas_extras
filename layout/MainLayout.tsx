import React from 'react';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

export const MainLayout: React.FC = () => {
    return (
        <div className="flex min-h-screen bg-[#F0F4F8] font-sans selection:bg-blue-100 selection:text-blue-700 overflow-x-hidden">
            <Sidebar />
            <main className="flex-1 min-h-screen w-full relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 via-white/20 to-indigo-50/50 pointer-events-none -z-10" />
                <Outlet />
            </main>
        </div>
    );
};
