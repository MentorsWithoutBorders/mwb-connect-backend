import User from "./user.model";

export default interface StudentCertificate {
  id?: string;
  student?: User;
  certificateDate?: string;
  isTrainingCompleted?: boolean;
  isCertificateSent?: boolean;  
}