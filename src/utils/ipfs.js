import { create } from 'kubo-rpc-client';
import toast from 'react-hot-toast';

// This is the local gateway URL, not the one for Infura/public
// [FIX] Added 'export' so other files (like Profile.js) can import this.
export const IPFS_GATEWAY_URL = 'http://127.0.0.1:8080/ipfs/';

let ipfs = null;

const getIpfsClient = () => {
    if (ipfs) return ipfs;
    try {
        ipfs = create({ url: process.env.NEXT_PUBLIC_IPFS_API_URL || "http://127.0.0.1:5001/api/v0" });
        return ipfs;
    } catch (error) {
        console.error("Failed to connect to IPFS daemon:", error);
        toast.error("Failed to connect to IPFS. Please ensure your local node is running.");
        return null;
    }
};

// A list of public IPFS gateways, ordered by preference for reliability.
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

