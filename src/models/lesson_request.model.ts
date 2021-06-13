export default interface LessonRequest {
  id: string;
  student?: string;
  mentor?: string;
  organization?: string;
  subfield?: string;
  sentDateTime?: string;
  isCanceled?: boolean
}