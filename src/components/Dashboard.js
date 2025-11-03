"use client";
import { useState, useEffect } from "react";
import { useWeb3 } from "@/context/Web3Context";
import toast from 'react-hot-toast';
import Image from 'next/image';

import PatientDashboard from "./PatientDashboard";
// REMOVED: import DoctorDashboard from "./DoctorView";
// REMOVED: import LabTechnicianDashboard from "./LabTechnicianDashboard";
import HospitalRequestPending from "./HospitalRequestPending";
import UploadForm from "./UploadForm";
import RecordList from "./RecordList";
import AccessManager from "./AccessManager";
import RequestManager from "./RequestManager";
import PendingVerification from "./PendingVerification";
import Profile from "./Profile";
import PublicKeySetup from "./PublicKeySetup";
import AdminDashboard from "./AdminDashboard";
import SuperAdminDashboard from "./SuperAdminDashboard";
import InsuranceDashboard from "./InsuranceDashboard";
import ProfessionalDashboard from "./ProfessionalDashboard"; // NEW Unified Import
// --- FIX ---
// Import the new component that will be displayed to revoked users.
import AccessRevoked from "./AccessRevoked";
// [NEW] Import the DashboardSkeleton for the loading state
import DashboardSkeleton from "./DashboardSkeleton"; 

const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
const RecordsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const AccessIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const RequestsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
const CopyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const ProfileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;


export default function Dashboard() {
    // [MODIFIED] Destructure the new 'isConfirmingKey' state
    const { userProfile, records, requests, accessList, needsPublicKeySetup, userStatus, owner, account, isConfirmingKey } = useWeb3();
    const [activeView, setActiveView] = useState('dashboard');
    const [greeting, setGreeting] = useState('Welcome');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    // --- NEW LOADING STATE CHECK (Step 3 to eliminate flicker) ---
    // If the user has just submitted their public key, show a dedicated loader.
    // This blocks the flicker caused by the race condition.
    if (isConfirmingKey) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-slate-50">
                <h2 className="text-3xl font-bold text-teal-600 mt-8 animate-pulse">Setting Up Your Secure Dashboard...</h2>
                <p className="text-slate-500 mt-2">
                    Waiting for blockchain confirmation. This is a one-time setup.
                </p>
                <DashboardSkeleton />
            </div>
        );
    }
    // --- END NEW LOADING STATE CHECK ---


    if (!userStatus) {
        return <div className="text-center p-10"><p>Loading user status...</p></div>;
    }

    switch (userStatus) {
        case 'pending':
            return <PendingVerification />;
        
        case 'pending_hospital':
            return <HospitalRequestPending />;

        case 'rejected':
            return <HospitalRequestPending />;

        case 'revoked':
            return <AccessRevoked />;

        case 'approved':
            if (needsPublicKeySetup) {
                // If needsPublicKeySetup is true, but isConfirmingKey is false (checked above),
                // it means the user hasn't clicked the button yet or the process failed.
                return <PublicKeySetup />;
            }
            // A check for userProfile is now necessary here, since we can reach this point with a null profile
            // during the brief moment between status approval and full profile load.
            if (!userProfile) {
                return <div className="text-center p-10"><p>Loading user profile...</p></div>;
            }
            switch (userProfile.role) {
                case 'HospitalAdmin':
                    return <AdminDashboard />;
                case 'Doctor':
                case 'LabTechnician':
                    // Route both professional roles to the unified component, passing the role in lowercase
                    return <ProfessionalDashboard role={userProfile.role.toLowerCase()} />;
                case 'Insurance': 
                    return <InsuranceDashboard />; 
                case 'SuperAdmin':
                    return <SuperAdminDashboard />;
                case 'Patient':
                    return <PatientDashboard />;
                default:
                    return <div className="text-center p-10"><p>Dashboard for role "{userProfile.role}" is not yet available.</p></div>;
            }
        
        default:
            // Fallback for any other unhandled statuses.
            return <div className="text-center p-10"><p className="text-xl font-semibold text-slate-700">Your account status is currently: <span className="text-amber-600 font-bold">{userStatus}</span>.</p></div>;
    }
}

// NOTE: The old patient UI code below is now unreachable and can be safely removed in a future cleanup.
const NavItem = ({ icon, label, active, onClick, notificationCount = 0 }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors duration-200 w-full text-left ${active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
    >
        {icon}
        <span className="flex-1">{label}</span>
        {notificationCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount}
            </span>
        )}
    </button>
);

const DashboardOverview = ({ records, accessList, requests }) => (
    <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Dashboard Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard title="Total Records" value={records?.length || 0} icon={<RecordsIcon />} />
            <StatCard title="Active Permissions" value={accessList?.length || 0} icon={<AccessIcon />} />
            <StatCard title="Pending Requests" value={requests?.length || 0} icon={<RequestsIcon />} highlight={(requests?.length || 0) > 0} />
        </div>

        <div className="mt-10 bg-white rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 p-6 border-b border-slate-200">Recent Activity</h3>
            <RecentActivityFeed records={records || []} accessList={accessList || []} requests={requests || []} />
        </div>
    </div>
);

const StatCard = ({ title, value, icon, highlight = false }) => (
    <div className={`p-6 rounded-lg shadow-sm border ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
            <p className={`text-sm font-medium ${highlight ? 'text-amber-800' : 'text-slate-500'}`}>{title}</p>
            <div className={`${highlight ? 'text-amber-600' : 'text-slate-400'}`}>{icon}</div>
        </div>
        <p className={`text-4xl font-bold mt-2 ${highlight ? 'text-amber-900' : 'text-slate-800'}`}>{value}</p>
    </div>
);

const RecentActivityFeed = ({ records, accessList, requests }) => {
    const [activity, setActivity] = useState([]);

    useEffect(() => {
        const recordActivities = (records || []).map(r => ({
            type: 'Record Added',
            description: `New record uploaded.`,
            timestamp: Number(r.timestamp) * 1000,
            icon: <UploadIcon />,
            color: 'text-sky-500',
            bgColor: 'bg-sky-50'
        }));

        const accessActivities = (accessList || []).map((user, index) => ({
            type: 'Access Granted',
            description: `Access granted to ${user.name || 'a provider'}.`,
            timestamp: Date.now() - index * 1000, 
            icon: <AccessIcon />,
            color: 'text-green-500',
            bgColor: 'bg-green-50'
        }));

        const requestActivities = (requests || []).map((req, index) => ({
            type: 'Request Received',
            description: `Access request from ${req.requestor}.`,
            timestamp: Date.now() - index * 1000, 
            icon: <RequestsIcon />,
            color: 'text-amber-500',
            bgColor: 'bg-amber-50'
        }));

        const allActivities = [...recordActivities, ...accessActivities, ...requestActivities];
        allActivities.sort((a, b) => b.timestamp - a.timestamp);

        setActivity(allActivities.slice(0, 5));
    }, [records, accessList, requests]);

    if (activity.length === 0) {
        return <p className="p-6 text-slate-500">No recent activity to display.</p>;
    }

    return (
        <ul className="divide-y divide-slate-200">
            {activity.map((item, index) => (
                <li key={index} className="flex items-center p-4 space-x-4 hover:bg-slate-50">
                    <div className={`p-2 rounded-full ${item.bgColor} ${item.color}`}>
                        {item.icon}
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-slate-800">{item.type}</p>
                        <p className="text-sm text-slate-600">{item.description}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                        {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                </li>
            ))}
        </ul>
    );
};
