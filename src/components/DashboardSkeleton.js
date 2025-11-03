"use client";

import {
    LayoutDashboard,
    FileText,
    ShieldCheck,
    Bell,
    User,
    Upload
} from 'lucide-react';

// This is a new, refactored skeleton that matches the premium PatientDashboard layout.
export default function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10 animate-pulse">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* 1. Skeleton for DashboardHeader */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        {/* Left Side: Greeting & Status */}
                        <div className="flex-1">
                            <div className="h-8 bg-gray-200 rounded-lg w-3/4"></div>
                            <div className="h-5 bg-gray-200 rounded-lg w-1/2 mt-3"></div>
                            
                            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 space-y-3 mt-4 max-w-md">
                                <div className="flex justify-between items-center">
                                    <div className="h-4 bg-gray-200 rounded-lg w-1/4"></div>
                                    <div className="h-6 bg-gray-200 rounded-full w-1/3"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-1/3"></div>
                                    <div className="h-4 bg-gray-200 rounded-lg w-full"></div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Quick Actions */}
                        <div className="md:w-64 flex-shrink-0">
                            <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 space-y-3">
                                <div className="h-5 bg-gray-200 rounded-lg w-1/2 mb-2"></div>
                                <div className="h-10 bg-gray-200 rounded-lg w-full"></div>
                                <div className="h-10 bg-gray-200 rounded-lg w-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Skeleton for TabNavigation */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                        <div className="h-10 bg-gray-100 rounded-lg flex-1"></div>
                        <div className="h-10 bg-gray-100 rounded-lg flex-1 mx-2"></div>
                        <div className="h-10 bg-gray-100 rounded-lg flex-1"></div>
                        <div className="h-10 bg-gray-100 rounded-lg flex-1 mx-2"></div>
                        <div className="h-10 bg-gray-100 rounded-lg flex-1"></div>
                        <div className="h-10 bg-gray-100 rounded-lg flex-1 ml-2"></div>
                    </div>
                </div>

                {/* 3. Skeleton for Tab Content (Overview Tab) */}
                <div className="space-y-8">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl shadow-xl bg-white border border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-gray-100 rounded-lg"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                                    <div className="h-8 bg-gray-200 rounded-lg w-1/2"></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 rounded-2xl shadow-xl bg-white border border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-gray-100 rounded-lg"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                                    <div className="h-8 bg-gray-200 rounded-lg w-1/2"></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 rounded-2xl shadow-xl bg-white border border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-gray-100 rounded-lg"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                                    <div className="h-8 bg-gray-200 rounded-lg w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
                        <div className="p-6 border-b border-gray-200">
                            <div className="h-6 bg-gray-200 rounded-lg w-1/3"></div>
                        </div>
                        <ul className="divide-y divide-gray-200">
                            <li className="flex items-center p-4 space-x-4">
                                <div className="h-10 w-10 bg-gray-100 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-1/4"></div>
                                    <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                                </div>
                                <div className="h-4 bg-gray-200 rounded-lg w-1/6"></div>
                            </li>
                            <li className="flex items-center p-4 space-x-4">
                                <div className="h-10 w-10 bg-gray-100 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-1/4"></div>
                                    <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                                </div>
                                <div className="h-4 bg-gray-200 rounded-lg w-1/6"></div>
                            </li>
                            <li className="flex items-center p-4 space-x-4">
                                <div className="h-10 w-10 bg-gray-100 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded-lg w-1/4"></div>
                                    <div className="h-4 bg-gray-200 rounded-lg w-3/4"></div>
                                </div>
                                <div className="h-4 bg-gray-200 rounded-lg w-1/6"></div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
