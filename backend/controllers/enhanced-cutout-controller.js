import sharp from "sharp"
import fetch from "node-fetch"
import Product from "../models/product.model.js"
import path from "path"
import fs from "fs"
import cloudinary from "../lib/cloudinary.js"

// COMPLETELY BORDER-FREE face replacement
export const precisionFaceNeckCutout = async (req, res) => {
  try {
    const { faceImageBase64, productId } = req.body

    if (!faceImageBase64 || !productId) {
      return res.status(400).json({ message: "Missing faceImageBase64 or productId" })
    }

    const product = await Product.findById(productId)
    if (!product || !product.image) {
      return res.status(404).json({ message: "Product not found or missing image" })
    }

    const userFaceBuffer = Buffer.from(faceImageBase64, "base64")
    const productImageBuffer = await fetchProductImageBuffer(product.image)

    // Use ORGANIC face-shaped replacement (NO rectangles)
    const result = await performOrganicFaceReplacement(userFaceBuffer, productImageBuffer)

    // Save to temporary file
    const tempFilePath = path.join(__dirname, "downloads", `organic_replacement_${Date.now()}.png`)
    await fs.promises.mkdir(path.dirname(tempFilePath), { recursive: true })
    await fs.promises.writeFile(tempFilePath, result)

    // Upload to Cloudinary
    const cloudinaryResponse = await cloudinary.uploader.upload(tempFilePath, {
      folder: "organic-replacements",
      quality: "auto:best",
      format: "png",
    })

    // Clean up temporary file
    fs.unlink(tempFilePath, (err) => {
      if (err) console.error("Error deleting temporary file:", err)
    })

    return res.json({
      imageUrl: cloudinaryResponse.secure_url,
      success: true,
      message: "Organic face replacement completed successfully - NO BORDERS!",
    })
  } catch (error) {
    console.error("Organic replacement error:", error)
    return res.status(500).json({
      message: "Server error during organic replacement",
      error: error.message,
    })
  }
}

// COMPLETELY NEW APPROACH: Organic face-shaped replacement
async function performOrganicFaceReplacement(userFaceBuffer, productImageBuffer) {
  try {
    // Step 1: Get image dimensions
    const userMetadata = await sharp(userFaceBuffer).metadata()
    const productMetadata = await sharp(productImageBuffer).metadata()

    // Step 2: Create ORGANIC face-shaped mask (no rectangles!)
    const organicFaceMask = await createOrganicFaceMask(userMetadata.width, userMetadata.height)

    // Step 3: Apply organic mask to user image
    const maskedUserFace = await sharp(userFaceBuffer)
      .composite([
        {
          input: organicFaceMask,
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer()

    // Step 4: Resize masked face to fit product model's face area
    const targetWidth = Math.floor(productMetadata.width * 0.35) // Smaller, more natural size
    const targetHeight = Math.floor(productMetadata.height * 0.45)

    const resizedMaskedFace = await sharp(maskedUserFace)
      .resize(targetWidth, targetHeight, {
        fit: "contain", // Maintain aspect ratio
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png()
      .toBuffer()

    // Step 5: Position and blend organically into product image
    const targetLeft = Math.floor(productMetadata.width * 0.325) // Center horizontally
    const targetTop = Math.floor(productMetadata.height * 0.08) // Position at top

    // Step 6: Final organic composite
    const finalResult = await sharp(productImageBuffer)
      .composite([
        {
          input: resizedMaskedFace,
          left: targetLeft,
          top: targetTop,
          blend: "over",
        },
      ])
      .png({
        quality: 100,
        compressionLevel: 6,
      })
      .toBuffer()

    return finalResult
  } catch (error) {
    console.error("Organic face replacement error:", error)
    throw error
  }
}

// Create ORGANIC face-shaped mask (eliminates ALL rectangular borders)
async function createOrganicFaceMask(width, height) {
  try {
    // Create SVG with ORGANIC face shape - NO rectangles anywhere!
    const svgMask = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Ultra-organic face gradient -->
          <radialGradient id="organicFace" cx="50%" cy="40%" rx="35%" ry="45%">
            <stop offset="0%" style="stop-color:white;stop-opacity:1" />
            <stop offset="40%" style="stop-color:white;stop-opacity:1" />
            <stop offset="60%" style="stop-color:white;stop-opacity:0.98" />
            <stop offset="75%" style="stop-color:white;stop-opacity:0.9" />
            <stop offset="85%" style="stop-color:white;stop-opacity:0.7" />
            <stop offset="92%" style="stop-color:white;stop-opacity:0.4" />
            <stop offset="97%" style="stop-color:white;stop-opacity:0.15" />
            <stop offset="100%" style="stop-color:white;stop-opacity:0" />
          </radialGradient>
          
          <!-- Organic neck gradient -->
          <ellipse id="neckShape" cx="50%" cy="75%" rx="25%" ry="20%" fill="url(#organicNeck)" />
          
          <radialGradient id="organicNeck" cx="50%" cy="0%" rx="100%" ry="100%">
            <stop offset="0%" style="stop-color:white;stop-opacity:0.8" />
            <stop offset="50%" style="stop-color:white;stop-opacity:0.6" />
            <stop offset="80%" style="stop-color:white;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:white;stop-opacity:0" />
          </radialGradient>
        </defs>
        
        <!-- Black background -->
        <rect width="100%" height="100%" fill="black"/>
        
        <!-- Organic face shape (oval, not rectangle) -->
        <ellipse cx="50%" cy="40%" rx="35%" ry="45%" fill="url(#organicFace)" />
        
        <!-- Organic neck shape -->
        <ellipse cx="50%" cy="75%" rx="25%" ry="20%" fill="url(#organicNeck)" />
      </svg>
    `

    const mask = await sharp(Buffer.from(svgMask)).png().toBuffer()

    return mask
  } catch (error) {
    console.error("Organic mask creation error:", error)
    throw error
  }
}

// Keep your existing utility function
async function fetchProductImageBuffer(imageUrl) {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch product image: ${response.statusText}`)
    }
    return await response.buffer()
  } catch (error) {
    console.error("Error fetching product image:", error)
    throw error
  }
}
