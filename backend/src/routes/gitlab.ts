import express, { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { URL } from 'url';

const router = express.Router();

interface GitLabLabel {
    id: number;
    name: string;
    color: string;
    text_color: string;
    description: string | null;
    description_html: string | null;
    title: string;
    type: string | null;
    group_id: number | null;
    project_id: number | null;
    template: boolean;
    created_at: string | null;
    updated_at: string | null;
    priority: number | null;
    is_project_label: boolean;
}

interface GitLabIssue {
    id: number;
    iid: number;
    title: string;
    description: string;
    created_at: string;
    due_date: string | null;
    time_stats: {
        time_estimate: number;
        total_time_spent: number;
    };
    labels: GitLabLabel[];
    assignees: {
        id: number;
        name: string;
        avatar_url: string;
    }[];
    projectId?: string;
    web_url: string;
    author: any;
    updated_at: string;
    weight: number;
    milestone: any;
    notes: any[];
}

function normalizeGitLabUrl(urlString: string): string {
    try {
        const url = new URL(urlString);
        // If no port is specified and it's https, use 443
        if (!url.port && url.protocol === 'https:') {
            url.port = '443';
        }
        // If no port is specified and it's http, use 80
        if (!url.port && url.protocol === 'http:') {
            url.port = '80';
        }
        return url.toString().replace(/\/$/, ''); // Remove trailing slash if present
    } catch (error) {
        throw new Error('Invalid GitLab URL');
    }
}

// Create Axios instance with default config
const createGitLabClient = (baseUrl: string, token: string) => {
    return axios.create({
        baseURL: baseUrl,
        headers: {
            'PRIVATE-TOKEN': token,
            'Accept': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout
    });
};

// Error handling helper
const handleError = (error: any, res: Response) => {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            return res.status(axiosError.response.status).json({
                error: axiosError.response.data
            });
        }
    }
    console.error('GitLab API Error:', error);
    return res.status(500).json({
        error: 'Internal server error'
    });
};

// Test endpoint
router.get('/test', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'GitLab API proxy is working' });
});

// Test GitLab connection
router.get('/test-connection', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;

        if (!gitlabUrl) {
            return res.status(400).json({ error: 'GitLab URL is required' });
        }

        if (!token) {
            return res.status(400).json({ error: 'GitLab token is required' });
        }

        const baseUrl = normalizeGitLabUrl(gitlabUrl.toString());
        const gitlabClient = createGitLabClient(baseUrl, token as string);
        const response = await gitlabClient.get('/api/v4/version');

        res.json({
            status: 'ok',
            message: 'Successfully connected to GitLab',
            version: response.data
        });
    } catch (error: unknown) {
        console.error('Error testing connection:', error);
        if (error instanceof Error && error.message === 'Invalid GitLab URL') {
            res.status(400).json({ error: 'Invalid GitLab URL format' });
        } else if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            console.log('Axios error details:', {
                code: axiosError.code,
                message: axiosError.message,
                response: axiosError.response?.data
            });
            if (axiosError.code === 'ECONNREFUSED') {
                res.status(503).json({ error: 'Unable to connect to GitLab server' });
            } else if (axiosError.response?.status === 401) {
                res.status(401).json({ error: 'Invalid GitLab token' });
            } else {
                res.status(axiosError.response?.status || 500).json({
                    error: `Failed to connect to GitLab: ${axiosError.message}`,
                    details: axiosError.response?.data
                });
            }
        } else {
            res.status(500).json({ error: 'Failed to test GitLab connection' });
        }
    }
});

