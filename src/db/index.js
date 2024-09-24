import mongoose from 'mongoose';
import DB_NAME from '../constants.js'

const connectDB = (async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGOOSEDB_URL}/${DB_NAME}`);
        console.log(`connected || host : ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log(`DB connection error : ${error}`);
        process.exit(1);
    }
})()

export default connectDB;