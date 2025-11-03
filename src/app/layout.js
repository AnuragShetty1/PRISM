import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/context/Web3Context";
// Header is no longer imported here
import { Toaster } from "react-hot-toast";
// Footer is no longer imported here
import AppWrapper from "@/components/AppWrapper"; // Import the new wrapper

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "PRISM-Patient Record Integrity and Security Management",
    description: "Secure Medical Records on the Blockchain",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            {/* The 'bg-gray-50' class is removed from the body.
              Our new AppWrapper component will now control the background color.
            */}
            <body className={`${inter.className}`}>
                <Toaster position="top-center" reverseOrder={false} />
                <Web3Provider>
                    {/*
                      AppWrapper now wraps the children. It will check the
                      login state and render the correct layout.
                    */}
                    <AppWrapper>
                        {children}
                    </AppWrapper>
                </Web3Provider>
            </body>
        </html>
    );
}
