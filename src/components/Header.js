"use client";

import { useState, useEffect, useRef } from 'react';
import { useWeb3 } from "@/context/Web3Context";
import Image from 'next/image';
import Notifications from './Notifications';

const BellIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;

export default function Header() {
    // Kept all existing context hooks, including 'disconnect'
    const { account, connectWallet, disconnect, userProfile, notifications } = useWeb3();
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);

    // --- LOGIC FROM LANDINGHEADER.JS ---
    // State to track if the user has scrolled
    const [isScrolled, setIsScrolled] = useState(false);

    // Add scroll event listener to update the header style
    useEffect(() => {
        const handleScroll = () => {
            // Set state to true if scrolled more than 10px, else false
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);
    // --- END OF LOGIC FROM LANDINGHEADER.JS ---

    const unreadCount = notifications.filter(n => !n.read).length;

    const profileImageUrl = userProfile?.profileMetadataURI
        ? `https://gateway.pinata.cloud/ipfs/${userProfile.profileMetadataURI}`
        : '/default-avatar.svg';

    useEffect(() => {
        function handleClickOutside(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [notificationRef]);

    const isPatient = userProfile && Number(userProfile.role) === 0;

    // --- MODIFICATION: REMOVED ALL THEME LOGIC ---
    // All `isDarkTheme` variables and ternaries have been removed.

    // --- DYNAMIC STYLING FROM LANDINGHEADER.JS ---
    const baseHeaderClasses = "sticky top-0 z-50 transition-all duration-300 ease-in-out";
    const scrolledHeaderClasses = "bg-white/75 backdrop-blur-sm border-b border-gray-900/10 shadow-sm";
    // We start with the scrolled classes for a consistent logged-in look
    const topHeaderClasses = "bg-white/75 backdrop-blur-sm border-b border-gray-900/10 shadow-sm";

    return (
        // Apply dynamic classes
        <header
            className={`${baseHeaderClasses} ${
                isScrolled ? scrolledHeaderClasses : topHeaderClasses
            }`}
        >
            {/* Standardized nav container from LandingHeader.js */}
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <Image className='rounded-lg'
                        src="/logo.png"
                        alt="PRISM Logo"
                        width={40} // Standardized logo size
                        height={40} // Standardized logo size
                        priority
                    />
                    {/* Standardized gradient text from LandingHeader.js */}
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        PRISM
                    </span>
                </div>

                <div className="flex items-center space-x-4">
                    {userProfile && (
                        <>
                            {isPatient && (
                                <div className="flex items-center gap-3">
                                    {/* Styled text to match new premium theme */}
                                    <span className="text-gray-700 font-semibold hidden sm:block">
                                        {userProfile.name}
                                    </span>
                                    <Image
                                        src={profileImageUrl}
                                        alt="Profile Picture"
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover border-2 border-gray-200"
                                        onError={(e) => { e.target.onerror = null; e.target.src = '/default-avatar.svg'; }}
                                    />
                                </div>
                            )}
                            <div className="relative" ref={notificationRef}>
                                <button
                                    onClick={() => setShowNotifications(prev => !prev)}
                                    className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                                    aria-label="Toggle Notifications"
                                >
                                    <BellIcon />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-xs items-center justify-center">
                                                {unreadCount}
                                            </span>
                                        </span>
                                    )}
                                </button>
                                {showNotifications && <Notifications close={() => setShowNotifications(false)} />}
                            </div>
                        </>
                    )}

                    {account ? (
                        // --- MODIFICATION: New premium button style ---
                        <button
                            onClick={disconnect}
                            className="bg-red-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md 
                                     transform transition-all duration-300 ease-in-out
                                     hover:scale-105 hover:bg-red-700 hover:shadow-lg
                                     focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                        >
                            Logout
                        </button>
                    ) : (
                        // --- MODIFICATION: New premium button style ---
                        <button
                            onClick={connectWallet}
                            className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md 
                                     transform transition-all duration-300 ease-in-out
                                     hover:scale-105 hover:bg-blue-700 hover:shadow-lg
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        >
                            Login / Register
                        </button>
                    )}
                </div>
            </nav>
        </header>
    );
}

