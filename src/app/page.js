"use client";

import RegistrationForm from "@/components/RegistrationForm";
import Dashboard from "@/components/Dashboard";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import HospitalRequestPending from "@/components/HospitalRequestPending";
import { useWeb3 } from "@/context/Web3Context";
import Image from 'next/image';
import PendingVerification from '@/components/PendingVerification';
import AccessRevoked from "@/components/AccessRevoked";

import LandingPage from "@/components/LandingPage";

export default function Home() {
    const { account, isRegistered, userProfile, owner, isLoadingProfile, userStatus } = useWeb3();

    const renderContent = () => {
        const loggedInWrapper = (content) => (
            <div className="flex items-center justify-center min-h-[calc(100vh-128px)] bg-slate-50">
                {content}
            </div>
        );

        if (isLoadingProfile) {
            return loggedInWrapper(<DashboardSkeleton />);
        }

        if (account && owner && account.toLowerCase() === owner.toLowerCase()) {
            return loggedInWrapper(<SuperAdminDashboard />);
        }

        if (isRegistered && userProfile) {
            return loggedInWrapper(<Dashboard />);
        }

        if (account) {
            switch (userStatus) {
                case 'unregistered':
                    return loggedInWrapper(<RegistrationViews />);
                
                // --- THIS IS THE FIX ---
                // Both 'pending_hospital' (for hospital admins) and 'pending' (for professionals)
                // will now correctly show the same dynamic PendingVerification page.
                case 'pending_hospital':
                case 'rejected':
                case 'pending':
                    return loggedInWrapper(<PendingVerification />);
                // --- END OF FIX ---
                
                case 'revoked':
                    return loggedInWrapper(<AccessRevoked />);

                default:
                    return loggedInWrapper(<DashboardSkeleton />);
            }
        }

        return <LandingPage />;
    };

    // This component is now correctly centered by the loggedInWrapper
    const RegistrationViews = () => (
        <div>
            <RegistrationForm />
        </div>
    );

    return (
        <div className="w-full">
            {renderContent()}
        </div>
    );
}