// Fetch issues from GitLab
router.get('/issues', async (req: Request, res: Response) => {
    try {
        const { projectId, token, gitlabUrl } = req.query;

        if (!projectId || !token || !gitlabUrl) {
            return res.status(400).json({ error: 'Project ID, token, and GitLab URL are required' });
        }

        const baseUrl = normalizeGitLabUrl(gitlabUrl.toString());
        const gitlabClient = createGitLabClient(baseUrl, token as string);

        // Split project IDs and clean them
        const projectIds = projectId.toString()
            .split(/[\s,]+/)
            .map(id => id.trim())
            .filter(id => id.length > 0);

        let allIssues: GitLabIssue[] = [];

        // Fetch issues for each project
        for (const pid of projectIds) {
            let page = 1;
            const perPage = 100;

            while (true) {
                console.log(`Fetching issues for project ${pid}, page ${page} with params:`, {
                    page,
                    per_page: perPage,
                    order_by: 'created_at',
                    sort: 'desc',
                    with_labels_details: true
                });

                const response = await gitlabClient.get<GitLabIssue[]>(`/api/v4/projects/${pid}/issues`, {
                    params: {
                        page,
                        per_page: perPage,
                        order_by: 'created_at',
                        sort: 'desc',
                        with_labels_details: true
                    }
                });

                const issues = response.data;
                if (issues.length === 0) break;

                // Log first issue's labels for debugging
                if (page === 1 && issues.length > 0) {
                    console.log('First issue labels:', JSON.stringify(issues[0].labels, null, 2));
                    console.log('Raw response data for first issue:', JSON.stringify(issues[0], null, 2));
                }

                // Add project ID to each issue for reference
                const issuesWithProject = issues.map(issue => ({
                    ...issue,
                    projectId: pid
                }));

                allIssues = allIssues.concat(issuesWithProject);
                page++;

                // Check if we've received less than perPage items, meaning this is the last page
                if (issues.length < perPage) break;
            }
        }

        // Log sample formatted issue
        const formattedIssues = allIssues.map((issue) => ({
            id: issue.id,
            iid: issue.iid,
            name: issue.title,
            description: issue.description,
            start: issue.created_at,
            end: issue.due_date,
            progress: issue.time_stats?.time_estimate ?
                (issue.time_stats.total_time_spent / issue.time_stats.time_estimate) * 100 : 0,
            dependencies: [],
            labels: issue.labels.map(label => ({
                name: label.name,
                color: label.color,
                text_color: label.text_color
            })),
            assignees: issue.assignees,
            projectId: issue.projectId,
            web_url: issue.web_url,
            author: issue.author,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            weight: issue.weight,
            time_estimate: issue.time_stats?.time_estimate,
            total_time_spent: issue.time_stats?.total_time_spent,
            due_date: issue.due_date,
            milestone: issue.milestone,
            notes: issue.notes
        }));

        if (formattedIssues.length > 0) {
            console.log('Sample formatted issue labels:', JSON.stringify(formattedIssues[0].labels, null, 2));
        }

        res.json(formattedIssues);
    } catch (error: unknown) {
        console.error('Error fetching issues:', error);
        if (error instanceof Error && error.message === 'Invalid GitLab URL') {
            res.status(400).json({ error: 'Invalid GitLab URL format' });
        } else if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response?.status === 401) {
                res.status(401).json({ error: 'Invalid GitLab token' });
            } else if (axiosError.code === 'ECONNREFUSED') {
                res.status(503).json({ error: 'Unable to connect to GitLab server' });
            } else {
                res.status(axiosError.response?.status || 500).json({
                    error: `Failed to fetch issues from GitLab: ${axiosError.message}`
                });
            }
        } else {
            res.status(500).json({ error: 'Failed to fetch issues from GitLab' });
        }
    }
});

// Fetch milestones from GitLab
router.get('/milestones', async (req: Request, res: Response) => {
    try {
        const { projectId, token, gitlabUrl } = req.query;

        if (!projectId || !token || !gitlabUrl) {
            return res.status(400).json({ error: 'Project ID, token, and GitLab URL are required' });
        }

        const baseUrl = normalizeGitLabUrl(gitlabUrl.toString());
        const gitlabClient = createGitLabClient(baseUrl, token as string);

        const response = await gitlabClient.get(`/api/v4/projects/${projectId}/milestones`);

        res.json(response.data);
    } catch (error: unknown) {
        console.error('Error fetching milestones:', error);
        if (error instanceof Error && error.message === 'Invalid GitLab URL') {
            res.status(400).json({ error: 'Invalid GitLab URL format' });
        } else if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response?.status === 401) {
                res.status(401).json({ error: 'Invalid GitLab token' });
            } else if (axiosError.code === 'ECONNREFUSED') {
                res.status(503).json({ error: 'Unable to connect to GitLab server' });
            } else {
                res.status(axiosError.response?.status || 500).json({
                    error: `Failed to fetch milestones from GitLab: ${axiosError.message}`
                });
            }
        } else {
            res.status(500).json({ error: 'Failed to fetch milestones from GitLab' });
        }
    }
});

