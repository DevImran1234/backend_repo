import cloudinary from "../lib/cloudinary.js"
import Product from "../models/product.model.js"
import fs from "fs"
import fetch from "node-fetch"
import path from "path"
import sharp from "sharp"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Enhanced seamless face replacement with no black background and shoulder matching
export const seamlessFaceReplacement = async (req, res) => {
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

    // Perform enhanced face replacement with shoulder matching
    const replacedImageBuffer = await performEnhancedFaceReplacement(userFaceBuffer, productImageBuffer)

    // Save to temporary file
    const tempFilePath = path.join(__dirname, "downloads", `enhanced_face_${Date.now()}.png`)
    await fs.promises.mkdir(path.dirname(tempFilePath), { recursive: true })
    await fs.promises.writeFile(tempFilePath, replacedImageBuffer)

    // Upload to Cloudinary with high quality
    const cloudinaryResponse = await cloudinary.uploader.upload(tempFilePath, {
      folder: "enhanced-face-replacement",
      quality: "auto:best",
      format: "png",
      transformation: [{ quality: "auto:best" }, { fetch_format: "auto" }],
    })

    // Clean up temporary file
    fs.unlink(tempFilePath, (err) => {
      if (err) console.error("Error deleting temporary file:", err)
    })

    return res.json({
      imageUrl: cloudinaryResponse.secure_url,
      success: true,
      message: "Enhanced face replacement completed successfully",
    })
  } catch (error) {
    console.error("Enhanced face replacement error:", error)
    return res.status(500).json({
      message: "Server error during face replacement",
      error: error.message,
    })
  }
}

// Enhanced face replacement with shoulder matching and no black background
async function performEnhancedFaceReplacement(userFaceBuffer, productImageBuffer) {
  try {
    // Step 1: Analyze both images with extended regions
    const userImageAnalysis = await analyzeUserImageExtended(userFaceBuffer)
    const productImageAnalysis = await analyzeProductImageExtended(productImageBuffer)

    // Step 2: Extract user's face with neck and shoulder area
    const extractedUserFace = await extractUserFaceWithShoulders(userFaceBuffer, userImageAnalysis)

    // Step 3: Match skin tone and lighting
    const colorMatchedFace = await matchSkinToneAndLighting(extractedUserFace, productImageBuffer, productImageAnalysis)

    // Step 4: Create perfect fit with shoulder alignment
    const perfectFitFace = await createPerfectFitWithShoulders(colorMatchedFace, productImageAnalysis)

    // Step 5: Replace with seamless shoulder matching
    const finalResult = await replaceWithShoulderMatching(productImageBuffer, perfectFitFace, productImageAnalysis)

    return finalResult
  } catch (error) {
    console.error("Enhanced face replacement process error:", error)
    throw error
  }
}

// Analyze user image with extended region for shoulders
async function analyzeUserImageExtended(userFaceBuffer) {
  try {
    const metadata = await sharp(userFaceBuffer).metadata()

    // Extended face region to include more neck and shoulder area
    const faceRegion = {
      left: Math.floor(metadata.width * 0.1), // Wider to include more area
      top: Math.floor(metadata.height * 0.02), // Higher to include hair
      width: Math.floor(metadata.width * 0.8), // Much wider
      height: Math.floor(metadata.height * 0.9), // Include shoulders
    }

    return {
      metadata,
      faceRegion,
      aspectRatio: faceRegion.width / faceRegion.height,
    }
  } catch (error) {
    console.error("Extended user image analysis error:", error)
    throw error
  }
}

// Analyze product image with extended model region
async function analyzeProductImageExtended(productImageBuffer) {
  try {
    const metadata = await sharp(productImageBuffer).metadata()

    // Extended model region to include shoulders
    const modelFaceRegion = {
      left: Math.floor(metadata.width * 0.25), // Wider area
      top: Math.floor(metadata.height * 0.02), // Include hair
      width: Math.floor(metadata.width * 0.5), // Much wider
      height: Math.floor(metadata.height * 0.65), // Include shoulders
    }

    return {
      metadata,
      modelFaceRegion,
      aspectRatio: modelFaceRegion.width / modelFaceRegion.height,
    }
  } catch (error) {
    console.error("Extended product image analysis error:", error)
    throw error
  }
}

