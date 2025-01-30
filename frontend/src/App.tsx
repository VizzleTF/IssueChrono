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
  useTheme,
  ThemeProvider,
  createTheme,
  alpha,
} from '@mui/material';
import axios from 'axios';
import GanttChart from './components/GanttChart';
import TaskModal from './components/TaskModal';

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
  created_at: string;
  due_date: string | null;
  labels: Array<{
    name: string;
    color: string;
    text_color: string;
  }>;
  assignees: Array<{
    id: number;
    name: string;
    avatar_url: string;
  }>;
  projectId: string;
  iid: number;
  start: string;
  end: string | null;
  progress: number;
  dependencies: string[];
  type: string;
  hideChildren: boolean;
  displayOrder: number;
  web_url: string;
  author: {
    id: number;
    name: string;
    avatar_url: string;
  };
  updated_at: string;
  weight: number | undefined;
  milestone: any;
  time_stats: {
    time_estimate: number;
    total_time_spent: number;
  };
  notes: any[];
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
      // Clean and validate project IDs
      const cleanProjectIds = projectId
        .split(/[\s,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (cleanProjectIds.length === 0) {
        throw new Error('Please enter at least one project ID');
      }

      const response = await axios.get(`${import.meta.env.VITE_API_URL}/gitlab/issues`, {
        params: {
          gitlabUrl: `https://${gitlabUrl}`,
          projectId: cleanProjectIds.join(','),
          token
        }
      });
      setTasks(response.data);
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

  const handleTitleChange = (taskId: number, newTitle: string) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, name: newTitle };
      }
      return task;
    }));
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
        `http://localhost:3001/api/gitlab/issues/${task.projectId}/${task.iid}`,
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

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{
        minHeight: '100vh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        py: { xs: 2, sm: 3 },
        px: { xs: 2, sm: 3 },
      }}>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 2, sm: 3 } }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                mb: 1,
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light} 90%)`,
                backgroundClip: 'text',
                textFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              GitLab Gantt Visualizer
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto' }}
            >
              Visualize your GitLab project timeline with an interactive Gantt chart
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3 },
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(8px)',
            }}
          >
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 2fr auto' },
              gap: 2,
              alignItems: 'start',
            }}>
              <TextField
                label="GitLab URL"
                value={gitlabUrl}
                onChange={(e) => setGitlabUrl(e.target.value)}
                placeholder="gitlab.example.com"
                sx={{ mt: 1 }}
              />
              <TextField
                label="Project IDs"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Enter project IDs"
                helperText="Multiple IDs can be separated by space or comma"
                type="text"
              />
              <TextField
                label="Access Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                sx={{ mt: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleConnect}
                disabled={loading || !gitlabUrl || !projectId || !token}
                sx={{
                  height: 56,
                  px: 4,
                  alignSelf: 'start',
                  mt: 1
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Connect'
                )}
              </Button>
            </Box>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mt: 2,
                  '& .MuiAlert-icon': {
                    color: 'error.main'
                  }
                }}
              >
                {error}
              </Alert>
            )}
          </Paper>
        </Box>

        {connected && tasks.length > 0 && (
          <Box sx={{
            flex: 1,
            minHeight: 0,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'divider',
            borderRadius: 3,
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
          }}>
            <GanttChart tasks={tasks} />
          </Box>
        )}

        {selectedTask && (
          <TaskModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onLabelChange={handleLabelChange}
            onAssigneeChange={handleAssigneeChange}
            onTitleChange={handleTitleChange}
            onDescriptionChange={handleDescriptionChange}
            onDateChange={handleDateChange}
            uniqueLabels={uniqueLabels}
            allUsers={allUsers}
          />
        )}
      </Box>
    </ThemeProvider>
  );
};

export default App;
