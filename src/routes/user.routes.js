import Router from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { loginUser, logoutUser, registerUser, refreshAccessToken, changeCurrentPassword, changeUserDetails, getCurrentUser, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getUserWatchHistory } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverimage",
            maxCount: 1
        }
    ]),
    registerUser
);
router.route("/login").post(loginUser);

//safe routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").patch(verifyJWT, changeCurrentPassword);
router.route("/change-details").patch(verifyJWT, changeUserDetails);
router.route("/get-user").get(verifyJWT, getCurrentUser);
router.route("/change-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/change-coverimage").patch(verifyJWT, upload.single("coverimage"), updateUserCoverImage);
router.route("/channel/:username").get(verifyJWT, getUserChannelProfile);
router.route("/history").get(verifyJWT, getUserWatchHistory);

export default router 