// Extract user face with shoulders
async function extractUserFaceWithShoulders(userFaceBuffer, analysis) {
  try {
    const extractedFace = await sharp(userFaceBuffer)
      .extract(analysis.faceRegion)
      // Enhance image quality
      .modulate({
        brightness: 1.01,
        saturation: 0.99,
        hue: 0,
      })
      // Remove noise
      .median(1)
      // Enhance details
      .sharpen({
        sigma: 0.8,
        m1: 0.5,
        m2: 2.0,
      })
      .toBuffer()

    return extractedFace
  } catch (error) {
    console.error("Face with shoulders extraction error:", error)
    throw error
  }
}

// Match skin tone and lighting between user face and product model
async function matchSkinToneAndLighting(extractedUserFace, productImageBuffer, productAnalysis) {
  try {
    // Get average color from product model's visible skin area
    const modelSkinSample = await sharp(productImageBuffer)
      .extract({
        left: productAnalysis.modelFaceRegion.left + Math.floor(productAnalysis.modelFaceRegion.width * 0.3),
        top: productAnalysis.modelFaceRegion.top + Math.floor(productAnalysis.modelFaceRegion.height * 0.7),
        width: Math.floor(productAnalysis.modelFaceRegion.width * 0.4),
        height: Math.floor(productAnalysis.modelFaceRegion.height * 0.2),
      })
      .stats()

    // Get average color from user's face
    const userFaceStats = await sharp(extractedUserFace).stats()

    // Calculate adjustment ratios
    const brightnessRatio = modelSkinSample.channels[0].mean / userFaceStats.channels[0].mean
    const saturationAdjustment = brightnessRatio > 1.1 ? 0.95 : 1.05

    // Apply color matching
    const colorMatched = await sharp(extractedUserFace)
      .modulate({
        brightness: Math.min(Math.max(brightnessRatio, 0.8), 1.2), // Clamp between 0.8 and 1.2
        saturation: saturationAdjustment,
        hue: 0,
      })
      .toBuffer()

    return colorMatched
  } catch (error) {
    console.error("Color matching error:", error)
    // Return original if color matching fails
    return extractedUserFace
  }
}

// Create perfect fit with shoulder alignment
async function createPerfectFitWithShoulders(colorMatchedFace, productAnalysis) {
  try {
    const targetWidth = productAnalysis.modelFaceRegion.width
    const targetHeight = productAnalysis.modelFaceRegion.height

    const perfectFit = await sharp(colorMatchedFace)
      // Resize to exact target dimensions
      .resize(targetWidth, targetHeight, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      })
      // Minimal blur for seamless integration
      .blur(0.3)
      .toBuffer()

    return perfectFit
  } catch (error) {
    console.error("Perfect fit with shoulders creation error:", error)
    throw error
  }
}

// Replace with seamless shoulder matching and no black background
async function replaceWithShoulderMatching(productImageBuffer, perfectFitFace, productAnalysis) {
  try {
    // Create advanced mask with no black areas
    const advancedMask = await createTransparentSeamlessMask(
      productAnalysis.modelFaceRegion.width,
      productAnalysis.modelFaceRegion.height,
    )

    // Apply transparent mask to user's face
    const maskedUserFace = await sharp(perfectFitFace)
      .composite([
        {
          input: advancedMask,
          blend: "dest-in",
        },
      ])
      .toBuffer()

    // Create the final composite with seamless blending
    const result = await sharp(productImageBuffer)
      .composite([
        {
          input: maskedUserFace,
          left: productAnalysis.modelFaceRegion.left,
          top: productAnalysis.modelFaceRegion.top,
          blend: "over",
        },
      ])
      // Final enhancement
      .modulate({
        brightness: 1.002,
        saturation: 1.005,
      })
      .sharpen({
        sigma: 0.4,
        m1: 0.5,
        m2: 2.0,
      })
      .png({
        quality: 100,
        compressionLevel: 6,
        progressive: true,
      })
      .toBuffer()

    return result
  } catch (error) {
    console.error("Shoulder matching replacement error:", error)
    throw error
  }
}

