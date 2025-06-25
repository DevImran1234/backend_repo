import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
	try {
	  const authHeader = req.headers.authorization;
  
	  if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Unauthorized - No access token provided" });
	  }
  
	  const token = authHeader.split(" ")[1];
  
	  try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.userId).select("-password");
  
		if (!user) {
		  return res.status(401).json({ message: "Unauthorized - User not found" });
		}
  
		req.user = user;
		next();
	  } catch (err) {
		if (err.name === "TokenExpiredError") {
		  return res.status(401).json({ message: "Unauthorized - Token expired" });
		}
		throw err;
	  }
	} catch (err) {
	  console.error("Protect route error:", err.message);
	  return res.status(401).json({ message: "Unauthorized - Invalid token" });
	}
  };

export const adminRoute = (req, res, next) => {
	if (req.user && req.user.role === "admin") {
		next();
	} else {
		return res.status(403).json({ message: "Access denied - Admin only" });
	}
};
