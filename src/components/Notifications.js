"use client";

import { useWeb3 } from "@/context/Web3Context";
import { formatDistanceToNow } from 'date-fns'; // A library to format dates like "5 minutes ago"

// --- SVG Icons ---
const BellIcon = () => <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
const CheckCircleIcon = () => <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;


export default function Notifications({ close }) {
    const { notifications, markNotificationsAsRead } = useWeb3();

    const handleMarkAsRead = () => {
        markNotificationsAsRead();
        // Optional: close the dropdown after marking as read
        // close(); 
    };

    return (
        <div className="absolute top-16 right-0 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 animate-fade-in-down">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Notifications</h3>
                {notifications.some(n => !n.read) && (
                     <button onClick={handleMarkAsRead} className="text-sm font-semibold text-teal-600 hover:text-teal-800">
                        Mark all as read
                    </button>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="text-center p-8 text-slate-500">
                        <BellIcon />
                        <p className="mt-2 font-semibold">No new notifications</p>
                        <p className="text-sm">We'll let you know when something important happens.</p>
                    </div>
                ) : (
                    <ul>
                        {notifications.map(notification => (
                            <li key={notification.id} className={`flex items-start gap-4 p-4 border-b border-slate-100 ${!notification.read ? 'bg-teal-50' : 'bg-white'}`}>
                                <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${!notification.read ? 'bg-teal-500' : 'bg-transparent'}`}></div>
                                <div className="flex-shrink-0 text-slate-400">
                                    <CheckCircleIcon />
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm text-slate-700">{notification.message}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}