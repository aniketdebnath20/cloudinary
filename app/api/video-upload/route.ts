import { PrismaClient } from '@prisma/client/extension';
import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';



const prisma = new PrismaClient()

// Configuration
cloudinary.config({
    cloud_name: process.env.NEXT_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_CLOUDINARY_API_KEY,
    api_secret: process.env.NEXT_CLOUDINARY_API_SECRET,
});

interface CloudinaryUploadResult {
    public_id: string;
    bytes: number;
    duration?: number;
    [key: string]: any
}


export async function POST(request: NextRequest) {

    try {

        // Check if the user is authenticated

        if (
            !process.env.NEXT_CLOUDINARY_CLOUD_NAME ||
            !process.env.NEXT_CLOUDINARY_API_KEY ||
            !process.env.NEXT_CLOUDINARY_API_SECRET
        ) {
            return NextResponse.json({ error: "Cloudinary config not found" }, { status: 500 })
        }



        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const title = formData.get("title") as string | null;
        const description = formData.get("description") as string | null;
        const originalSize = formData.get("originalSize") as string | null;

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

     const result = await new Promise<CloudinaryUploadResult>(
            (resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "video",
                        folder: "video-uploads",
                        transformation: [
                            {quality: "auto", fetch_format: "mp4"},
                        ]
                    },
                    (error, result) => {
                        if(error) reject(error);
                        else resolve(result as CloudinaryUploadResult);
                    }
                )
                uploadStream.end(buffer)
            }
        )

        if (!result) {
            return NextResponse.json({ error: "Upload failed" }, { status: 500 })
        }

        const video = await prisma.video.create({
            data: {
                title,
                description,
                publicId: result.public_id,
                originalSize: originalSize,
                compressedSize: String(result.bytes),
                duration: result.duration || 0,
            }
        })
        
        if (!video) {
            return NextResponse.json({ error: "Video not found" }, { status: 500 })
        }
        return NextResponse.json(video)

    } catch (error) {
        console.log("UPload video failed", error)
        return NextResponse.json({ error: "UPload video failed" }, { status: 500 })
    } finally {
        await prisma.$disconnect()
    }

}
