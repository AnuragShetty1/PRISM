/** @type {import('next').NextConfig} */
const nextConfig = {
    // This 'images' section is updated to include both Pinata and the placeholder service.
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'gateway.pinata.cloud',
                port: '',
                pathname: '/ipfs/**',
            },
            {
                protocol: 'https',
                hostname: 'placehold.co',
            },
        ],
    },
};

export default nextConfig;

