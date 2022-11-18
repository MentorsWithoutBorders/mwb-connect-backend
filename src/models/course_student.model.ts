import User from "./user.model";

export default interface CourseStudent extends User {
  isCanceled?: string;
}