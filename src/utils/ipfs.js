import toast from 'react-hot-toast';

// --- MODIFIED: This is now the Pinata gateway, not a local one ---
export const IPFS_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

// --- REMOVED: kubo-rpc-client and getIpfsClient ---
// We are no longer using a local IPFS node.

// --- NEW: Function to upload a file directly to Pinata ---
/**
 * Uploads a file to Pinata using the JWT.
 * @param {File} file The file to upload.
 * @param {string} pinataJWT The Pinata JWT (must be NEXT_PUBLIC_PINATA_JWT)
 * @returns {Promise<string>} The IPFS hash (CID) of the uploaded file.
 */
export const uploadToIPFS = async (file) => {
    const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

    if (!jwt) {
        console.error("Missing NEXT_PUBLIC_PINATA_JWT environment variable.");
        toast.error("File upload is not configured.");
        throw new Error("Pinata JWT not found.");
    }

    // 1. Create FormData to send the file
    const formData = new FormData();
    formData.append('file', file, file.name);

    // 2. Add Pinata metadata (optional, but good practice)
    const metadata = JSON.stringify({
        name: file.name,
        keyvalues: {
            app: 'PRISM-Medical-Records'
        }
    });
    formData.append('pinataMetadata', metadata);

    // 3. Add Pinata options
    const options = JSON.stringify({
        cidVersion: 1, // Use CIDv1
    });
    formData.append('pinataOptions', options);

    // 4. Make the API request to Pinata
    try {
        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
                // Note: We do NOT set 'Content-Type': 'multipart/form-data'.
                // The browser will set it automatically with the correct 'boundary' when using FormData.
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Unknown Pinata error" }));
            console.error("Pinata API Error:", errorData);
            throw new Error(`Pinata upload failed: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        
        // 5. Return the IPFS hash
        return data.IpfsHash;

    } catch (error) {
        console.error("Error uploading to IPFS:", error);
        toast.error(`Upload failed: ${error.message}`);
        throw error;
    }
};


// A list of public IPFS gateways, ordered by preference for reliability.
// --- MODIFIED: Moved Pinata to the top ---
const gateways = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.ipfs.io/ipfs/"
];

/**
 * Fetches a file from IPFS by trying multiple gateways in sequence.
 * This function adds resilience by not relying on a single public gateway.
 * @param {string} ipfsHash - The IPFS hash (CID) of the content to fetch.
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object if successful.
 * @throws {Error} If the content cannot be fetched from any of the available gateways.
 */
export const fetchFromIPFS = async (ipfsHash) => {
  // Loop through each gateway and attempt to fetch the content.
  for (const gateway of gateways) {
    const url = `${gateway}${ipfsHash}`;
    try {
      // Attempt to fetch the resource.
      const response = await fetch(url);
      
      // If the response is successful (e.g., status 200 OK), return it immediately.
      if (response.ok) {
        console.log(`Successfully fetched ${ipfsHash} from ${gateway}`);
        return response;
      }
      
      // Log a warning if a specific gateway fails, then proceed to the next one.
      console.warn(`Failed to fetch ${ipfsHash} from ${gateway}, status: ${response.status}`);
    } catch (error) {
      // Log errors related to network issues or CORS problems for a specific gateway.
      console.error(`Error fetching ${ipfsHash} from ${gateway}:`, error);
    }
  }
  
  // If the loop completes without a successful fetch, notify the user and throw an error.
  toast.error(`Failed to fetch file ${ipfsHash} from all gateways.`);
  throw new Error(`Failed to fetch ${ipfsHash} from all available IPFS gateways.`);
};