// Create transparent seamless mask with no black background
async function createTransparentSeamlessMask(width, height) {
  try {
    // Create a more sophisticated mask with multiple gradients
    const svgMask = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="faceGrad" cx="50%" cy="35%" rx="45%" ry="40%">
            <stop offset="0%" style="stop-color:white;stop-opacity:1" />
            <stop offset="60%" style="stop-color:white;stop-opacity:1" />
            <stop offset="80%" style="stop-color:white;stop-opacity:0.9" />
            <stop offset="95%" style="stop-color:white;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:white;stop-opacity:0" />
          </radialGradient>
          <radialGradient id="shoulderGrad" cx="50%" cy="85%" rx="40%" ry="25%">
            <stop offset="0%" style="stop-color:white;stop-opacity:0.8" />
            <stop offset="50%" style="stop-color:white;stop-opacity:0.6" />
            <stop offset="80%" style="stop-color:white;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:white;stop-opacity:0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#faceGrad)" />
        <rect width="100%" height="40%" y="60%" fill="url(#shoulderGrad)" />
      </svg>
    `

    const mask = await sharp(Buffer.from(svgMask)).png().toBuffer()

    return mask
  } catch (error) {
    console.error("Transparent seamless mask creation error:", error)
    // Fallback to simple transparent mask
    return await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.8 },
      },
    })
      .png()
      .toBuffer()
  }
}

// Advanced replacement with perfect shoulder blending
export const advancedSeamlessReplacement = async (req, res) => {
  try {
    const { faceImageBase64, productId } = req.body

    if (!faceImageBase64 || !productId) {
      return res.status(400).json({ message: "Missing required parameters" })
    }

    const product = await Product.findById(productId)
    if (!product || !product.image) {
      return res.status(404).json({ message: "Product not found" })
    }

    const userFaceBuffer = Buffer.from(faceImageBase64, "base64")
    const productImageBuffer = await fetchProductImageBuffer(product.image)

    // Advanced processing with perfect shoulder matching
    const result = await performAdvancedShoulderMatching(userFaceBuffer, productImageBuffer)

    // Save and upload
    const tempFilePath = path.join(__dirname, "downloads", `advanced_shoulder_${Date.now()}.png`)
    await fs.promises.mkdir(path.dirname(tempFilePath), { recursive: true })
    await fs.promises.writeFile(tempFilePath, result)

    const cloudinaryResponse = await cloudinary.uploader.upload(tempFilePath, {
      folder: "advanced-shoulder-matching",
      quality: "auto:best",
      format: "png",
    })

    fs.unlink(tempFilePath, (err) => {
      if (err) console.error("Error deleting temporary file:", err)
    })

    return res.json({
      imageUrl: cloudinaryResponse.secure_url,
      success: true,
      message: "Advanced shoulder matching completed",
    })
  } catch (error) {
    console.error("Advanced shoulder matching error:", error)
    return res.status(500).json({
      message: "Advanced shoulder matching failed",
      error: error.message,
    })
  }
}

// Advanced shoulder matching process
async function performAdvancedShoulderMatching(userFaceBuffer, productImageBuffer) {
  try {
    // Extended analysis for better shoulder matching
    const userAnalysis = await analyzeUserImageForShoulders(userFaceBuffer)
    const productAnalysis = await analyzeProductImageForShoulders(productImageBuffer)

    // Extract with shoulder area
    const extractedWithShoulders = await extractUserWithShoulderArea(userFaceBuffer, userAnalysis)

    // Advanced color and lighting matching
    const advancedColorMatched = await performAdvancedColorMatching(
      extractedWithShoulders,
      productImageBuffer,
      productAnalysis,
    )

    // Create perfect shoulder alignment
    const shoulderAligned = await createShoulderAlignedFit(advancedColorMatched, productAnalysis)

    // Final integration with perfect blending
    const result = await performPerfectShoulderIntegration(productImageBuffer, shoulderAligned, productAnalysis)

    return result
  } catch (error) {
    console.error("Advanced shoulder matching process error:", error)
    throw error
  }
}

// Analyze user image specifically for shoulder matching
async function analyzeUserImageForShoulders(userFaceBuffer) {
  try {
    const metadata = await sharp(userFaceBuffer).metadata()

    // Even more extended region for perfect shoulder matching
    const faceRegion = {
      left: Math.floor(metadata.width * 0.05),
      top: Math.floor(metadata.height * 0.01),
      width: Math.floor(metadata.width * 0.9),
      height: Math.floor(metadata.height * 0.95),
    }

    return {
      metadata,
      faceRegion,
      aspectRatio: faceRegion.width / faceRegion.height,
    }
  } catch (error) {
    console.error("Shoulder analysis error:", error)
    throw error
  }
}

// Analyze product image for shoulder matching
async function analyzeProductImageForShoulders(productImageBuffer) {
  try {
    const metadata = await sharp(productImageBuffer).metadata()

    // Extended model region for shoulder matching
    const modelFaceRegion = {
      left: Math.floor(metadata.width * 0.2),
      top: Math.floor(metadata.height * 0.01),
      width: Math.floor(metadata.width * 0.6),
      height: Math.floor(metadata.height * 0.7),
    }

    return {
      metadata,
      modelFaceRegion,
      aspectRatio: modelFaceRegion.width / modelFaceRegion.height,
    }
  } catch (error) {
    console.error("Product shoulder analysis error:", error)
    throw error
  }
}

// Extract user with shoulder area
async function extractUserWithShoulderArea(userFaceBuffer, analysis) {
  try {
    const extracted = await sharp(userFaceBuffer)
      .extract(analysis.faceRegion)
      .modulate({
        brightness: 1.005,
        saturation: 0.995,
      })
      .median(1)
      .sharpen({
        sigma: 0.6,
        m1: 0.5,
        m2: 2.0,
      })
      .toBuffer()

    return extracted
  } catch (error) {
    console.error("Shoulder area extraction error:", error)
    throw error
  }
}

// Advanced color matching for shoulders
async function performAdvancedColorMatching(extractedWithShoulders, productImageBuffer, productAnalysis) {
  try {
    // Sample multiple areas for better color matching
    const productStats = await sharp(productImageBuffer).stats()
    const userStats = await sharp(extractedWithShoulders).stats()

    // Calculate more precise adjustments
    const brightnessAdjustment = productStats.channels[0].mean / userStats.channels[0].mean
    const saturationAdjustment = productStats.channels[1].mean / userStats.channels[1].mean

    const colorMatched = await sharp(extractedWithShoulders)
      .modulate({
        brightness: Math.min(Math.max(brightnessAdjustment * 0.9, 0.85), 1.15),
        saturation: Math.min(Math.max(saturationAdjustment * 0.95, 0.9), 1.1),
      })
      .toBuffer()

    return colorMatched
  } catch (error) {
    console.error("Advanced color matching error:", error)
    return extractedWithShoulders
  }
}

// Create shoulder aligned fit
async function createShoulderAlignedFit(advancedColorMatched, productAnalysis) {
  try {
    const targetWidth = productAnalysis.modelFaceRegion.width
    const targetHeight = productAnalysis.modelFaceRegion.height

    const aligned = await sharp(advancedColorMatched)
      .resize(targetWidth, targetHeight, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      })
      .blur(0.3)
      .toBuffer()

    return aligned
  } catch (error) {
    console.error("Shoulder aligned fit error:", error)
    throw error
  }
}

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, price, image, category } = req.body

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    let cloudinaryResponse = null

    if (image && image !== product.image) {
      if (product.image) {
        const publicId = product.image.split("/").pop().split(".")[0]
        try {
          await cloudinary.uploader.destroy(`products/${publicId}`)
          console.log("Deleted old image from cloudinary")
        } catch (error) {
          console.log("Error deleting old image from cloudinary", error)
        }
      }

      cloudinaryResponse = await cloudinary.uploader.upload(image, {
        folder: "products",
      })
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: name || product.name,
        description: description || product.description,
        price: price || product.price,
        image: cloudinaryResponse?.secure_url || product.image,
        category: category || product.category,
      },
      { new: true, runValidators: true },
    )

    res.json(updatedProduct)
  } catch (error) {
    console.log("Error in updateProduct controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Perfect shoulder integration
async function performPerfectShoulderIntegration(productImageBuffer, shoulderAligned, productAnalysis) {
  try {
    // Create perfect shoulder mask
    const shoulderMask = await createPerfectShoulderMask(
      productAnalysis.modelFaceRegion.width,
      productAnalysis.modelFaceRegion.height,
    )

    // Apply shoulder mask
    const maskedShoulder = await sharp(shoulderAligned)
      .composite([
        {
          input: shoulderMask,
          blend: "dest-in",
        },
      ])
      .toBuffer()

    // Final perfect integration
    const result = await sharp(productImageBuffer)
      .composite([
        {
          input: maskedShoulder,
          left: productAnalysis.modelFaceRegion.left,
          top: productAnalysis.modelFaceRegion.top,
          blend: "over",
        },
      ])
      .modulate({
        brightness: 1.001,
        saturation: 1.002,
      })
      .sharpen({
        sigma: 0.3,
        m1: 0.5,
        m2: 2.0,
      })
      .png({
        quality: 100,
        compressionLevel: 6,
        progressive: true,
      })
      .toBuffer()

    return result
  } catch (error) {
    console.error("Perfect shoulder integration error:", error)
    throw error
  }
}

// Create perfect shoulder mask with no black areas
async function createPerfectShoulderMask(width, height) {
  try {
    const svgMask = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:white;stop-opacity:1" />
            <stop offset="40%" style="stop-color:white;stop-opacity:1" />
            <stop offset="70%" style="stop-color:white;stop-opacity:0.8" />
            <stop offset="90%" style="stop-color:white;stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:white;stop-opacity:0" />
          </linearGradient>
          <radialGradient id="centerGrad" cx="50%" cy="30%" rx="45%" ry="35%">
            <stop offset="0%" style="stop-color:white;stop-opacity:1" />
            <stop offset="70%" style="stop-color:white;stop-opacity:1" />
            <stop offset="90%" style="stop-color:white;stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:white;stop-opacity:0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#topGrad)" />
        <ellipse cx="50%" cy="30%" rx="45%" ry="35%" fill="url(#centerGrad)" />
      </svg>
    `

    return await sharp(Buffer.from(svgMask)).png().toBuffer()
  } catch (error) {
    console.error("Perfect shoulder mask creation error:", error)
    throw error
  }
}

