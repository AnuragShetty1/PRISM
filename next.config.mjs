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
    // [NEW] Add Webpack config to mock React Native modules
    webpack: (config, { isServer }) => {
        // This is the fix for the '@react-native-async-storage/async-storage' error.
        // It tells Webpack to replace this module with 'false' (nothing) during the build.
        if (!isServer) {
            config.resolve.alias['@react-native-async-storage/async-storage'] = false;
            config.resolve.alias['react-native-sqlite-storage'] = false; // Proactively mocking another common one
        }

        // Return the modified config
        return config;
    },
};

export default nextConfig;