"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '@/context/Web3Context'; // Using aliased path
import toast from 'react-hot-toast';
import axios from 'axios';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Calendar, Droplet, Loader2, Save, Upload } from 'lucide-react';
import { fetchFromIPFS, IPFS_GATEWAY_URL } from '@/utils/ipfs'; // Using aliased path

export default function Profile({ onProfileUpdate }) {
    const { userProfile, api } = useWeb3();

    // New comprehensive state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        dob: '',
        bloodGroup: '',
    });
    const [profileImage, setProfileImage] = useState(null); // For the File object
    const [imagePreview, setImagePreview] = useState(null); // For the display URL
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true); // Loader for initial data fetch

    // Fetches profile data from IPFS hash
    const fetchProfileData = useCallback(async () => {
        if (!userProfile) {
            setIsFetching(false);
            return;
        }

        // Set default/fallback data first
        setFormData({
            name: userProfile.name || '',
            email: userProfile.contactInfo || '', // 'contactInfo' is the old field name
            phone: '',
            dob: '',
            bloodGroup: '',
        });
        
        if (userProfile.profileIpfsHash) {
            setIsFetching(true);
            try {
                const response = await fetchFromIPFS(userProfile.profileIpfsHash);
                const metadata = await response.json();

                setFormData({
                    name: metadata.name || userProfile.name || '',
                    email: metadata.email || userProfile.contactInfo || '',
                    phone: metadata.phone || '',
                    dob: metadata.dob || '',
                    bloodGroup: metadata.bloodGroup || '',
                });

                if (metadata.imageIpfsHash) {
                    setImagePreview(`${IPFS_GATEWAY_URL}${metadata.imageIpfsHash}`);
                }
            } catch (error) {
                console.error("Failed to fetch profile metadata:", error);
                toast.error("Could not load your profile data from IPFS.");
            } finally {
                setIsFetching(false);
            }
        } else {
             // No IPFS hash, just use on-chain data and stop fetching
            setIsFetching(false);
        }
    }, [userProfile]); // userProfile is the dependency

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]); // fetchProfileData is the dependency

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith("image/")) {
            setProfileImage(file);
            setImagePreview(URL.createObjectURL(file));
        } else if (file) {
            toast.error("Please select a valid image file (PNG or JPEG).");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!api) return toast.error("API service not available. Cannot save.");
        if (!formData.name) return toast.error("Name is a required field.");

        setIsLoading(true);
        const toastId = toast.loading("Updating your profile...");

        try {
            // Find the existing image hash from the *loaded* data, not the base userProfile
            let imageIpfsHash = ""; 
            if (imagePreview && imagePreview.includes(IPFS_GATEWAY_URL)) {
                imageIpfsHash = imagePreview.replace(IPFS_GATEWAY_URL, "");
            }

            // 1. Upload new profile image if one was selected
            if (profileImage) {
                toast.loading("Uploading profile image...", { id: toastId });
                const formDataImg = new FormData();
                formDataImg.append("file", profileImage);

                const res = await axios.post('/api/upload', formDataImg, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                if (!res.data.ipfsHash) {
                    throw new Error("Image upload failed to return IPFS hash.");
                }
                imageIpfsHash = res.data.ipfsHash;
            }

            // 2. Create metadata object
            const metadata = {
                ...formData,
                imageIpfsHash: imageIpfsHash,
            };

            // 3. Upload metadata JSON to IPFS
            toast.loading("Uploading profile metadata...", { id: toastId });
            const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
            const formDataMeta = new FormData();
            formDataMeta.append("file", metadataBlob, "profile.json");

            const metaRes = await axios.post('/api/upload', formDataMeta, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (!metaRes.data.ipfsHash) {
                throw new Error("Metadata upload failed to return IPFS hash.");
            }
            const metadataIpfsHash = metaRes.data.ipfsHash;

            // 4. Call the new smart contract function via the API
            toast.loading("Saving hash to blockchain...", { id: toastId });
            await api.updateUserProfile(metadataIpfsHash);

            toast.success("Profile updated successfully!", { id: toastId });

            if (onProfileUpdate) {
                await onProfileUpdate(); // Trigger dashboard refetch
            }

        } catch (error) {
            console.error("Profile update failed:", error);
            const apiError = error.response?.data?.message;
            toast.error(apiError || "Failed to update profile.", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    // Skeleton Loader for initial fetch
    if (isFetching) {
        return <ProfileSkeleton />;
    }

    return (
        <motion.div
            className="w-full max-w-4xl" // Wider container
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* --- COLUMN 1: Profile Picture --- */}
                <div className="md:col-span-1 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Profile Photo</h3>
                    <div className="flex flex-col items-center">
                        <div className="w-40 h-40 rounded-full bg-gray-200 border border-gray-300 overflow-hidden flex items-center justify-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Profile Preview" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-24 h-24 text-gray-400" />
                            )}
                        </div>
                        <label
                            htmlFor="profileImageInput"
                            className="mt-4 cursor-pointer inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                            <Upload className="mr-2 h-5 w-5" />
                            Change Photo
                        </label>
                        <input
                            id="profileImageInput"
                            type="file"
                            accept="image/png, image/jpeg"
                            className="sr-only"
                            onChange={handleImageChange}
                        />
                    </div>
                </div>

                {/* --- COLUMN 2: Form Fields --- */}
                <div className="md:col-span-2 space-y-5">

                    {/* Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Jane Doe" required />
                        </div>
                    </div>

                    {/* Email (replaces contactInfo) */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., jane.doe@example.com" />
                        </div>
                    </div>

                    {/* NEW: Phone */}
                    <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder="(123) 456-7890" />
                        </div>
                    </div>

                    {/* NEW: DOB & Blood Group (Grid) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="dob" className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="bloodGroup" className="block text-sm font-semibold text-gray-700 mb-2">Blood Group</label>
                            <div className="relative">
                                <Droplet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <select id="bloodGroup" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                                    <option value="">Select...</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* --- REFACTORED: Button --- */}
                    <div className="pt-2">
                        <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-colors shadow-lg">
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-5 w-5" />
                            )}
                            <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                    </div>
                </div>
            </form>
        </motion.div>
    );
}

