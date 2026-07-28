export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  scheduledAt: string;
  teamsMeetingId?: string | null;
  teamsJoinUrl?: string | null;
  status: string;
  createdAt: string;
  organiser?: { id: string; displayName?: string | null };
  attendees?: Array<{
    id: string;
    userId: string;
    isRequired: boolean;
    user?: { id: string; displayName: string; email: string };
  }>;
  items?: Array<{
    id: string;
    itemType: string;
    content: string;
    ownerId?: string | null;
  }>;
  moms?: MomDocument[];
}

export interface MeetingInput {
  title: string;
  scheduledAt: string;
  attendeeIds?: string[];
  teamsMeetingId?: string;
  teamsJoinUrl?: string;
  status?: string;
  items?: Array<{
    itemType: "Agenda" | "Decision" | "Action";
    content: string;
    ownerId?: string;
  }>;
}

export interface MomDocument {
  id: string;
  meetingId: string;
  version: number;
  status: string;
  contentJson: Record<string, unknown> | null;
  reviewedAt?: string | null;
  createdAt: string;
  meeting?: Pick<Meeting, "id" | "title" | "scheduledAt">;
  acknowledgements?: Array<{
    id: string;
    attendeeId: string;
    acknowledged: boolean;
    ackedAt?: string | null;
  }>;
}
