import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {currentPassword, newPassword} = req.body;

    if(!currentPassword || !newPassword){
        throw new ApiError(400, "both current and new password required");
    }

    try {
        const user = await User.findById(req.user?._id);
    
        const isPasswordCorrect = await user.IsPasswordCorrect(currentPassword);
    
        if(!isPasswordCorrect){
            throw new ApiError(400, "current is incorrect");
        }
    
        user.password = newPassword;
        await user.save({validateBeforeSave: false});
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "password updated successfully")
        )
    } catch (error) {
        throw new ApiError(500, "something went wrong while changing password");
    }
})

const changeUserDetails = asyncHandler(async (req, res) => {
    const {username, fullname} = req.body;

    if(!username && !fullname){
        throw new ApiError(400, "either username or fullname is required");
    }

    try {
        const user = await User.findByIdAndUpdate(req.user?._id,
            {
                $set: {
                    username,
                    fullname
                }
            },
            {
                new: true
            }
        ).select("-password")
    
        return res
        .status(200)
        .json(
            new ApiResponse(200,user,"user details updated successfully")
        )
    } catch (error) {
        throw new ApiError(500, "something went wrong while changing user details");
    }
})

const getCurrentUser = asyncHandler(async (req, res) => {
    try {
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "user fetched successfully"
            )
        )
    } catch (error) {
        throw new ApiError(500, "something went wrong while getting user data");
    }
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(500, "error while uploading avatar");
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            {
                new: true
            }
        ).select("-password");
    
        return res
        .status(200)
        .json(
            ApiResponse(
                200,
                user,
                "avatar updated successfully"
            )
        )
    } catch (error) {
        throw new ApiError(500, "something went wrong while updating user avatar");
    }
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverimageLocalPath = req.file?.path;

    if(!coverimageLocalPath){
        throw new ApiError(400, "cover image file is missing");
    }

    const coverimage = await uploadOnCloudinary(coverimageLocalPath);

    if(!avatar.url){
        throw new ApiError(500, "error while uploading cover image");
    }

    try {
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    coverimage: coverimage.url
                }
            },
            {
                new: true
            }
        ).select("-password");
    
        return res
        .status(200)
        .json(
            ApiResponse(
                200,
                user,
                "cover image updated successfully"
            )
        )
    } catch (error) {
        throw new ApiError(500, "something went wrong while updating user avatar");
    }
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if(!username.trim()){
        throw new ApiError(400, "username not get");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribed"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                subscribedCount: {
                    $size: "$subscribed"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in : [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullname: 1,
                avatar: 1,
                coverimage: 1,
                subscriberCount: 1,
                subscribedCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "got channel profile successfully")
    )
})

const getUserWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Schema.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullname: 1,
                                        avatar: 1,
                                        coverimage: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);

    if(!user){
        throw new ApiError(500, "watch history not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                watchHistory: user[0].watchHistory,
                owner: user[0].owner
            },
            "watch history fetched successfully"
        )
    )
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    changeUserDetails,
    getCurrentUser,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory
 }