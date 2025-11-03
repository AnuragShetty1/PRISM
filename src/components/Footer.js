"use client";

import { useWeb3 } from "@/context/Web3Context";

export default function Footer() {
    // --- MODIFICATION: The 'theme' state is now read from the context. ---
    const { theme } = useWeb3() || {}; // Use default empty object to prevent errors if context is not ready

    const isDarkTheme = theme === 'dark';

    // --- MODIFICATION: Conditional styles are defined here. ---
    const footerClasses = isDarkTheme
        ? "bg-slate-900 backdrop-blur-sm border-t border-slate-700"
        : "bg-slate-100 border-t border-slate-200";

    const containerClasses = isDarkTheme
        ? "max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 text-center text-sm text-[#8B949E]"
        : "container mx-auto px-6 py-4 text-center text-slate-500";

    const year = new Date().getFullYear();

    return (
        <footer className={footerClasses}>
            <div className={containerClasses}>
                <p>&copy; {year} PRISM. All Rights Reserved.</p>
            </div>
        </footer>
    );
}


