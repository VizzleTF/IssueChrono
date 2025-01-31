import React, { useState, useEffect, memo, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    Avatar,
    Chip,
    Stack,
    Link,
    LinearProgress,
    OutlinedInput,
    Popover,
    FormControl,
    Select,
    MenuItem,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import UpdateIcon from '@mui/icons-material/Update';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CommentIcon from '@mui/icons-material/Comment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { getApiUrl } from '../utils/api';

interface TaskModalProps {
    task: any;
    onClose: () => void;
    onLabelChange: (taskId: number, newLabels: string[]) => void;
    onAssigneeChange: (taskId: number, newAssigneeId: number | null) => void;
    onTitleChange: (taskId: number, newTitle: string) => void;
    onDescriptionChange: (taskId: number, newDescription: string) => void;
    onDateChange: (taskId: number, field: 'start_date' | 'due_date', value: string | null) => void;
    onMilestoneChange?: (taskId: number, milestoneId: number | null) => void;
    uniqueLabels: string[];
    allUsers: Array<{
        id: number;
        name: string;
        avatar_url: string;
    }>;
}

// Add type for note
interface Note {
    id: number;
    body: string;
    author?: {
        id: number;
        name: string;
        avatar_url: string;
    };
    created_at: string;
}

// Memoized Avatar component
const UserAvatar = memo(({ src, name, size = 32 }: { src: string; name: string; size?: number }) => (
    <Avatar
        src={src}
        alt={name}
        sx={{ width: size, height: size }}
    />
));

const TaskModal: React.FC<TaskModalProps> = ({
    task,
    onClose,
    onLabelChange,
    onAssigneeChange,
    onTitleChange,
    onDescriptionChange,
    onDateChange,
    onMilestoneChange,
    uniqueLabels,
    allUsers
}) => {
    const theme = useTheme();
    const [labelSearchText, setLabelSearchText] = useState('');
    const [labelAnchorEl, setLabelAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [assigneeAnchorEl, setAssigneeAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.name);
    const [editedDescription, setEditedDescription] = useState(task.description || '');
    const [newComment, setNewComment] = useState('');
    const [editingComment, setEditingComment] = useState<{ id: number; body: string } | null>(null);
    const [notes, setNotes] = useState<Note[]>(task.notes || []);
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [milestones, setMilestones] = useState<Array<{
        id: number;
        title: string;
        due_date?: string;
    }>>([]);
    const [loadingMilestones, setLoadingMilestones] = useState(false);

    // Load notes when modal opens
    useEffect(() => {
        loadNotes();
    }, [task.id]);

    // Force layout recalculation after notes are loaded
    useEffect(() => {
        if (!isLoadingNotes && contentRef.current) {
            // Принудительно вызываем reflow
            contentRef.current.style.display = 'none';
            contentRef.current.offsetHeight; // trigger reflow
            contentRef.current.style.display = '';
        }
    }, [isLoadingNotes, notes]);

    // Load milestones when modal opens
    useEffect(() => {
        const loadMilestones = async () => {
            try {
                setLoadingMilestones(true);
                const gitlabUrl = localStorage.getItem('gitlabUrl');
                const token = localStorage.getItem('token');

                if (!gitlabUrl || !token || !task.projectId) {
                    console.error('Missing required parameters');
                    return;
                }

                const response = await axios.get(
                    `${getApiUrl()}/gitlab/projects/${task.projectId}/milestones`,
                    {
                        params: {
                            gitlabUrl: `https://${gitlabUrl}`,
                            token
                        }
                    }
                );

                setMilestones(response.data);
            } catch (error) {
                console.error('Error loading milestones:', error);
            } finally {
                setLoadingMilestones(false);
            }
        };

        loadMilestones();
    }, [task.projectId]);

    const loadNotes = async () => {
        try {
            setIsLoadingNotes(true);
            const gitlabUrl = localStorage.getItem('gitlabUrl');
            const token = localStorage.getItem('token');

            if (!gitlabUrl || !token || !task.projectId || !task.iid) {
                console.error('Missing required parameters');
                return;
            }

            const response = await axios.get(
                `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}/notes`,
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            setNotes(response.data);
        } catch (error) {
            console.error('Error loading notes:', error);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        try {
            const gitlabUrl = localStorage.getItem('gitlabUrl');
            const token = localStorage.getItem('token');

            if (!gitlabUrl || !token || !task.projectId || !task.iid) {
                console.error('Missing required parameters');
                return;
            }

            const response = await axios.post(
                `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}/notes`,
                { body: newComment },
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            setNotes([response.data, ...notes]);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleUpdateComment = async (noteId: number) => {
        if (!editingComment || !editingComment.body.trim()) return;

        try {
            const gitlabUrl = localStorage.getItem('gitlabUrl');
            const token = localStorage.getItem('token');

            if (!gitlabUrl || !token || !task.projectId || !task.iid) {
                console.error('Missing required parameters');
                return;
            }

            const response = await axios.put(
                `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}/notes/${noteId}`,
                { body: editingComment.body },
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            setNotes(notes.map(note => note.id === noteId ? response.data : note));
            setEditingComment(null);
        } catch (error) {
            console.error('Error updating comment:', error);
        }
    };

    const handleDeleteComment = async (noteId: number) => {
        try {
            const gitlabUrl = localStorage.getItem('gitlabUrl');
            const token = localStorage.getItem('token');

            if (!gitlabUrl || !token || !task.projectId || !task.iid) {
                console.error('Missing required parameters');
                return;
            }

            await axios.delete(
                `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}/notes/${noteId}`,
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            setNotes(notes.filter(note => note.id !== noteId));
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    // Helper function to ensure color has # prefix
    const normalizeColor = (color: string) => {
        if (!color) return '#000000';
        return color.startsWith('#') ? color : `#${color}`;
    };

    // Helper function to create rgba from hex
    const hexToRgba = (hex: string, alpha: number) => {
        const color = normalizeColor(hex);
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Function to format time in hours and minutes
    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours === 0) {
            return `${minutes}m`;
        } else if (minutes === 0) {
            return `${hours}h`;
        }
        return `${hours}h ${minutes}m`;
    };

    const handleTitleSave = () => {
        if (editedTitle.trim() !== task.name) {
            onTitleChange(task.id, editedTitle.trim());
        }
        setIsEditingTitle(false);
    };

    const handleDescriptionSave = () => {
        if (editedDescription.trim() !== task.description) {
            onDescriptionChange(task.id, editedDescription.trim());
        }
        setIsEditingDescription(false);
    };

    const handleDateChange = async (field: 'start_date' | 'due_date', value: string | null) => {
        try {
            const gitlabUrl = localStorage.getItem('gitlabUrl');
            const token = localStorage.getItem('token');

            if (!gitlabUrl || !token || !task.projectId || !task.iid) {
                console.error('Missing required parameters');
                return;
            }

            await axios.put(
                `${getApiUrl()}/gitlab/issues/${task.projectId}/${task.iid}`,
                { [field]: value },
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            if (typeof onDateChange === 'function') {
                onDateChange(task.id, field, value);
            }
        } catch (error) {
            console.error('Error updating date:', error);
        }
    };

    const handleMilestoneChange = async (milestoneId: number | null) => {
        try {
            const gitlabUrl = localStorage.getItem('gitlabUrl');
            const token = localStorage.getItem('token');

            if (!gitlabUrl || !token || !task.projectId) {
                console.error('Missing required parameters');
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

            if (onMilestoneChange) {
                onMilestoneChange(task.id, milestoneId);
            }
        } catch (error) {
            console.error('Error updating milestone:', error);
        }
    };

    return (
        <Box
            onClick={onClose}
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                p: 2
            }}
        >
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    width: '90%',
                    maxWidth: 1000,
                    height: '77.7vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: theme.shadows[10],
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <Box sx={{
                    p: 2,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    flexShrink: 0
                }}>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {isEditingTitle ? (
                                <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
                                    <OutlinedInput
                                        value={editedTitle}
                                        onChange={(e) => setEditedTitle(e.target.value)}
                                        fullWidth
                                        autoFocus
                                        size="small"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleTitleSave();
                                            }
                                        }}
                                        onBlur={handleTitleSave}
                                    />
                                </Box>
                            ) : (
                                <Typography
                                    variant="h6"
                                    sx={{
                                        wordBreak: 'break-word',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            bgcolor: 'action.hover',
                                            borderRadius: 1
                                        },
                                        p: 1
                                    }}
                                    onClick={() => setIsEditingTitle(true)}
                                >
                                    {task.projectId ? `[${task.projectId}] ${task.name}` : task.name}
                                </Typography>
                            )}
                            <Chip
                                label={`#${task.id}`}
                                size="small"
                                sx={{
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: theme.palette.primary.main,
                                    fontWeight: 600
                                }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary', typography: 'body2', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <UpdateIcon sx={{ fontSize: 16 }} />
                                Created {task.created_at ? new Date(task.created_at).toLocaleString() : 'N/A'}
                            </Box>
                            {task.author && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <UserAvatar
                                        src={task.author.avatar_url}
                                        name={task.author.name}
                                        size={20}
                                    />
                                    {task.author.name}
                                </Box>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {task.web_url && (
                            <Button
                                variant="outlined"
                                href={task.web_url}
                                target="_blank"
                                startIcon={<OpenInNewIcon />}
                                size="small"
                            >
                                Open in GitLab
                            </Button>
                        )}
                        <IconButton onClick={onClose} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>

                {/* Scrollable Content Container */}
                <Box
                    ref={contentRef}
                    sx={{
                        flex: 1,
                        overflow: 'auto',
                        minHeight: 0
                    }}
                >
                    {/* Main Content */}
                    <Box sx={{ p: 2 }}>
                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr',
                            gap: 2,
                            minHeight: 0
                        }}>
                            {/* Left column */}
                            <Box>
                                {/* Description */}
                                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Description
                                        </Typography>
                                        {!isEditingDescription && (
                                            <Button
                                                size="small"
                                                onClick={() => setIsEditingDescription(true)}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Box>
                                    {isEditingDescription ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <OutlinedInput
                                                value={editedDescription}
                                                onChange={(e) => setEditedDescription(e.target.value)}
                                                fullWidth
                                                multiline
                                                minRows={4}
                                                autoFocus
                                            />
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                <Button
                                                    size="small"
                                                    onClick={() => {
                                                        setEditedDescription(task.description || '');
                                                        setIsEditingDescription(false);
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    onClick={handleDescriptionSave}
                                                >
                                                    Save
                                                </Button>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Typography
                                            component="div"
                                            sx={{
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                '& a': { color: 'primary.main' }
                                            }}
                                        >
                                            {task.description || 'Нет описания'}
                                        </Typography>
                                    )}
                                </Paper>

                                {/* Comments */}
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                        <CommentIcon sx={{ color: 'text.secondary' }} />
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Comments ({notes.length})
                                        </Typography>
                                    </Box>

                                    {/* New comment input */}
                                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                        <OutlinedInput
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Write a comment..."
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            sx={{ mb: 1 }}
                                        />
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={handleAddComment}
                                                disabled={!newComment.trim()}
                                            >
                                                Comment
                                            </Button>
                                        </Box>
                                    </Paper>

                                    {/* Comments list */}
                                    <Box sx={{ position: 'relative' }}>
                                        {isLoadingNotes ? (
                                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                                <LinearProgress sx={{ mb: 2 }} />
                                                <Typography variant="body2" color="text.secondary">
                                                    Loading comments...
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Stack spacing={2}>
                                                {notes.map((note: any) => (
                                                    <Paper key={note.id} variant="outlined" sx={{ p: 2 }}>
                                                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                                            {note.author && (
                                                                <UserAvatar src={note.author.avatar_url} name={note.author.name} />
                                                            )}
                                                            <Box sx={{ flex: 1 }}>
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                    <Typography variant="subtitle2">
                                                                        {note.author?.name || 'Unknown'}
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {note.created_at ? new Date(note.created_at).toLocaleString() : 'N/A'}
                                                                        </Typography>
                                                                        {note.author?.id === task.author?.id && (
                                                                            <>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => setEditingComment({ id: note.id, body: note.body })}
                                                                                >
                                                                                    <EditIcon fontSize="small" />
                                                                                </IconButton>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => handleDeleteComment(note.id)}
                                                                                >
                                                                                    <DeleteIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </>
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                                {editingComment?.id === note.id ? (
                                                                    <Box sx={{ mt: 1 }}>
                                                                        <OutlinedInput
                                                                            value={editingComment?.body || ''}
                                                                            onChange={(e) => {
                                                                                if (editingComment) {
                                                                                    setEditingComment({
                                                                                        id: editingComment.id,
                                                                                        body: e.target.value
                                                                                    });
                                                                                }
                                                                            }}
                                                                            fullWidth
                                                                            multiline
                                                                            minRows={2}
                                                                            sx={{ mb: 1 }}
                                                                        />
                                                                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                                            <Button
                                                                                size="small"
                                                                                onClick={() => setEditingComment(null)}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                            <Button
                                                                                variant="contained"
                                                                                size="small"
                                                                                onClick={() => handleUpdateComment(note.id)}
                                                                                disabled={!editingComment?.body.trim()}
                                                                            >
                                                                                Save
                                                                            </Button>
                                                                        </Box>
                                                                    </Box>
                                                                ) : (
                                                                    <Typography
                                                                        component="div"
                                                                        sx={{
                                                                            whiteSpace: 'pre-wrap',
                                                                            '& a': { color: 'primary.main' }
                                                                        }}
                                                                    >
                                                                        {note.body}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </Paper>
                                                ))}
                                            </Stack>
                                        )}
                                    </Box>
                                </Box>
                            </Box>

                            {/* Right column */}
                            <Box>
                                {/* Dates */}
                                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2 }}>
                                        Dates
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                Start Date
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CalendarTodayIcon sx={{ color: 'text.secondary' }} />
                                                <input
                                                    type="date"
                                                    value={task.created_at ? task.created_at.split('T')[0] : ''}
                                                    onChange={(e) => handleDateChange('start_date', e.target.value || null)}
                                                    style={{
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid rgba(0, 0, 0, 0.23)',
                                                        width: '100%',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                Due Date
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FlagIcon sx={{ color: 'text.secondary' }} />
                                                <input
                                                    type="date"
                                                    value={task.due_date ? task.due_date.split('T')[0] : ''}
                                                    onChange={(e) => handleDateChange('due_date', e.target.value || null)}
                                                    style={{
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid rgba(0, 0, 0, 0.23)',
                                                        width: '100%',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Stack>
                                </Paper>

                                {/* Progress */}
                                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                    <Box sx={{ mb: 1 }}>
                                        <Typography variant="subtitle2">Progress</Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={task.progress || 0}
                                        sx={{
                                            height: 8,
                                            borderRadius: 1,
                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                            mb: 1
                                        }}
                                    />
                                    <Typography variant="body2" color="text.secondary" align="right">
                                        {task.progress || 0}%
                                    </Typography>
                                </Paper>

                                {/* Assignees */}
                                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                        <Typography variant="subtitle2">Assignee</Typography>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => setAssigneeAnchorEl(e.currentTarget)}
                                        >
                                            <PersonAddIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                    <Stack spacing={1}>
                                        {task.assignees?.[0] && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <UserAvatar
                                                    src={task.assignees[0].avatar_url}
                                                    name={task.assignees[0].name}
                                                    size={24}
                                                />
                                                <Typography variant="body2">{task.assignees[0].name}</Typography>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        onAssigneeChange(task.id, null);
                                                    }}
                                                    sx={{ ml: 'auto' }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </Stack>
                                    <Popover
                                        open={Boolean(assigneeAnchorEl)}
                                        anchorEl={assigneeAnchorEl}
                                        onClose={() => setAssigneeAnchorEl(null)}
                                        anchorOrigin={{
                                            vertical: 'bottom',
                                            horizontal: 'left',
                                        }}
                                        transformOrigin={{
                                            vertical: 'top',
                                            horizontal: 'left',
                                        }}
                                        PaperProps={{
                                            sx: { width: '100%', maxWidth: 300, maxHeight: 400 }
                                        }}
                                    >
                                        <Box sx={{ p: 1 }}>
                                            {allUsers
                                                .filter(user => !task.assignees?.find((a: any) => a.id === user.id))
                                                .map((user) => (
                                                    <Box
                                                        key={user.id}
                                                        onClick={() => {
                                                            onAssigneeChange(task.id, user.id);
                                                            setAssigneeAnchorEl(null);
                                                        }}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1,
                                                            p: 1,
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                bgcolor: 'action.hover'
                                                            },
                                                            borderRadius: 1
                                                        }}
                                                    >
                                                        <UserAvatar
                                                            src={user.avatar_url}
                                                            name={user.name}
                                                            size={24}
                                                        />
                                                        <Typography variant="body2">{user.name}</Typography>
                                                    </Box>
                                                ))}
                                        </Box>
                                    </Popover>
                                </Paper>

                                {/* Labels */}
                                {task.labels && (
                                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                            Labels
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                                            {task.labels.map((label: any) => {
                                                const backgroundColor = normalizeColor(label.color);
                                                const textColor = normalizeColor(label.text_color);

                                                return (
                                                    <Chip
                                                        key={label.name}
                                                        label={label.name}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: backgroundColor,
                                                            color: textColor,
                                                            fontWeight: 500,
                                                            transition: 'all 0.2s ease-in-out',
                                                            '&:hover': {
                                                                bgcolor: hexToRgba(backgroundColor, 0.8),
                                                                transform: 'translateY(-1px)',
                                                                boxShadow: 1
                                                            },
                                                            height: 24,
                                                            borderRadius: '12px',
                                                            '& .MuiChip-label': {
                                                                px: 1.5,
                                                                py: 0.5,
                                                                fontSize: '0.75rem',
                                                                lineHeight: 1
                                                            }
                                                        }}
                                                        onDelete={() => {
                                                            const newLabels = task.labels
                                                                .filter((l: any) => l.name !== label.name)
                                                                .map((l: any) => l.name);
                                                            onLabelChange(task.id, newLabels);
                                                        }}
                                                    />
                                                );
                                            })}
                                        </Box>
                                        <Box>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={(e) => setLabelAnchorEl(e.currentTarget)}
                                                fullWidth
                                                sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
                                            >
                                                Add label...
                                            </Button>
                                            <Popover
                                                open={Boolean(labelAnchorEl)}
                                                anchorEl={labelAnchorEl}
                                                onClose={() => setLabelAnchorEl(null)}
                                                anchorOrigin={{
                                                    vertical: 'bottom',
                                                    horizontal: 'left',
                                                }}
                                                transformOrigin={{
                                                    vertical: 'top',
                                                    horizontal: 'left',
                                                }}
                                                PaperProps={{
                                                    sx: { width: '100%', maxWidth: 300, maxHeight: 400 }
                                                }}
                                            >
                                                <Box sx={{ p: 1 }}>
                                                    <OutlinedInput
                                                        size="small"
                                                        fullWidth
                                                        placeholder="Search labels..."
                                                        value={labelSearchText}
                                                        onChange={(e) => setLabelSearchText(e.target.value)}
                                                        autoFocus
                                                        sx={{
                                                            mb: 1,
                                                            '& .MuiOutlinedInput-input': {
                                                                py: 1
                                                            }
                                                        }}
                                                    />
                                                    {uniqueLabels
                                                        .filter(label =>
                                                            !task.labels.find((l: any) => l.name === label) &&
                                                            label.toLowerCase().includes(labelSearchText.toLowerCase())
                                                        )
                                                        .map((label) => {
                                                            const labelDetails = task.labels.find((l: any) => l.name === label);
                                                            const backgroundColor = labelDetails ? normalizeColor(labelDetails.color) : theme.palette.grey[300];
                                                            const textColor = labelDetails ? normalizeColor(labelDetails.text_color) : theme.palette.getContrastText(theme.palette.grey[300]);

                                                            return (
                                                                <Box
                                                                    key={label}
                                                                    onClick={() => {
                                                                        const newLabels = [...task.labels.map((l: any) => l.name), label];
                                                                        onLabelChange(task.id, newLabels);
                                                                        setLabelAnchorEl(null);
                                                                        setLabelSearchText('');
                                                                    }}
                                                                    sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 1,
                                                                        p: 1,
                                                                        cursor: 'pointer',
                                                                        '&:hover': {
                                                                            bgcolor: 'action.hover'
                                                                        },
                                                                        borderRadius: 1
                                                                    }}
                                                                >
                                                                    <Box
                                                                        sx={{
                                                                            width: 16,
                                                                            height: 16,
                                                                            borderRadius: 1,
                                                                            bgcolor: backgroundColor,
                                                                            color: textColor
                                                                        }}
                                                                    />
                                                                    <Typography variant="body2">{label}</Typography>
                                                                </Box>
                                                            );
                                                        })}
                                                </Box>
                                            </Popover>
                                        </Box>
                                    </Paper>
                                )}

                                {/* Time Tracking */}
                                {(task.time_estimate || task.total_time_spent) && (
                                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                            <AccessTimeIcon sx={{ color: 'text.secondary' }} />
                                            <Typography variant="subtitle2">Time Tracking</Typography>
                                        </Box>
                                        <Stack spacing={1}>
                                            {task.time_estimate && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Estimated</Typography>
                                                    <Typography variant="body2">{formatTime(task.time_estimate)}</Typography>
                                                </Box>
                                            )}
                                            {task.total_time_spent && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="body2" color="text.secondary">Spent</Typography>
                                                    <Typography variant="body2">{formatTime(task.total_time_spent)}</Typography>
                                                </Box>
                                            )}
                                            {task.time_estimate && task.total_time_spent && (
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min((task.total_time_spent / task.time_estimate) * 100, 100)}
                                                    sx={{
                                                        height: 4,
                                                        borderRadius: 1,
                                                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                                                    }}
                                                />
                                            )}
                                        </Stack>
                                    </Paper>
                                )}

                                {/* Other Details */}
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                        Additional Details
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        {task.milestone && (
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Milestone</Typography>
                                                <Link
                                                    href="#"
                                                    sx={{
                                                        color: 'primary.main',
                                                        textDecoration: 'none',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                >
                                                    {task.milestone.title}
                                                </Link>
                                                {task.milestone.due_date && (
                                                    <Typography variant="caption" display="block" color="text.secondary">
                                                        Due {new Date(task.milestone.due_date).toLocaleDateString()}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                        {task.weight !== undefined && (
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Priority</Typography>
                                                <Typography variant="body2">{task.weight}</Typography>
                                            </Box>
                                        )}
                                        {task.updated_at && (
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                                                <Typography variant="body2">{new Date(task.updated_at).toLocaleString()}</Typography>
                                            </Box>
                                        )}
                                    </Stack>
                                </Paper>

                                {/* Milestone */}
                                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                        Milestone
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <Select
                                            value={task.milestone?.id || ''}
                                            onChange={(e) => handleMilestoneChange(e.target.value ? Number(e.target.value) : null)}
                                            displayEmpty
                                            disabled={loadingMilestones}
                                        >
                                            <MenuItem value="">
                                                <em>No milestone</em>
                                            </MenuItem>
                                            {milestones.map((milestone) => (
                                                <MenuItem key={milestone.id} value={milestone.id}>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography variant="body2">
                                                            {milestone.title}
                                                        </Typography>
                                                        {milestone.due_date && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                Due: {new Date(milestone.due_date).toLocaleDateString()}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Paper>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default TaskModal; 