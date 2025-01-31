import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
  ThemeProvider,
  createTheme,
  alpha,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import axios from 'axios';
import GanttChart from './components/GanttChart';
import TaskModal from './components/TaskModal';
import { getApiUrl } from './utils/api';
import { clearImageCache } from './hooks/useImageCache';

// Создаем кастомную тему
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#2c3e50',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    body1: {
      lineHeight: 1.7,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

interface Task {
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
  state: string;
  iid: number;
}

interface User {
  id: number;
  name: string;
  avatar_url: string;
}

const App = () => {
  // Load cached values from localStorage
  const [gitlabUrl, setGitlabUrl] = useState(() =>
    localStorage.getItem('gitlabUrl') || 'gitlab.com:443'
  );
  const [projectId, setProjectId] = useState(() =>
    localStorage.getItem('projectId') || ''
  );
  const [token, setToken] = useState(() =>
    localStorage.getItem('token') || ''
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(() =>
    localStorage.getItem('connected') === 'true'
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uniqueLabels, setUniqueLabels] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [period, setPeriod] = useState(() =>
    localStorage.getItem('period') || '1year'
  );

  // Save values to localStorage when they change
  useEffect(() => {
    localStorage.setItem('gitlabUrl', gitlabUrl);
  }, [gitlabUrl]);

  useEffect(() => {
    localStorage.setItem('projectId', projectId);
  }, [projectId]);

  useEffect(() => {
    localStorage.setItem('token', token);
  }, [token]);

  useEffect(() => {
    localStorage.setItem('connected', connected.toString());
  }, [connected]);

  useEffect(() => {
    localStorage.setItem('period', period);
  }, [period]);

  // Auto-connect if we have all the required data
  useEffect(() => {
    if (connected && gitlabUrl && projectId && token) {
      handleConnect();
    }
  }, []); // Run only once on mount

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      // Clear image cache before loading new project
      clearImageCache();

      // Clean and validate project IDs
      const cleanProjectIds = projectId
        .split(/[\s,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (cleanProjectIds.length === 0) {
        throw new Error('Please enter at least one project ID');
      }

      // Reset tasks and other state
      setTasks([]);
      setSelectedTask(null);
      setUniqueLabels([]);
      setAllUsers([]);

      const requestUrl = `${getApiUrl()}/gitlab/issues`;
      const requestParams = {
        gitlabUrl: `https://${gitlabUrl}`,
        projectId: cleanProjectIds.join(','),
        token,
        period
      };

      console.log('Making request to:', {
        url: requestUrl,
        params: requestParams
      });

      const response = await axios.get(requestUrl, {
        params: requestParams
      });

      console.log('GitLab API response:', {
        type: typeof response.data,
        isArray: Array.isArray(response.data),
        data: response.data
      });

      const tasksData = Array.isArray(response.data) ? response.data : [];
      setTasks(tasksData as Task[]);
      setConnected(true);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to connect');
      setConnected(false);
    }
    setLoading(false);
  };

  const handleLabelChange = (taskId: number, newLabels: string[]) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          labels: newLabels.map(label => ({
            name: label,
            color: '#000000',
            text_color: '#FFFFFF'
          }))
        };
      }
      return task;
    }));
  };

  const handleAssigneeChange = (taskId: number, newAssigneeId: number | null) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const newAssignee = allUsers.find(user => user.id === newAssigneeId);
        return {
          ...task,
          assignees: newAssignee ? [newAssignee] : []
        };
      }
      return task;
    }));
  };

  const handleTitleChange = async (taskId: number, newTitle: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task?.projectId) {
        console.error('Task project ID not found');
        return;
      }

      const gitlabUrl = localStorage.getItem('gitlabUrl');
      const token = localStorage.getItem('token');

      if (!gitlabUrl || !token) {
        console.error('GitLab URL or token not found');
        return;
      }

      await axios.put(
        `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}`,
        { title: newTitle },
        {
          params: {
            gitlabUrl: `https://${gitlabUrl}`,
            token
          }
        }
      );

      // Update local state
      setTasks(tasks.map(t => {
        if (t.id === taskId) {
          return { ...t, name: newTitle };
        }
        return t;
      }));

    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleDescriptionChange = (taskId: number, newDescription: string) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, description: newDescription };
      }
      return task;
    }));
  };

  const handleDateChange = async (taskId: number, field: 'start_date' | 'due_date', value: string | null) => {
    try {
      const gitlabUrl = localStorage.getItem('gitlabUrl');
      const token = localStorage.getItem('token');

      if (!gitlabUrl || !token) {
        console.error('Missing required parameters');
        return;
      }

      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        console.error('Task not found');
        return;
      }

      await axios.put(
        `${(window as any).RUNTIME_CONFIG.VITE_API_URL}/gitlab/issues/${task.projectId}/${task.iid}`,
        { [field]: value },
        {
          params: {
            gitlabUrl: `https://${gitlabUrl}`,
            token
          }
        }
      );

      // Update local state
      setTasks(tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            [field === 'start_date' ? 'created_at' : 'due_date']: value,
            // Also update the corresponding Gantt chart field
            [field === 'start_date' ? 'start' : 'end']: value
          };
        }
        return t;
      }));
    } catch (error) {
      console.error('Error updating date:', error);
    }
  };

  const handleMilestoneChange = async (taskId: number, milestoneId: number | null) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task?.projectId) {
        console.error('Task project ID not found');
        return;
      }

      const gitlabUrl = localStorage.getItem('gitlabUrl');
      const token = localStorage.getItem('token');

      if (!gitlabUrl || !token) {
        console.error('GitLab URL or token not found');
        return;
      }

      await axios.put(
        `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}`,
        { milestone_id: milestoneId },
        {
          params: {
            gitlabUrl: `https://${gitlabUrl}`,
            token
          }
        }
      );

      // Update local state
      setTasks(tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            milestone: milestoneId ? {
              id: milestoneId,
              title: '', // Will be updated in next data fetch
              due_date: null
            } : null
          };
        }
        return t;
      }));

    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}>
        {/* Connection form */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={2.5}>
              <TextField
                fullWidth
                label="GitLab URL"
                value={gitlabUrl}
                onChange={(e) => setGitlabUrl(e.target.value)}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={2.5}>
              <TextField
                fullWidth
                label="Project ID"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={2.5}>
              <TextField
                fullWidth
                label="Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                size="small"
                type="password"
              />
            </Grid>
            <Grid item xs={12} sm={2.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  disabled={loading}
                  label="Period"
                >
                  <MenuItem value="1month">Last Month</MenuItem>
                  <MenuItem value="3months">Last 3 Months</MenuItem>
                  <MenuItem value="6months">Last 6 Months</MenuItem>
                  <MenuItem value="1year">Last Year</MenuItem>
                  <MenuItem value="all">All Time</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <LoadingButton
                fullWidth
                variant="contained"
                onClick={handleConnect}
                loading={loading}
              >
                Connect
              </LoadingButton>
            </Grid>
          </Grid>
          {error && (
            <Typography color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </Box>

        {/* Main content */}
        <Box sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000
              }}
            >
              <LinearProgress />
            </Box>
          )}
          {connected && tasks && <GanttChart tasks={tasks} />}
        </Box>

        {selectedTask && (
          <TaskModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onLabelChange={handleLabelChange}
            onAssigneeChange={handleAssigneeChange}
            onTitleChange={handleTitleChange}
            onDescriptionChange={handleDescriptionChange}
            onDateChange={handleDateChange}
            onMilestoneChange={handleMilestoneChange}
            uniqueLabels={uniqueLabels}
            allUsers={allUsers}
          />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default App;
