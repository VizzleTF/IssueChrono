export interface Task {
    id: number;
    name: string;
    description: string;
    start: string;
    end: string | null;
    progress: number;
    dependencies: string[];
    labels: {
        name: string;
        color: string;
        text_color: string;
    }[];
    assignees?: {
        id: number;
        name: string;
        avatar_url: string;
    }[];
    projectId?: string;
    web_url: string;
    author: {
        id: number;
        name: string;
        avatar_url: string;
    };
    created_at: string;
    updated_at: string;
    weight?: number;
    time_estimate?: number;
    total_time_spent?: number;
    due_date?: string | null;
    milestone?: {
        id: number;
        title: string;
        due_date?: string | null;
    } | null;
    iid: number;
    state: string;
} 