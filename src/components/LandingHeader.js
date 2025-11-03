"use client";

import { useWeb3 } from "@/context/Web3Context";
import Image from 'next/image';
import { useState, useEffect } from 'react'; // --- NEW IMPORT ---

/**
 * A dedicated header component for the pre-login landing page.
 * It provides the brand logo, name, and a single "Securely Connect" button.
 */
export default function LandingHeader() {
    // We only need the connectWallet function from the context for this component.
    const { connectWallet } = useWeb3();

    // --- NEW STATE ---
    // State to track if the user has scrolled
    const [isScrolled, setIsScrolled] = useState(false);

    // --- NEW EFFECT ---
    // Add scroll event listener to update the header style
    useEffect(() => {
        const handleScroll = () => {
            // Set state to true if scrolled more than 10px, else false
            setIsScrolled(window.scrollY > 10);
        };

        // Add event listener on mount
        window.addEventListener('scroll', handleScroll);

        // Remove event listener on cleanup
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []); // Empty dependency array means this effect runs once on mount

    // --- DYNAMIC STYLING ---
    // Base classes that are always applied
    const baseHeaderClasses = "sticky top-0 z-50 transition-all duration-300 ease-in-out";
    
    // Classes to add *only* when scrolled
    const scrolledHeaderClasses = "bg-white/75 backdrop-blur-sm border-b border-gray-900/10 shadow-sm";
    
    // Classes to apply when *not* scrolled (at the top)
    const topHeaderClasses = "bg-transparent border-b border-transparent";

    return (
        // Apply classes dynamically based on isScrolled state
        <header 
            className={`${baseHeaderClasses} ${
                isScrolled ? scrolledHeaderClasses : topHeaderClasses
            }`}
        >
            {/* --- MODIFICATION ---
            // Reduced vertical padding from 'py-4' to 'py-3' to make it slimmer.
            */}
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-3 flex justify-between items-center">
                
                {/* Left Side: Logo + Brand Name (No changes) */}
                <div className="flex items-center space-x-3">
                    <Image
                        className='rounded-lg'
                        src="/logo.png"
                        alt="PRISM Logo"
                        width={40}
                        height={40}
                        priority
                    />
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        PRISM
                    </span>
                </div>

                {/* Right Side: Call-to-Action Button (No changes) */}
                <div className="flex items-center">
                    <button
                        onClick={connectWallet}
                        className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md 
                                   transform transition-all duration-300 ease-in-out
                                   hover:scale-105 hover:bg-blue-700 hover:shadow-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        Connect Wallet
                    </button>
                </div>
            </nav>
        </header>
    );
}

