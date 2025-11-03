"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useWeb3 } from "@/context/Web3Context";
import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
// --- MODIFICATION: Swapped to older, safer icons ---
import { 
    ShieldCheck, UserCog, Globe, Server, Lock, Network, Mouse, MoveDown, 
    BarChart, FileText, CheckSquare, 
    // New, safer icons:
    Heart, Database, Archive, Key
} from 'lucide-react';

/**
 * A dedicated component for the entire landing page, built for a
 * modern, engaging, and informative user experience.
 */
export default function LandingPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <LandingHeader />
            <main className="flex-grow">
                <HeroSection />
                <ProblemSection />
                <SolutionSection />
                <FeatureSection />
                {/* --- MODIFICATION: New section added --- */}
                <TechnologyDeepDiveSection />
                <CTASection />
            </main>
            <Footer />
        </div>
    );
}

// --- Section 1: Hero ---
function HeroSection() {
    const { connectWallet } = useWeb3();

    return (
        <section className="relative flex min-h-[calc(100vh-80px)] items-center justify-center overflow-hidden bg-gray-900 text-white">
            {/* Background Abstract Graphic */}
            <div className="absolute inset-0 z-0 opacity-20">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
            
            {/* Animated Gradient Shapes */}
            <motion.div
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 opacity-30 blur-3xl"
            />
            <motion.div
                animate={{ rotate: -360, scale: [1, 1.1, 1] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear", delay: 5 }}
                className="absolute -top-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-gradient-to-l from-teal-500 to-blue-500 opacity-30 blur-3xl"
            />

            <div className="relative z-10 max-w-4xl px-6 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-4xl font-bold tracking-tight sm:text-6xl"
                >
                    The Future of Your Health Records is Here.
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    className="mt-6 text-lg leading-8 text-gray-300"
                >
                    {/* --- MODIFICATION: PRISM caps and full name added --- */}
                    <span className="font-semibold text-blue-300">PRISM</span> (Patient Record Integrity and Security Management) gives you unparalleled security, privacy, and control over your medical data, powered by the blockchain.
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                    className="mt-10"
                >
                    <button
                        onClick={connectWallet}
                        className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-500  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        Securely Connect Now
                    </button>
                </motion.div>
            </div>

            {/* Scroll Down Cue */}
            <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, 10, 10, 20] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2"
            >
                <div className="flex flex-col items-center space-y-1 text-gray-400">
                    <Mouse className="h-6 w-6" />
                    <MoveDown className="h-4 w-4" />
                </div>
            </motion.div>
        </section>
    );
}

// --- Section 2: Problem ---
function ProblemSection() {
    const cardVariants = {
        offscreen: { opacity: 0, y: 50 },
        onscreen: {
            opacity: 1,
            y: 0,
            transition: { type: "spring", stiffness: 50, damping: 20 }
        }
    };

    return (
        <section className="bg-white py-24 sm:py-32">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <motion.div
                    initial="offscreen"
                    whileInView="onscreen"
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ staggerChildren: 0.2 }}
                    className="max-w-2xl mx-auto lg:max-w-none"
                >
                    <h2 className="text-3xl font-bold tracking-tight text-center text-gray-900 sm:text-4xl">
                        Your medical data is scattered, insecure, and out of your control.
                    </h2>
                    <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-3">
                        {problemCards.map((card) => {
                            // --- RUNTIME FIX (PascalCase) ---
                            const IconComponent = card.icon;
                            return (
                                <motion.div
                                    key={card.title}
                                    variants={cardVariants}
                                    className="flex flex-col items-center text-center p-8 bg-gray-50 rounded-2xl shadow-lg border border-gray-100"
                                >
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white">
                                        <IconComponent className="h-8 w-8" aria-hidden="true" />
                                    </div>
                                    <h3 className="mt-6 text-2xl font-semibold leading-7 text-gray-900">{card.title}</h3>
                                    <p className="mt-4 text-base leading-7 text-gray-600">{card.description}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

const problemCards = [
    { title: 'Fragmented', description: 'Records are stuck in different hospital silos, creating an incomplete picture of your health.', icon: BarChart },
    { title: 'Insecure', description: "Central databases are vulnerable targets for data breaches, putting your sensitive information at risk.", icon: Lock },
    { title: 'No Control', description: "You don't decide who sees your data or when. Your privacy is an afterthought.", icon: UserCog },
];

// --- Section 3: Solution ---
function SolutionSection() {
    return (
        <section className="bg-gray-900 py-24 sm:py-32 text-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-3xl mx-auto text-center"
                >
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        {/* --- MODIFICATION: PRISM caps --- */}
                        The PRISM Solution: A Unified Hub You Own
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-gray-300">
                        {/* --- MODIFICATION: PRISM caps --- */}
                        PRISM unifies your records in one secure, decentralized hub. We use cutting-edge technology to put you—and only you—in charge.
                    </p>
                </motion.div>

                <div className="mt-20 flow-root">
                    <div className="-m-4 grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                        {solutionSteps.map((step, i) => {
                            // --- RUNTIME FIX (PascalCase) ---
                            const IconComponent = step.icon;
                            return (
                                <motion.div
                                    key={step.title}
                                    initial={{ opacity: 0, y: 50 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.3 }}
                                    transition={{ duration: 0.5, delay: i * 0.2 }}
                                    className="flex flex-col justify-between rounded-2xl bg-gray-800/50 p-8 shadow-2xl ring-1 ring-white/10"
                                >
                                    <div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                                            <IconComponent className="h-6 w-6" aria-hidden="true" />
                                        </div>
                                        <h3 className="mt-6 text-xl font-semibold leading-7">{step.title}</h3>
                                        <p className="mt-4 text-base leading-7 text-gray-300">{step.description}</p>
                                    </div>
                                    <div className="mt-6 text-sm font-medium text-blue-400">Step {i + 1}</div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

const solutionSteps = [
    { title: 'Connect & Identify', description: 'Securely create your decentralized identity. This is your key to the new world of health data.', icon: Network },
    { title: 'Verify & Upload', description: 'Verified providers (doctors, labs) add encrypted records to your profile on IPFS (decentralized storage).', icon: FileText },
    { title: 'Control & Share', description: 'Grant temporary, on-chain access to any provider, anywhere. You are the gatekeeper.', icon: CheckSquare },
];

// --- Section 4: Features (Bento Grid) ---
function FeatureSection() {
    const itemVariants = {
        offscreen: { opacity: 0, scale: 0.9 },
        onscreen: {
            opacity: 1,
            scale: 1,
            transition: { type: "spring", stiffness: 100, damping: 20 }
        }
    };

    return (
        <section className="bg-white py-24 sm:py-32">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <motion.div
                    initial="offscreen"
                    whileInView="onscreen"
                    viewport={{ once: true, amount: 0.2 }}
                    className="max-w-2xl mx-auto text-center"
                >
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Core Technology</h2>
                    <p className="mt-4 text-lg leading-8 text-gray-600">
                        A closer look at the advanced technology protecting your data.
                    </p>
                </motion.div>
                
                <motion.div
                    initial="offscreen"
                    whileInView="onscreen"
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ staggerChildren: 0.1 }}
                    className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3"
                >
                    {/* Large Box 1 */}
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-2 rounded-2xl bg-gray-50 p-8 shadow-lg border border-gray-100"
                    >
                        <ShieldCheck className="h-10 w-10 text-blue-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-gray-900">Blockchain Security</h3>
                        <p className="mt-2 text-base text-gray-600">
                            Every access grant is a transparent, immutable transaction recorded on the blockchain. This creates an auditable, tamper-proof log of who has viewed your data and when.
                        </p>
                    </motion.div>
                    
                    {/* Small Box 2 */}
                    <motion.div
                        variants={itemVariants}
                        className="rounded-2xl bg-gray-50 p-8 shadow-lg border border-gray-100"
                    >
                        <UserCog className="h-10 w-10 text-purple-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-gray-900">Patient-Centric Control</h3>
                        <p className="mt-2 text-base text-gray-600">
                            Grant and revoke access in real-time. Your data is yours, and you control the keys.
                        </p>
                    </motion.div>
                    
                    {/* Small Box 3 */}
                    <motion.div
                        variants={itemVariants}
                        className="rounded-2xl bg-gray-50 p-8 shadow-lg border border-gray-100"
                    >
                        <Server className="h-10 w-10 text-teal-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-gray-900">Decentralized Storage</h3>
                        <p className="mt-2 text-base text-gray-600">
                            Your files are encrypted and stored on IPFS, a peer-to-peer network, not a central server.
                        </p>
                    </motion.div>

                    {/* Large Box 4 */}
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-2 rounded-2xl bg-gray-50 p-8 shadow-lg border border-gray-100"
                    >
                        <Globe className="h-10 w-10 text-green-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-gray-900">Unified Health Profile</h3>
                        <p className="mt-2 text-base text-gray-600">
                            One patient, one complete record. Your unified profile is accessible (with your permission) to any authorized provider, anywhere in the world, ensuring better continuity of care.
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}

// --- NEW SECTION ---
// This entire section is new, addressing your "why" questions.
const techDives = [
    { 
        title: 'Patient-Centric by Design', 
        description: "This is our core philosophy. Technology should serve you. Instead of institutions holding your data, you hold the keys. This design flips the traditional model, empowering you as the sole arbiter of your sensitive information. Your privacy is a right, not a feature.", 
        // --- MODIFICATION: Swapped icon ---
        icon: Heart 
    },
    { 
        title: 'Why Blockchain? (The Trust Layer)', 
        description: "Your medical files are *not* stored on the blockchain. Only the *proof* of access is. The blockchain acts as an immutable, transparent ledger. Every time a doctor requests access, and you grant it, that event is recorded forever. This creates perfect, auditable trust.", 
        // --- MODIFICATION: Swapped icon ---
        icon: Database 
    },
    { 
        title: 'Why IPFS? (The Storage Layer)', 
        description: "InterPlanetary File System (IPFS) is a decentralized storage network. Unlike a central server that can be hacked or shut down, IPFS distributes your encrypted files across many nodes. This means your data is highly available, censorship-resistant, and has no single point of failure.", 
        // --- MODIFICATION: Swapped icon ---
        icon: Archive 
    },
    { 
        title: 'End-to-End Encryption (The Privacy Layer)', 
        description: "Your files are encrypted on your device *before* they are ever uploaded to IPFS. They can only be decrypted by someone who has been given a unique access key *by you*. Not even we can see your files. This ensures absolute privacy at every step.", 
        // --- MODIFICATION: Swapped icon ---
        icon: Key 
    },
];

function TechnologyDeepDiveSection() {
    const itemVariants = {
        offscreen: { opacity: 0, y: 50 },
        onscreen: {
            opacity: 1,
            y: 0,
            transition: { type: "spring", stiffness: 50, damping: 20 }
        }
    };

    return (
        <section className="bg-gray-900 py-24 sm:py-32 text-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <motion.div
                    initial="offscreen"
                    whileInView="onscreen"
                    viewport={{ once: true, amount: 0.3 }}
                    className="max-w-3xl mx-auto text-center"
                >
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The Technology That Empowers You</h2>
                    <p className="mt-6 text-lg leading-8 text-gray-300">
                        Our choices are deliberate. We built PRISM on a foundation of technologies that guarantee security, transparency, and patient control.
                    </p>
                </motion.div>
                
                <motion.div
                    initial="offscreen"
                    whileInView="onscreen"
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ staggerChildren: 0.2 }}
                    className="mt-20 grid grid-cols-1 gap-12 lg:grid-cols-2"
                >
                    {techDives.map((tech) => {
                        // --- RUNTIME FIX (PascalCase) ---
                        // We must assign the icon to a PascalCase variable
                        // for React to recognize it as a component.
                        const IconComponent = tech.icon;
                        
                        return (
                            <motion.div
                                key={tech.title}
                                variants={itemVariants}
                                className="flex items-start space-x-6"
                            >
                                <div className="flex-shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800/50 ring-1 ring-white/10 text-blue-400">
                                    <IconComponent className="h-8 w-8" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-semibold leading-7">{tech.title}</h3>
                                    <p className="mt-4 text-base leading-7 text-gray-300">{tech.description}</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>
        </section>
    );
}

// --- Section 5: Final CTA ---
function CTASection() {
    const { connectWallet } = useWeb3();

    return (
        <section className="bg-blue-600">
            <div className="max-w-7xl mx-auto px-6 py-24 sm:py-32 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.8 }}
                    className="text-center"
                >
                    <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Take back control of your health story.
                    </h2>
                    <p className="mt-4 text-lg leading-8 text-blue-100">
                        Join the future of secure medical records today.
                    </p>
                    <div className="mt-10">
                        <motion.button
                            onClick={connectWallet}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            className="rounded-md bg-white px-6 py-3 text-base font-semibold text-blue-600 shadow-lg transition-all hover:scale-110 hover:bg-gray-100  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            Securely Connect & Get Started
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}