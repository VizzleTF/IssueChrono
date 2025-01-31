export const getApiUrl = () => {
    return (window as any).RUNTIME_CONFIG.VITE_API_URL || import.meta.env.VITE_API_URL;
}; 