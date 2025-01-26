const asyncHandler = (requestHander) => async (req, res, next) => {
    try {
        await requestHander(req, res, next);
    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}

export {asyncHandler}