// --- NEW: Skeleton Component ---
const ProfileSkeleton = () => (
    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 animate-pulse">
        {/* Column 1: Image Skeleton */}
        <div className="md:col-span-1 space-y-4 flex flex-col items-center">
            <div className="h-6 bg-gray-200 rounded-lg w-1/2"></div>
            <div className="w-40 h-40 rounded-full bg-gray-200 border border-gray-300"></div>
            <div className="h-9 bg-gray-200 rounded-lg w-32"></div>
        </div>
        {/* Column 2: Form Skeleton */}
        <div className="md:col-span-2 space-y-5">
            {/* Name */}
            <div>
                <div className="h-5 bg-gray-200 rounded-lg w-1/4 mb-2"></div>
                <div className="h-11 bg-gray-200 rounded-lg w-full"></div>
            </div>
            {/* Email */}
            <div>
                <div className="h-5 bg-gray-200 rounded-lg w-1/4 mb-2"></div>
                <div className="h-11 bg-gray-200 rounded-lg w-full"></div>
            </div>
            {/* Phone */}
            <div>
                <div className="h-5 bg-gray-200 rounded-lg w-1/3 mb-2"></div>
                <div className="h-11 bg-gray-200 rounded-lg w-full"></div>
            </div>
            {/* DOB & Blood Group */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="h-5 bg-gray-200 rounded-lg w-1/2 mb-2"></div>
                    <div className="h-11 bg-gray-200 rounded-lg w-full"></div>
                </div>
                <div>
                    <div className="h-5 bg-gray-200 rounded-lg w-1/2 mb-2"></div>
                    <div className="h-11 bg-gray-200 rounded-lg w-full"></div>
                </div>
            </div>
            {/* Button */}
            <div className="pt-2">
                <div className="h-11 bg-gray-200 rounded-lg w-full"></div>
            </div>
        </div>
    </div>
);