// Notes (Comments) API methods
const getIssueNotes = async (gitlabUrl: string, projectId: string, issueIid: number, token: string) => {
    const response = await axios.get(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
        {
            headers: { 'PRIVATE-TOKEN': token },
            params: {
                sort: 'desc',
                order_by: 'created_at'
            }
        }
    );
    return response.data;
};

const createIssueNote = async (gitlabUrl: string, projectId: string, issueIid: number, body: string, token: string) => {
    const response = await axios.post(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
        { body },
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const updateIssueNote = async (gitlabUrl: string, projectId: string, issueIid: number, noteId: number, body: string, token: string) => {
    const response = await axios.put(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/notes/${noteId}`,
        { body },
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const deleteIssueNote = async (gitlabUrl: string, projectId: string, issueIid: number, noteId: number, token: string) => {
    await axios.delete(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/notes/${noteId}`,
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
};

// Issues API methods
const getProjectIssues = async (gitlabUrl: string, projectId: string, token: string, params: any = {}) => {
    const response = await axios.get(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues`,
        {
            headers: { 'PRIVATE-TOKEN': token },
            params: {
                ...params,
                per_page: 100 // Максимальное количество задач на страницу
            }
        }
    );
    return response.data;
};

const getIssue = async (gitlabUrl: string, projectId: string, issueIid: number, token: string) => {
    const response = await axios.get(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}`,
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const createIssue = async (gitlabUrl: string, projectId: string, data: any, token: string) => {
    const response = await axios.post(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues`,
        data,
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const updateIssue = async (gitlabUrl: string, projectId: string, issueIid: number, data: any, token: string) => {
    const response = await axios.put(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}`,
        data,
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const deleteIssue = async (gitlabUrl: string, projectId: string, issueIid: number, token: string) => {
    await axios.delete(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}`,
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
};

// Time tracking methods
const addTimeSpent = async (gitlabUrl: string, projectId: string, issueIid: number, duration: string, token: string) => {
    const response = await axios.post(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/add_spent_time`,
        { duration },
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const resetTimeSpent = async (gitlabUrl: string, projectId: string, issueIid: number, token: string) => {
    const response = await axios.post(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/reset_spent_time`,
        {},
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const addTimeEstimate = async (gitlabUrl: string, projectId: string, issueIid: number, duration: string, token: string) => {
    const response = await axios.post(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/add_estimate_time`,
        { duration },
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

const resetTimeEstimate = async (gitlabUrl: string, projectId: string, issueIid: number, token: string) => {
    const response = await axios.post(
        `${gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}/reset_estimate_time`,
        {},
        {
            headers: { 'PRIVATE-TOKEN': token }
        }
    );
    return response.data;
};

// Add new endpoints
router.get('/issues/:projectId/:issueIid/notes', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid } = req.params;

        if (!gitlabUrl || !token || !projectId || !issueIid) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const notes = await getIssueNotes(gitlabUrl.toString(), projectId, Number(issueIid), token.toString());
        res.json(notes);
    } catch (error) {
        handleError(error, res);
    }
});

router.post('/issues/:projectId/:issueIid/notes', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid } = req.params;
        const { body } = req.body;

        if (!gitlabUrl || !token || !projectId || !issueIid || !body) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const note = await createIssueNote(gitlabUrl.toString(), projectId, Number(issueIid), body, token.toString());
        res.json(note);
    } catch (error) {
        handleError(error, res);
    }
});

router.put('/issues/:projectId/:issueIid/notes/:noteId', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid, noteId } = req.params;
        const { body } = req.body;

        if (!gitlabUrl || !token || !projectId || !issueIid || !noteId || !body) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const note = await updateIssueNote(gitlabUrl.toString(), projectId, Number(issueIid), Number(noteId), body, token.toString());
        res.json(note);
    } catch (error) {
        handleError(error, res);
    }
});

router.delete('/issues/:projectId/:issueIid/notes/:noteId', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid, noteId } = req.params;

        if (!gitlabUrl || !token || !projectId || !issueIid || !noteId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        await deleteIssueNote(gitlabUrl.toString(), projectId, Number(issueIid), Number(noteId), token.toString());
        res.sendStatus(204);
    } catch (error) {
        handleError(error, res);
    }
});

