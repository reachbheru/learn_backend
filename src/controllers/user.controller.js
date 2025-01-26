import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) => {

    const {username, email, fullname, password}= req.body;
    console.log("got user data");

    if(
        [username, email, fullname, password].some((field) =>
        field?.trim() === ""
    )){
        throw new ApiError(400,"all fields are required");
    }

    console.log("user data validated");
    

    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"user already exist");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;

    console.log("got avatarlocalpath");
    

    let coverimageLocalPath;
    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0){
        coverimageLocalPath = req.files.coverimage[0].path;
    }

    console.log("got coverimagelocalpath");

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("avatar response : ",avatar);
    const coverimage = await uploadOnCloudinary(coverimageLocalPath);
    console.log("coverimage response : ",coverimage);

    if(!avatar){
        throw new ApiError(500, "something went wrong while uploading files");
    }

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        password,
        fullname,
        avatar: avatar.url,
        coverimage: coverimage?.url || ""
    })

    console.log("user created : ",user);
    
    

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "something went wrong while creating user");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"user created successfully")
    )
})

export { registerUser }