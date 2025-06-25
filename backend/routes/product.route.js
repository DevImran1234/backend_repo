import express from "express"
import {
  getAllProducts,
  getFeaturedProducts,
  createProduct,
  deleteProduct,
  getRecommendedProducts,
  getProductsByCategory,
  toggleFeaturedProduct,
  getProductById,
  seamlessFaceReplacement,
  advancedSeamlessReplacement,
  updateProduct,
} from "../controllers/product.controller.js"
import { adminRoute, protectRoute } from "../middleware/auth.middleware.js"

const router = express.Router()

// Public routes
router.get("/", getAllProducts)
router.get("/featured", getFeaturedProducts)
router.get("/category/:category", getProductsByCategory)
router.get("/recommendations", getRecommendedProducts)
router.get("/:id", getProductById)

// Enhanced face replacement routes (no black background, shoulder matching)
router.post("/seamless-face-replacement", seamlessFaceReplacement)
router.post("/advanced-seamless-replacement", advancedSeamlessReplacement)

// Protected admin routes
router.post("/",   createProduct)
router.put("/:id",  updateProduct)

router.patch("/:id",   toggleFeaturedProduct)
router.delete("/:id",   deleteProduct)

export default router
