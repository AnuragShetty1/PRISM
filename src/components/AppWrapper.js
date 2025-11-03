"use client";

import { useEffect } from 'react';
import { useWeb3 } from "@/context/Web3Context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * This component wraps the entire application and conditionally renders
 * the correct layout based on the user's authentication state.
 * - If logged in, it shows the main <Header> and <Footer>.
 * - If logged out, it shows none, allowing the <LandingPage> to render its own.
 * It also manages the body's background color.
 */
export default function AppWrapper({ children }) {
    const { account } = useWeb3();

    useEffect(() => {
        // This effect runs when the `account` state changes.
        if (account) {
            // Logged in: Set body to the default gray background
            document.body.classList.add('bg-gray-50');
            document.body.classList.remove('bg-white');
        } else {
            // Logged out (on landing page): Set body to white
            document.body.classList.remove('bg-gray-50');
            document.body.classList.add('bg-white');
        }
    }, [account]); // Re-run effect when account status changes

    if (account) {
        // User is LOGGED IN:
        // Render the main dashboard layout with Header and Footer.
        return (
            <div className="relative z-10 flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow">{children}</main>
                <Footer />
            </div>
        );
    }

    // User is LOGGED OUT:
    // Render *only* the children. src/app/page.js will render the
    // <LandingPage> component, which correctly contains its own
    // <LandingHeader> and <Footer>.
    return <>{children}</>;
}