// Utility function to fetch product image
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

// Keep existing functions for backward compatibility
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({})
    res.json({ products })
  } catch (error) {
    console.log("Error in getAllProducts controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getFeaturedProducts = async (req, res) => {
  try {
    const featuredProducts = await Product.find({ isFeatured: true }).lean()
    if (!featuredProducts || featuredProducts.length === 0) {
      return res.status(404).json({ message: "No featured products found" })
    }
    res.json(featuredProducts)
  } catch (error) {
    console.log("Error in getFeaturedProducts controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    console.log("Error in getProductById controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, image, category } = req.body
    let cloudinaryResponse = null

    if (image) {
      cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: "products" })
    }

    const product = await Product.create({
      name,
      description,
      price,
      image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
      category,
    })

    res.status(201).json(product)
  } catch (error) {
    console.log("Error in createProduct controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (product.image) {
      const publicId = product.image.split("/").pop().split(".")[0]
      try {
        await cloudinary.uploader.destroy(`products/${publicId}`)
        console.log("deleted image from cloudinary")
      } catch (error) {
        console.log("error deleting image from cloudinary", error)
      }
    }

    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    console.log("Error in deleteProduct controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getRecommendedProducts = async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $sample: { size: 4 } },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          image: 1,
          price: 1,
        },
      },
    ])
    res.json(products)
  } catch (error) {
    console.log("Error in getRecommendedProducts controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const getProductsByCategory = async (req, res) => {
  const { category } = req.params
  try {
    const products = await Product.find({ category })
    res.json({ products })
  } catch (error) {
    console.log("Error in getProductsByCategory controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const toggleFeaturedProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (product) {
      product.isFeatured = !product.isFeatured
      const updatedProduct = await product.save()
      res.json(updatedProduct)
    } else {
      res.status(404).json({ message: "Product not found" })
    }
  } catch (error) {
    console.log("Error in toggleFeaturedProduct controller", error.message)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Add this new export to your existing exports
export { precisionFaceNeckCutout } from "./enhanced-cutout-controller.js"
