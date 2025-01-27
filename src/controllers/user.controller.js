import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (user) => {
    try {

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        return {accessToken, refreshToken};

    } catch (error) {

        throw new ApiError(500, "something went wrong while generating tokens");

    }
}

const registerUser = asyncHandler(async (req, res) => {

    const {username, email, fullname, password}= req.body;

    if(
        [username, email, fullname, password].some((field) =>
        field?.trim() === ""
    )){
        throw new ApiError(400,"all fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"user already exist");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;  

    let coverimageLocalPath;
    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0){
        coverimageLocalPath = req.files.coverimage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverimage = await uploadOnCloudinary(coverimageLocalPath);

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

const loginUser = asyncHandler(async (req, res) => {
    const {username, email, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "username or email is required");
    }

    if(!password){
        throw new ApiError(400, "password is required");
    }

    const user = await User.findOne({
        $or: [{ username },{ email }]
    });
    
    if(!user){
        throw new ApiError(404, "user not exist");
    }

    const isPasswordTrue = await user.IsPasswordCorrect(password);

    if(!isPasswordTrue){
        throw new ApiError(400, "incorrect password");
    }
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "user logged in"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized access");
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_KEY);

    const user = await User.findById(decodedToken?._id);

    if(!user){
        throw new ApiError(401, "invalid refresh token");
    }

    if(incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401, "refresh token used or expired");
    }

    const {newAccessToken, newRefreshToken} = await generateAccessAndRefreshToken(user);

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",newAccessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            },
            "access token refreshed"
        )
    )
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
 }