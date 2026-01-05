import React from 'react';
import { Sidebar } from './Sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export const MainLayout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="flex min-h-screen bg-[#F0F4F8] font-sans selection:bg-blue-100 selection:text-blue-700 overflow-x-hidden">
            <Sidebar />
            <main className="flex-1 pl-64 min-h-screen w-full relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/50 via-white/20 to-indigo-50/50 pointer-events-none -z-10" />
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};
