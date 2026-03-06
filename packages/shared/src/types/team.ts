export interface Team {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamAgent {
  id: string;
  teamId: string;
  agentId: string;
  role: string;
  joinedAt: string;
  agent?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    color: string | null;
    icon: string | null;
    isOnline: boolean | null;
  };
}

export type CreateTeamData = {
  name: string;
  description?: string;
};

export type UpdateTeamData = Partial<CreateTeamData>;

export interface MdFile {
  id: string;
  fileKey: string;
  content: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface DailyMemoryFile {
  id: string;
  scopeType: string;
  scopeId: string;
  date: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  memoryType: string;
  importance: number;
  score: number;
  createdAt: string;
  lastAccessedAt: string;
}
