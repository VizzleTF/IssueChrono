import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
import {
    Box,
    Slider,
    useTheme,
    Select,
    MenuItem,
    Chip,
    Avatar,
    FormControl,
    InputLabel,
    OutlinedInput,
    Button,
    Typography,
    SelectChangeEvent,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import axios from 'axios';
import TaskModal from './TaskModal';
import useImageCache from '../hooks/useImageCache';
import { getApiUrl } from '../utils/api';

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
        due_date?: string;
    };
    iid: number;
    state: string;
}

interface GanttChartProps {
    tasks: Task[];
}

// Memoized Avatar component with image caching
const UserAvatar = memo(({ src, name, size = 24 }: { src: string; name: string; size?: number }) => {
    const cachedImage = useImageCache(src);
    return (
        <Avatar
            src={cachedImage?.src || src}
            alt={name}
            sx={{
                width: size,
                height: size,
                fontSize: size * 0.5,
                border: '2px solid white'
            }}
        />
    );
});

const GanttChart: React.FC<GanttChartProps> = ({ tasks: initialTasks }) => {
    const theme = useTheme();
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [verticalScroll, setVerticalScroll] = useState(0);
    const [maxScroll, setMaxScroll] = useState(0);
    const [maxVerticalScroll, setMaxVerticalScroll] = useState(0);
    const [horizontalSliderValue, setHorizontalSliderValue] = useState(0);
    const [verticalSliderValue, setVerticalSliderValue] = useState(0);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const avatarCache = useMemo(() => new Map<string, HTMLImageElement>(), []);
    const [selectedMilestones, setSelectedMilestones] = useState<number[]>(() => {
        try {
            const cached = localStorage.getItem('selectedMilestones');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [showClosedIssues, setShowClosedIssues] = useState<boolean>(() => {
        try {
            const cached = localStorage.getItem('showClosedIssues');
            return cached ? JSON.parse(cached) : false;
        } catch {
            return false;
        }
    });

    // Clear cache and update tasks when initialTasks change
    useEffect(() => {
        avatarCache.clear(); // Clear avatar cache
        setTasks(initialTasks);
    }, [initialTasks]);

    // Chart constants
    const dayWidth = 7;
    const taskHeight = 45;
    const headerHeight = 80;
    const avatarColumnWidth = 40;
    const infoColumnWidth = 400;
    const taskNameHeight = 15;
    const labelsHeight = 18;
    const labelSpacing = 10;
    const tooltipOffset = -200;
    const barHeight = 32;
    const barPadding = (taskHeight - barHeight) / 2;

    // Load cached filter values
    const [selectedLabels, setSelectedLabels] = useState<string[]>(() => {
        try {
            const cached = localStorage.getItem('selectedLabels');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [excludedLabels, setExcludedLabels] = useState<string[]>(() => {
        try {
            const cached = localStorage.getItem('excludedLabels');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [statusLabels, setStatusLabels] = useState<string[]>(() => {
        try {
            const cached = localStorage.getItem('statusLabels');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [selectedAssignees, setSelectedAssignees] = useState<number[]>(() => {
        try {
            const cached = localStorage.getItem('selectedAssignees');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    // Save filter values when they change
    useEffect(() => {
        localStorage.setItem('selectedLabels', JSON.stringify(selectedLabels));
    }, [selectedLabels]);

    useEffect(() => {
        localStorage.setItem('excludedLabels', JSON.stringify(excludedLabels));
    }, [excludedLabels]);

    useEffect(() => {
        localStorage.setItem('statusLabels', JSON.stringify(statusLabels));
    }, [statusLabels]);

    useEffect(() => {
        localStorage.setItem('selectedAssignees', JSON.stringify(selectedAssignees));
    }, [selectedAssignees]);

    useEffect(() => {
        localStorage.setItem('selectedMilestones', JSON.stringify(selectedMilestones));
    }, [selectedMilestones]);

    useEffect(() => {
        localStorage.setItem('showClosedIssues', JSON.stringify(showClosedIssues));
    }, [showClosedIssues]);

    // Status colors - will be assigned dynamically based on selection order
    const STATUS_COLORS = [
        theme.palette.success.main,
        theme.palette.info.main,
        theme.palette.warning.main,
        theme.palette.error.main,
        theme.palette.secondary.main,
        theme.palette.primary.main,
        // Add more colors if needed
    ];

    // Get unique labels for filters
    const uniqueLabels = useMemo(() =>
        Array.from(new Set(tasks.flatMap(task => task.labels.map(l => l.name)))).sort(),
        [tasks]
    );

    // Get unique assignees for filters
    const uniqueAssignees = useMemo(() =>
        Array.from(new Set(tasks.flatMap(task => task.assignees || [])
            .filter(assignee => assignee && assignee.id && assignee.name)
            .map(assignee => JSON.stringify({
                id: assignee.id,
                name: assignee.name,
                avatar_url: assignee.avatar_url || ''
            }))))
            .map(str => JSON.parse(str))
            .sort((a: any, b: any) => a.name.localeCompare(b.name)),
        [tasks]
    );

    // Get unique milestones for filter
    const uniqueMilestones = useMemo(() =>
        Array.from(new Set(tasks
            .filter(task => task.milestone)
            .map(task => task.milestone!)
            .filter((milestone, index, self) =>
                index === self.findIndex(m => m.id === milestone.id))
        )).sort((a, b) => a.title.localeCompare(b.title)),
        [tasks]
    );

    // Filter tasks based on selected labels, excluded labels and assignees
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            // Filter out closed issues if not showing them
            if (!showClosedIssues && task.state === 'closed') {
                return false;
            }

            const taskLabels = task.labels.map(l => l.name) || [];

            // Check if task has any excluded labels
            if (excludedLabels.length > 0 &&
                taskLabels.some(label => excludedLabels.includes(label))) {
                return false;
            }

            // Check if task matches selected labels
            const matchesLabels = selectedLabels.length === 0 ||
                taskLabels.some(label => selectedLabels.includes(label));

            // Check if task matches selected assignees
            const matchesAssignees = selectedAssignees.length === 0 ||
                task.assignees?.some(assignee => selectedAssignees.includes(assignee.id));

            // Check if task matches selected milestones
            const matchesMilestones = selectedMilestones.length === 0 ||
                (task.milestone && selectedMilestones.includes(task.milestone.id));

            return matchesLabels && matchesAssignees && matchesMilestones;
        });
    }, [tasks, selectedLabels, excludedLabels, selectedAssignees, selectedMilestones, showClosedIssues]);

    // Design constants aligned with theme
    const colors = {
        primary: theme.palette.primary.main,
        secondary: theme.palette.primary.light,
        background: theme.palette.background.paper,
        border: theme.palette.divider,
        text: theme.palette.text.primary,
        textSecondary: theme.palette.text.secondary,
        headerBg: theme.palette.grey[50],
        taskBar: {
            bg: theme.palette.primary.light,
            progress: theme.palette.primary.main,
            border: theme.palette.primary.dark
        },
        weekend: theme.palette.grey[50]
    };

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString('default', {
            day: 'numeric',
            month: 'short'
        });
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

    // Function to generate a stable color from a string
    const generateColorFromString = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Convert hash to HSL color
        const hue = hash % 360;
        const saturation = 90; // Увеличиваем насыщенность
        const lightness = 45; // Уменьшаем яркость для более насыщенных цветов

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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

    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Проверяем клик в области информационного столбца
        if (x >= avatarColumnWidth && x <= avatarColumnWidth + infoColumnWidth && y >= headerHeight) {
            const taskIndex = Math.floor((y + verticalScroll - headerHeight) / taskHeight);
            const task = filteredTasks[taskIndex];
            if (task) {
                setSelectedTask(task);
            } else {
                setSelectedTask(null);
            }
        } else {
            setSelectedTask(null);
        }
    };

    // Get task color based on its status
    const getTaskColor = (taskLabels: Task['labels']) => {
        // Find the first matching status label
        const statusLabel = taskLabels.find(label => statusLabels.includes(label.name));

        if (statusLabel) {
            const baseColor = normalizeColor(statusLabel.color);
            return {
                bg: hexToRgba(baseColor, 0.2),
                progress: baseColor,
                border: baseColor
            };
        }

        return {
            bg: colors.taskBar.bg,
            progress: colors.taskBar.progress,
            border: colors.taskBar.border
        };
    };

    // Function to update task in the local state
    const updateTask = (taskId: number, updates: Partial<Task>) => {
        setTasks(prevTasks =>
            prevTasks.map(task =>
                task.id === taskId
                    ? { ...task, ...updates }
                    : task
            )
        );
    };

    // Update handlers with local state updates
    const handleLabelChange = async (taskId: number, newLabels: string[]) => {
        try {
            const allLabels = tasks.flatMap(t => t.labels)
                .filter((label, index, self) =>
                    index === self.findIndex(l => l.name === label.name)
                );

            const selectedLabels = newLabels
                .map(name => allLabels.find(l => l.name === name))
                .filter((label): label is Task['labels'][0] => label !== undefined);

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
                { labels: newLabels.join(',') },
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            // Update local state
            updateTask(taskId, { labels: selectedLabels });

        } catch (error) {
            console.error('Error updating labels:', error);
        }
    };

    const handleAssigneeChange = async (taskId: number, newAssigneeId: number | null) => {
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
                { assignee_id: newAssigneeId },
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            // Update local state
            const updatedAssignee = newAssigneeId ? uniqueAssignees.find(user => user.id === newAssigneeId) : null;
            updateTask(taskId, {
                assignees: updatedAssignee ? [updatedAssignee] : []
            });

        } catch (error) {
            console.error('Error updating assignee:', error);
        }
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
            updateTask(taskId, { name: newTitle });

        } catch (error) {
            console.error('Error updating title:', error);
        }
    };

    const handleDescriptionChange = async (taskId: number, newDescription: string) => {
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
                { description: newDescription },
                {
                    params: {
                        gitlabUrl: `https://${gitlabUrl}`,
                        token
                    }
                }
            );

            // Update local state
            updateTask(taskId, { description: newDescription });

        } catch (error) {
            console.error('Error updating description:', error);
        }
    };

    const handleDateChange = async (taskId: number, field: 'start_date' | 'due_date', value: string | null) => {
        // No-op for now, as we don't need to handle date changes in the Gantt chart
    };

    // Draw task bar with colors
    const drawTaskBar = (
        ctx: CanvasRenderingContext2D,
        task: Task,
        startX: number,
        endX: number,
        y: number,
        height: number,
        radius: number
    ) => {
        const barY = y + barPadding;
        const width = endX - startX;

        // Get task color based on status labels
        const taskColor = getTaskColor(task.labels);

        // Draw background
        ctx.beginPath();
        ctx.roundRect(startX, barY, width, height, radius);
        ctx.fillStyle = taskColor.bg;
        ctx.fill();

        // Draw progress
        if (task.progress > 0) {
            ctx.beginPath();
            const progressWidth = (width * task.progress) / 100;
            ctx.roundRect(startX, barY, progressWidth, height, radius);
            ctx.fillStyle = taskColor.progress;
            ctx.fill();
        }

        // Draw task name
        ctx.fillStyle = colors.text;
        ctx.font = `400 12px ${theme.typography.fontFamily}`;
        const textY = barY + height / 2 + 4;
        ctx.fillText(task.name, startX + 8, textY);

        // Draw border
        ctx.beginPath();
        ctx.roundRect(startX, barY, width, height, radius);
        ctx.strokeStyle = taskColor.border;
        ctx.stroke();

        // If task is closed, add a strikethrough line
        if (task.state === 'closed') {
            const textWidth = ctx.measureText(task.name).width;
            ctx.beginPath();
            ctx.moveTo(startX + 8, textY - 2);
            ctx.lineTo(startX + 8 + textWidth, textY - 2);
            ctx.strokeStyle = hexToRgba(colors.text, 0.8);
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    };

    // Draw label with colors
    const drawLabel = (
        ctx: CanvasRenderingContext2D,
        label: Task['labels'][0],
        x: number,
        y: number,
        width: number,
        height: number
    ) => {
        if (!label) return;

        const backgroundColor = normalizeColor(label.color);
        const textColor = normalizeColor(label.text_color);

        // Draw background
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 7);
        ctx.fillStyle = backgroundColor;
        ctx.fill();

        // Draw text
        ctx.fillStyle = textColor;
        ctx.font = '12px Roboto';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.name, x + 8, y + height / 2);
    };

    const drawAvatar = useCallback((
        ctx: CanvasRenderingContext2D,
        url: string,
        x: number,
        y: number,
        size: number
    ) => {
        if (!url) return;

        if (avatarCache.has(url)) {
            const img = avatarCache.get(url)!;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, x, y, size, size);
            ctx.restore();
            return;
        }

        const img = new Image();
        img.src = url;
        img.onload = () => {
            avatarCache.set(url, img);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, x, y, size, size);
            ctx.restore();
        };
    }, [avatarCache]);

    const drawChart = (scrollX: number = 0, scrollY: number = 0) => {
        if (!containerRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Enable smooth edges
        ctx.imageSmoothingEnabled = true;

        // Set canvas size with higher DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current.getBoundingClientRect();

        // Set minimum dimensions if rect is too small
        const minWidth = 800;
        const minHeight = 600;
        const canvasWidth = Math.max(rect.width, minWidth);
        const canvasHeight = Math.max(rect.height, minHeight);

        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        ctx.scale(dpr, dpr);

        // Clear canvas with background
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // If no tasks, show message
        if (filteredTasks.length === 0) {
            ctx.font = `500 16px ${theme.typography.fontFamily}`;
            ctx.fillStyle = colors.textSecondary;
            ctx.textAlign = 'center';
            ctx.fillText('No tasks to display', canvasWidth / 2, canvasHeight / 2);
            return;
        }

        // Calculate date range
        const dates = filteredTasks
            .flatMap(task => [new Date(task.start), task.end ? new Date(task.end) : new Date()])
            .filter(date => !isNaN(date.getTime()));

        if (dates.length === 0) return;

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Add padding to date range
        minDate.setDate(1);
        maxDate.setDate(maxDate.getDate() + 14);

        const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate total content height
        const totalContentHeight = headerHeight + filteredTasks.length * taskHeight;
        const visibleContentHeight = canvasHeight - headerHeight;

        // Update max scroll values
        setMaxScroll(Math.max(0, totalDays * dayWidth - (canvasWidth - avatarColumnWidth - infoColumnWidth)));
        setMaxVerticalScroll(Math.max(0, totalContentHeight - visibleContentHeight));

        // Ensure vertical scroll doesn't exceed maximum
        const safeVerticalScroll = Math.min(verticalScroll, maxVerticalScroll);
        if (safeVerticalScroll !== verticalScroll) {
            setVerticalScroll(safeVerticalScroll);
            setVerticalSliderValue((safeVerticalScroll / maxVerticalScroll) * 100);
        }

        // Draw header
        ctx.fillStyle = colors.headerBg;
        ctx.fillRect(avatarColumnWidth + infoColumnWidth, 0, totalDays * dayWidth, headerHeight);

        // Draw months
        ctx.font = `500 14px ${theme.typography.fontFamily}`;
        ctx.fillStyle = colors.text;

        let currentMonth = new Date(minDate);
        while (currentMonth <= maxDate) {
            const monthStartX = avatarColumnWidth + infoColumnWidth + ((currentMonth.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth - scrollX;
            const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
            const monthWidth = ((nextMonth.getTime() - currentMonth.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth;

            // Month background
            ctx.fillStyle = colors.headerBg;
            ctx.fillRect(monthStartX, 0, monthWidth, headerHeight / 2);

            // Month text
            ctx.fillStyle = colors.text;
            ctx.fillText(
                currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
                monthStartX + 16,
                32
            );

            currentMonth = nextMonth;
        }

        // Draw left column headers background
        ctx.fillStyle = colors.headerBg;
        ctx.fillRect(0, 0, avatarColumnWidth + infoColumnWidth, headerHeight);

        // Draw vertical separators for left columns
        [avatarColumnWidth, avatarColumnWidth + infoColumnWidth].forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.strokeStyle = colors.border;
            ctx.stroke();
        });

        // Draw tasks
        filteredTasks.forEach((task, index) => {
            const y = headerHeight + index * taskHeight - scrollY;
            if (y + taskHeight < headerHeight || y > canvasHeight) return;

            // Draw row background
            ctx.fillStyle = index % 2 === 0 ? colors.background : colors.headerBg;
            ctx.fillRect(0, y, canvas.width, taskHeight);

            // Draw task bar
            const startX = avatarColumnWidth + infoColumnWidth + ((new Date(task.start).getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)) * dayWidth - scrollX;
            const endX = task.end
                ? avatarColumnWidth + infoColumnWidth + ((new Date(task.end).getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)) * dayWidth - scrollX
                : startX + dayWidth;

            // Draw the task bar using the new function
            drawTaskBar(ctx, task, startX, endX, y, barHeight, 6);

            // Draw info column background (to cover task bars)
            ctx.fillStyle = index % 2 === 0 ? colors.background : colors.headerBg;
            ctx.fillRect(0, y, avatarColumnWidth + infoColumnWidth, taskHeight);

            // Draw assignee avatars in the left column
            if (task.assignees && task.assignees.length > 0) {
                const avatarSize = 28;
                const avatarY = y + (taskHeight - avatarSize) / 2;
                const maxAvatars = 1;
                const displayedAssignees = task.assignees.slice(0, maxAvatars);

                displayedAssignees.forEach((assignee, idx) => {
                    if (!assignee || !assignee.avatar_url) return;
                    const avatarX = 6 + idx * (avatarSize + 4);

                    // Avatar circle background
                    ctx.beginPath();
                    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx.fillStyle = theme.palette.grey[300];
                    ctx.fill();

                    // Draw cached avatar
                    drawAvatar(ctx, assignee.avatar_url, avatarX, avatarY, avatarSize);
                });

                // Draw +N if there are more assignees
                if (task.assignees.length > maxAvatars) {
                    const extraCount = task.assignees.length - maxAvatars;
                    const textX = 8 + maxAvatars * (avatarSize + 4);
                    ctx.font = `400 12px ${theme.typography.fontFamily}`;
                    ctx.fillStyle = colors.textSecondary;
                    ctx.fillText(`+${extraCount}`, textX, avatarY + avatarSize - 6);
                }
            }

            // Task name
            ctx.font = `500 14px ${theme.typography.fontFamily}`;
            ctx.fillStyle = colors.text;
            const taskName = task.projectId ? `[${task.projectId}] ${task.name}` : task.name;

            // Limit task name length
            const maxWidth = infoColumnWidth - 32;
            let truncatedName = taskName;
            let nameWidth = ctx.measureText(truncatedName).width;

            if (nameWidth > maxWidth) {
                while (nameWidth > maxWidth - 20 && truncatedName.length > 0) {
                    truncatedName = truncatedName.slice(0, -1);
                    nameWidth = ctx.measureText(truncatedName + '...').width;
                }
                truncatedName += '...';
            }

            ctx.fillText(truncatedName, avatarColumnWidth + 12, y + taskNameHeight);

            // Draw labels using the new function
            if (task.labels && task.labels.length > 0) {
                const labelY = y + taskNameHeight + labelSpacing;
                let currentX = avatarColumnWidth + 8;

                task.labels.forEach(label => {
                    if (!label) return;
                    const labelWidth = ctx.measureText(label.name).width + 16;
                    if (currentX + labelWidth > avatarColumnWidth + infoColumnWidth - 16) return;

                    drawLabel(ctx, label, currentX, labelY, labelWidth, labelsHeight);
                    currentX += labelWidth + 8;
                });
            }

            // Draw vertical separators for columns
            [avatarColumnWidth, avatarColumnWidth + infoColumnWidth].forEach(x => {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.strokeStyle = colors.border;
                ctx.stroke();
            });
        });

        // Draw weeks and their separators AFTER tasks
        ctx.font = `400 12px ${theme.typography.fontFamily}`;
        let weekDate = new Date(minDate);
        while (weekDate <= maxDate) {
            const x = avatarColumnWidth + infoColumnWidth + ((weekDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth - scrollX;

            // Week background
            const weekNum = Math.floor((weekDate.getTime() - minDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
            ctx.fillStyle = weekNum % 2 === 0 ? colors.weekend : colors.background;
            ctx.fillRect(x, headerHeight / 2, dayWidth * 7, headerHeight / 2);

            // Date text
            ctx.fillStyle = colors.textSecondary;
            ctx.fillText(formatDate(weekDate), x + 8, headerHeight - 16);

            // Week separator
            ctx.beginPath();
            ctx.moveTo(x, headerHeight);
            ctx.lineTo(x, canvas.height);
            ctx.strokeStyle = alpha(colors.border, 0.05);
            ctx.stroke();

            weekDate.setDate(weekDate.getDate() + 7);
        }

        // Draw final row separator
        if (filteredTasks.length > 0) {
            const y = headerHeight + filteredTasks.length * taskHeight - scrollY;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.strokeStyle = colors.border;
            ctx.stroke();
        }
    };

    useEffect(() => {
        // Reset scroll position when filtered tasks change
        setScrollPosition(0);
        setVerticalScroll(0);
        setHorizontalSliderValue(0);
        setVerticalSliderValue(0);

        // Redraw chart
        drawChart(0, 0);
    }, [filteredTasks]); // Add filteredTasks as dependency

    // Add new effect for status labels changes
    useEffect(() => {
        drawChart(scrollPosition, verticalScroll);
    }, [statusLabels]); // Redraw when status labels change

    useEffect(() => {
        // Initial draw and window resize handler
        drawChart(scrollPosition, verticalScroll);

        const handleResize = () => {
            drawChart(scrollPosition, verticalScroll);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [scrollPosition, verticalScroll]);

    const handleScroll = (event: React.WheelEvent<HTMLDivElement>) => {
        // Disable scrolling when modal is open
        if (selectedTask) return;

        if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            const newScrollPosition = Math.min(
                Math.max(0, scrollPosition + event.deltaX),
                maxScroll
            );
            setScrollPosition(newScrollPosition);
            setHorizontalSliderValue((newScrollPosition / maxScroll) * 100);
        } else {
            const newVerticalScroll = Math.min(
                Math.max(0, verticalScroll + event.deltaY),
                maxVerticalScroll
            );
            setVerticalScroll(newVerticalScroll);
            setVerticalSliderValue((newVerticalScroll / maxVerticalScroll) * 100);
        }
    };

    const handleHorizontalSliderChange = (_event: Event, newValue: number | number[]) => {
        const value = newValue as number;
        setHorizontalSliderValue(value);
        setScrollPosition(maxScroll * (value / 100));
    };

    const handleVerticalSliderChange = (_event: Event, newValue: number | number[]) => {
        const value = newValue as number;
        setVerticalSliderValue(value);
        setVerticalScroll(maxVerticalScroll * (value / 100));
    };

    // Add state for label search
    const [labelSearchText, setLabelSearchText] = useState('');
    const [labelAnchorEl, setLabelAnchorEl] = useState<HTMLButtonElement | null>(null);
    const labelButtonRef = useRef<HTMLButtonElement | null>(null);

    const renderAssigneeAvatars = (assignees: any[]) => {
        if (!assignees?.length) return null;

        return (
            <div style={{ display: 'flex', marginLeft: 8 }}>
                {assignees.slice(0, 3).map((assignee, index) => (
                    <div
                        key={assignee.id}
                        style={{
                            marginLeft: index > 0 ? -8 : 0,
                            zIndex: assignees.length - index
                        }}
                    >
                        <UserAvatar
                            src={assignee.avatar_url}
                            name={assignee.name}
                        />
                    </div>
                ))}
                {assignees.length > 3 && (
                    <div style={{ marginLeft: -8, zIndex: 0 }}>
                        <Avatar
                            sx={{
                                width: 24,
                                height: 24,
                                fontSize: 12,
                                bgcolor: 'primary.main',
                                border: '2px solid white'
                            }}
                        >
                            +{assignees.length - 3}
                        </Avatar>
                    </div>
                )}
            </div>
        );
    };

    const renderTaskRow = (task: Task) => (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                backgroundColor: task.id === selectedTask?.id ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                }
            }}
            onClick={() => setSelectedTask(task)}
        >
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" noWrap sx={{ mr: 1 }}>
                    {task.name}
                </Typography>
                {task.assignees && renderAssigneeAvatars(task.assignees)}
            </Box>
        </Box>
    );

    // Add cursor style when hovering over task area
    const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if mouse is over task name area (second column)
        if (x >= avatarColumnWidth && x <= avatarColumnWidth + infoColumnWidth && y >= headerHeight) {
            const taskIndex = Math.floor((y - headerHeight + verticalScroll) / taskHeight);
            const task = filteredTasks[taskIndex];

            if (task) {
                // Calculate task name boundaries
                const taskY = headerHeight + taskIndex * taskHeight;
                const nameY = taskY + (taskHeight - taskNameHeight) / 2;

                // Check if mouse is over task name
                if (y >= nameY && y <= nameY + taskNameHeight) {
                    canvas.style.cursor = 'pointer';
                    return;
                }
            }
        }

        canvas.style.cursor = 'default';
    }, [filteredTasks, verticalScroll]);

    return (
        <Box sx={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            borderRadius: 3,
        }}>
            {/* Filters */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl size="small">
                    <Button
                        variant={showClosedIssues ? "contained" : "outlined"}
                        onClick={() => setShowClosedIssues(!showClosedIssues)}
                        size="small"
                        color={showClosedIssues ? "primary" : "inherit"}
                        sx={{ minWidth: 140 }}
                    >
                        {showClosedIssues ? "Hide Closed" : "Show Closed"}
                    </Button>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Include Labels</InputLabel>
                    <Select
                        multiple
                        value={selectedLabels}
                        onChange={(e) => setSelectedLabels(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        input={<OutlinedInput label="Include Labels" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                    <Chip
                                        key={value}
                                        label={value}
                                        size="small"
                                        onDelete={() => {
                                            setSelectedLabels(selectedLabels.filter(label => label !== value));
                                        }}
                                    />
                                ))}
                            </Box>
                        )}
                    >
                        {uniqueLabels.map((label) => (
                            <MenuItem key={label} value={label}>
                                {label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Exclude Labels</InputLabel>
                    <Select
                        multiple
                        value={excludedLabels}
                        onChange={(e) => setExcludedLabels(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        input={<OutlinedInput label="Exclude Labels" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                    <Chip
                                        key={value}
                                        label={value}
                                        size="small"
                                        onDelete={() => {
                                            setExcludedLabels(excludedLabels.filter(label => label !== value));
                                        }}
                                    />
                                ))}
                            </Box>
                        )}
                    >
                        {uniqueLabels.map((label) => (
                            <MenuItem key={label} value={label}>
                                {label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Status Labels</InputLabel>
                    <Select
                        multiple
                        value={statusLabels}
                        onChange={(e) => setStatusLabels(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        input={<OutlinedInput label="Status Labels" />}
                        onClick={(e) => e.stopPropagation()}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => {
                                    const labelDetails = tasks.find(task =>
                                        task.labels.find(l => l.name === value)
                                    )?.labels.find(l => l.name === value);

                                    const backgroundColor = labelDetails ? normalizeColor(labelDetails.color) : theme.palette.grey[300];
                                    const textColor = labelDetails ? normalizeColor(labelDetails.text_color) : theme.palette.getContrastText(theme.palette.grey[300]);

                                    return (
                                        <Chip
                                            key={value}
                                            label={value}
                                            size="small"
                                            sx={{
                                                bgcolor: backgroundColor,
                                                color: textColor,
                                                '& .MuiChip-deleteIcon': {
                                                    color: textColor
                                                }
                                            }}
                                            onDelete={() => {
                                                const newStatusLabels = statusLabels.filter(label => label !== value);
                                                setStatusLabels(newStatusLabels);
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        )}
                    >
                        {uniqueLabels.map((label) => {
                            const labelDetails = tasks.find(task =>
                                task.labels.find(l => l.name === label)
                            )?.labels.find(l => l.name === label);

                            const backgroundColor = labelDetails ? normalizeColor(labelDetails.color) : theme.palette.grey[300];

                            return (
                                <MenuItem key={label} value={label}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: 1,
                                                bgcolor: backgroundColor
                                            }}
                                        />
                                        {label}
                                    </Box>
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Assignees</InputLabel>
                    <Select
                        multiple
                        value={selectedAssignees}
                        onChange={(e) => setSelectedAssignees(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value)}
                        input={<OutlinedInput label="Assignees" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => {
                                    const assignee = uniqueAssignees.find(a => a.id === value);
                                    return assignee ? (
                                        <Chip
                                            key={value}
                                            label={assignee.name}
                                            size="small"
                                            avatar={<Avatar src={assignee.avatar_url} alt={assignee.name} sx={{ width: 24, height: 24 }} />}
                                            onDelete={() => {
                                                setSelectedAssignees(selectedAssignees.filter(id => id !== value));
                                            }}
                                        />
                                    ) : null;
                                })}
                            </Box>
                        )}
                    >
                        {uniqueAssignees.map((assignee) => (
                            <MenuItem key={assignee.id} value={assignee.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Avatar src={assignee.avatar_url} alt={assignee.name} sx={{ width: 24, height: 24 }} />
                                    {assignee.name}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Milestones</InputLabel>
                    <Select<number[]>
                        multiple
                        value={selectedMilestones}
                        onChange={(e: SelectChangeEvent<number[]>) => {
                            const value = e.target.value;
                            setSelectedMilestones(Array.isArray(value) ? value : []);
                        }}
                        input={<OutlinedInput label="Milestones" />}
                        renderValue={(selected: number[]) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value: number) => {
                                    const milestone = uniqueMilestones.find(m => m.id === value);
                                    return milestone ? (
                                        <Chip
                                            key={value}
                                            label={milestone.title}
                                            size="small"
                                            onDelete={() => {
                                                setSelectedMilestones(selectedMilestones.filter(id => id !== value));
                                            }}
                                        />
                                    ) : null;
                                })}
                            </Box>
                        )}
                    >
                        {uniqueMilestones.map((milestone) => (
                            <MenuItem key={milestone.id} value={milestone.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2">
                                        {milestone.title}
                                    </Typography>
                                    {milestone.due_date && (
                                        <Typography variant="caption" color="text.secondary">
                                            (Due: {new Date(milestone.due_date).toLocaleDateString()})
                                        </Typography>
                                    )}
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {(selectedLabels.length > 0 || excludedLabels.length > 0 || statusLabels.length > 0 || selectedAssignees.length > 0 || selectedMilestones.length > 0) && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                            setSelectedLabels([]);
                            setExcludedLabels([]);
                            setStatusLabels([]);
                            setSelectedAssignees([]);
                            setSelectedMilestones([]);
                        }}
                    >
                        Clear All Filters
                    </Button>
                )}
            </Box>

            {/* Chart container */}
            <Box
                ref={containerRef}
                onWheel={handleScroll}
                sx={{
                    position: 'relative',
                    flexGrow: 1,
                    overflow: 'hidden',
                }}
            >
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseMove={handleMouseMove}
                    style={{ display: 'block' }}
                />
                {selectedTask && (
                    <TaskModal
                        task={selectedTask}
                        onClose={() => {
                            // Get the updated task from local state
                            const updatedTask = tasks.find(t => t.id === selectedTask.id);
                            if (updatedTask) {
                                setSelectedTask(null);
                            }
                        }}
                        onLabelChange={handleLabelChange}
                        onAssigneeChange={handleAssigneeChange}
                        onTitleChange={handleTitleChange}
                        onDescriptionChange={handleDescriptionChange}
                        onDateChange={handleDateChange}
                        uniqueLabels={uniqueLabels}
                        allUsers={uniqueAssignees}
                    />
                )}
            </Box>

            {/* Vertical Slider */}
            <Box sx={{
                position: 'absolute',
                top: 360,
                right: 16,
                bottom: 240,
                width: 24,
                display: 'flex',
                alignItems: 'center',
            }}>
                <Slider
                    value={verticalSliderValue}
                    onChange={handleVerticalSliderChange}
                    orientation="vertical"
                    aria-label="Vertical scroll"
                    size="small"
                    sx={{
                        height: '100%',
                        '& .MuiSlider-thumb': {
                            width: 0,
                            height: 0,
                        },
                        '& .MuiSlider-track': {
                            width: 10,
                            backgroundColor: theme.palette.primary.main,
                            border: 'none',
                        },
                        '& .MuiSlider-rail': {
                            width: 10,
                            backgroundColor: theme.palette.grey[300],
                            opacity: 1,
                        },
                    }}
                />
            </Box>

            {/* Horizontal Slider */}
            <Box sx={{
                position: 'absolute',
                bottom: 16,
                left: 440,
                right: 120,
                px: 1,
            }}>
                <Slider
                    value={horizontalSliderValue}
                    onChange={handleHorizontalSliderChange}
                    aria-label="Horizontal scroll"
                    size="small"
                    sx={{
                        '& .MuiSlider-thumb': {
                            width: 0,
                            height: 0,
                        },
                        '& .MuiSlider-track': {
                            height: 10,
                            backgroundColor: theme.palette.primary.main,
                            border: 'none',
                        },
                        '& .MuiSlider-rail': {
                            height: 10,
                            backgroundColor: theme.palette.grey[300],
                            opacity: 1,
                        },
                    }}
                />
            </Box>
        </Box>
    );
};

export default GanttChart; 