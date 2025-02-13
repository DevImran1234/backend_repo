import { redis } from "../lib/redis.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Replace process.env variables with the token
const ACCESS_TOKEN_SECRET =
  "21e15f5946275a00683b23dc472ef56e1ad9c617d555b29bdea919c44bdb03a32dbe5a1985d8a632b2ef651e49532e7cc6e078e72a10aec4ddca7aedd399c706106bbb5fd0acb1f3baa7cef8e53efa17e407b3ae0aa485a89089559b788e86212e6eb434611faf0e056c657ec42552e5b1450b4fda314eff3d3ff1711d3798fe2fe7a2bfecbb02298f79bf062e05ad9431d6abd7a9a7d04110bfbc41524477b6f2f13348d5117c6bddbbc21b924d55f09e4c71f49f1c7eaae9761dab84091f826a7624885fbc7e766c0f1d802c287c0c12c71021a87537084e36beda3c3f99ad51276970230b18d8377f83df66ea74fb4cbfab069bb67b12151ac0e1391a0281";
const REFRESH_TOKEN_SECRET = "9103edc080400a0105176ff7516330b495d0f11e82a8f0726ec26f948f10954d05e382d6d9d2ecbeae5bd958886a290015d92828d6448ebd677e186f8140c10991ec3d163c2c6144cbbdc602c07bf1ca285f299aed2236895730134e0aff1a39ba55be5a2bfe886d38bc61bfc3870706871c0406d0b122dbf6c8e034fdd754e1426dddff66faa38d4cdc15a067eff1adefe32777171fe26cdd06526cfa0e1688babbb9ada5b18796699c102ad2f5f4fd6e21a4c226cf38996e242df1cd2fb4c1836225a1d8a7cf2febd187d246ff76ce87fa9724bfd415df916fdccf64f7cf70f9699c3df924f792dc9c00aa6224e4c951ad6b69ab118c5b2f92fc72862d50a4";

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
  await redis.set(`refresh_token:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60); // 7 days
};

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true, // prevent XSS attacks
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // prevent CSRF attacks
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // prevent XSS attacks
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // prevent CSRF attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const signup = async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });

    const { accessToken, refreshToken } = generateTokens(user._id);
    await storeRefreshToken(user._id, refreshToken);

    setCookies(res, accessToken, refreshToken);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      const { accessToken, refreshToken } = generateTokens(user._id);
      await storeRefreshToken(user._id, refreshToken);

      setCookies(res, accessToken, refreshToken);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
      await redis.del(`refresh_token:${decoded.userId}`);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

    if (storedToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = jwt.sign(
      { userId: decoded.userId },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ message: "Token refreshed successfully" });
  } catch (error) {
    console.log("Error in refreshToken controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
