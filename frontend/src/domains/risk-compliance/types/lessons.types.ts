export type Lesson = {
  id: string;
  projectId: string | null;
  projectName?: string;
  category: string;
  description: string;
  recommendation: string;
  tags: string[];
  authorId: string;
  author?: { id: string; displayName: string; email: string };
  createdAt: string;
};

export type CreateLessonPayload = {
  projectId: string;
  category: string;
  description: string;
  recommendation: string;
  tags?: string[];
};
