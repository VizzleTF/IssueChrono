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
  LinearProgress,
} from '@mui/material';
import axios from 'axios';
import GanttChart from './components/GanttChart';
import TaskModal from './components/TaskModal';
import { getApiUrl } from './utils/api';
import { clearImageCache } from './hooks/useImageCache';
import { Task } from './types/Task';

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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
    const gitlabUrl = localStorage.getItem('gitlabUrl');
    const token = localStorage.getItem('token');

    if (!gitlabUrl || !token || !projectId) {
      setError('Please enter GitLab URL, token and project IDs');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingStep('Connecting to GitLab...');
      setLoadingProgress(0);
      setTotalProgress(0);
      setError(null);

      // Clean and validate project IDs
      const cleanProjectIds = projectId
        .split(/[\s,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (cleanProjectIds.length === 0) {
        throw new Error('Please enter at least one project ID');
      }

      // Step 1: Test connection
      await axios.get(`${getApiUrl()}/gitlab/test`, {
        params: {
          gitlabUrl: `https://${gitlabUrl}`,
          token
        }
      });

      // Step 2: Load issues for each project
      setLoadingStep('Loading issues...');
      setLoadingProgress(0);
      setTotalProgress(cleanProjectIds.length);

      let allTasks: Task[] = [];
      for (let i = 0; i < cleanProjectIds.length; i++) {
        const projectId = cleanProjectIds[i];
        try {
          const issuesResponse = await axios.get(
            `${getApiUrl()}/gitlab/issues`,
            {
              params: {
                gitlabUrl: `https://${gitlabUrl}`,
                projectId,
                token
              }
            }
          );

          // Ensure response.data is an array
          const projectTasks = Array.isArray(issuesResponse.data) ? issuesResponse.data : [];
          allTasks = [...allTasks, ...projectTasks];
          setLoadingProgress(i + 1);
        } catch (error) {
          console.error(`Error loading issues for project ${projectId}:`, error);
        }
      }

      // Step 3: Process and sort tasks
      setLoadingStep('Processing tasks...');
      setLoadingProgress(0);
      setTotalProgress(allTasks.length);

      const processedTasks = allTasks
        .filter(task => task.start) // Filter tasks with start date
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      setTasks(processedTasks);
      setLoadingStep('Complete!');
      setConnected(true);
    } catch (error: any) {
      console.error('Connection error:', error);
      setError(error.message || 'Failed to connect to GitLab. Please check your URL and token.');
      setConnected(false);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setLoadingStep('');
      }, 1000);
    }
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
        minHeight: '97.5vh',
        height: '97.5vh',
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
                helperText="Multiple projectIDs"
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
                disabled={isLoading || !gitlabUrl || !projectId || !token}
                sx={{
                  height: 56,
                  px: 4,
                  alignSelf: 'start',
                  mt: 1
                }}
              >
                {isLoading ? (
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

        {/* Loading Progress */}
        {isLoading && (
          <Box sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            bgcolor: 'background.paper',
            p: 4,
            borderRadius: 2,
            boxShadow: 24,
            maxWidth: 400,
            width: '90%',
          }}>
            <Typography variant="h6" color="primary" align="center" gutterBottom>
              {loadingStep}
            </Typography>
            {totalProgress > 0 && (
              <>
                <LinearProgress
                  variant="determinate"
                  value={(loadingProgress / totalProgress) * 100}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    mb: 1,
                    bgcolor: alpha('#1976d2', 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                    }
                  }}
                />
                <Typography variant="body2" color="text.secondary" align="center">
                  {loadingProgress} of {totalProgress} {loadingStep.includes('issues') ? 'projects' : 'tasks'} loaded
                </Typography>
              </>
            )}
          </Box>
        )}

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
