import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
    try {
        const data = await request.formData();
        const file = data.get('file');

        if (!file) {
            return NextResponse.json({ success: false, message: "No file found" });
        }

        const formData = new FormData();
        formData.append('file', file);

        const pinataMetadata = JSON.stringify({ name: file.name });
        formData.append('pinataMetadata', pinataMetadata);

        const pinataOptions = JSON.stringify({ cidVersion: 0 });
        formData.append('pinataOptions', pinataOptions);

        const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
            maxBodyLength: "Infinity",
            headers: {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                'Authorization': `Bearer ${process.env.PINATA_JWT}`
            }
        });

        return NextResponse.json({ success: true, ipfsHash: res.data.IpfsHash });
    } catch (error) {
        console.error("Error uploading to Pinata:", error);
        return NextResponse.json({ success: false, message: "Error uploading file" });
    }
}