// Time tracking endpoints
router.post('/issues/:projectId/:issueIid/time_spent', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid } = req.params;
        const { duration } = req.body;

        if (!gitlabUrl || !token || !projectId || !issueIid || !duration) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const timeTracking = await addTimeSpent(gitlabUrl.toString(), projectId, Number(issueIid), duration, token.toString());
        res.json(timeTracking);
    } catch (error) {
        handleError(error, res);
    }
});

router.post('/issues/:projectId/:issueIid/reset_time_spent', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid } = req.params;

        if (!gitlabUrl || !token || !projectId || !issueIid) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const timeTracking = await resetTimeSpent(gitlabUrl.toString(), projectId, Number(issueIid), token.toString());
        res.json(timeTracking);
    } catch (error) {
        handleError(error, res);
    }
});

router.post('/issues/:projectId/:issueIid/time_estimate', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid } = req.params;
        const { duration } = req.body;

        if (!gitlabUrl || !token || !projectId || !issueIid || !duration) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const timeTracking = await addTimeEstimate(gitlabUrl.toString(), projectId, Number(issueIid), duration, token.toString());
        res.json(timeTracking);
    } catch (error) {
        handleError(error, res);
    }
});

router.post('/issues/:projectId/:issueIid/reset_time_estimate', async (req: Request, res: Response) => {
    try {
        const { gitlabUrl, token } = req.query;
        const { projectId, issueIid } = req.params;

        if (!gitlabUrl || !token || !projectId || !issueIid) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const timeTracking = await resetTimeEstimate(gitlabUrl.toString(), projectId, Number(issueIid), token.toString());
        res.json(timeTracking);
    } catch (error) {
        handleError(error, res);
    }
});

// Update issue labels and assignee
router.put('/issues/:projectId/:issueIid', async (req: Request, res: Response) => {
    try {
        const { projectId, issueIid } = req.params;
        const { gitlabUrl, token } = req.query;
        const { labels, assignee_id, title, description, due_date, start_date } = req.body;

        if (!gitlabUrl || !token || !projectId || !issueIid) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const baseUrl = normalizeGitLabUrl(gitlabUrl.toString());
        const gitlabClient = createGitLabClient(baseUrl, token as string);

        console.log('Updating issue with params:', {
            projectId,
            issueIid,
            labels,
            assignee_id,
            title,
            description,
            due_date,
            start_date,
            baseUrl
        });

        // Update issue with new labels, assignee, title, description and dates
        const response = await gitlabClient.put(`/api/v4/projects/${projectId}/issues/${issueIid}`, {
            ...(labels && { labels }), // Add labels only if they are provided
            ...(assignee_id !== undefined && { assignee_id }), // Add assignee_id only if it is provided
            ...(title && { title }), // Add title only if it is provided
            ...(description !== undefined && { description }), // Add description only if it is provided
            ...(due_date !== undefined && { due_date }), // Add due_date only if it is provided
            ...(start_date !== undefined && { created_at: start_date }) // Add start_date only if it is provided
        });

        console.log('GitLab API response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error updating issue:', error);
        if (axios.isAxiosError(error)) {
            console.error('GitLab API error response:', error.response?.data);
        }
        handleError(error, res);
    }
});

export const gitlabRouter = router;