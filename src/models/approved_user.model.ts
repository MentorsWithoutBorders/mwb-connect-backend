import User from "./user.model";

export default interface ApprovedUser extends User {
  goal?: string;
}
