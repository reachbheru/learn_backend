import mongoose,{Schema} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            unique: true
        },
        email: {
            type: String,
            required: [true, "email is required"],
            lowercase: true,
            unique: true
        },
        fullname: {
            type: String,
            required: true,
            trim: true
        },
        avatar: {
            type: String,
            required: true
        },
        coverimage: {
            type: String
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            lowercase: true
        },
        refreshToken: {
            type: String
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ]   
    }
    ,
    {
        timestamps: true
    }
)

userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password,10);
    next();
})

userSchema.methods.IsPasswordCorrect = async function (password) {
    return await bcrypt.compare(password,this.password);
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            username: this.username,
            fullname: this.fullname,
            email: this.email
        },
        process.env.ACCESS_TOKEN_KEY,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRE
        }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_KEY,
        {
            expiresIn: REFRESH_TOKEN_EXPIRE
        }
    )
}

export const User = mongoose.model("User",userSchema)