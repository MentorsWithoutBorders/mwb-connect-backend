import {Request} from "express";

interface RequestWithUser extends Request {
    auth?: {userId: string}
}

export default RequestWithUser;