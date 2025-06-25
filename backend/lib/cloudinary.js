import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
	cloud_name: 'dc6x0waez',
	api_key: '223825739998958',
	api_secret: 'gAxl5J35kxQ-bEJR4ctVMEsL9-0',
});


export default cloudinary;
