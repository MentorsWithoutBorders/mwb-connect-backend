import User from "./user.model";

export default interface StudentCertificate {
  student?: User;
  certificateDate?: string;
  isTrainingCompleted?: boolean;
  isCertificateSent?: boolean;  
}