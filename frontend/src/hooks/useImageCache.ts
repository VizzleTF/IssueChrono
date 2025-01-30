import { useState, useEffect } from 'react';

const imageCache = new Map<string, HTMLImageElement>();

const useImageCache = (url: string): HTMLImageElement | null => {
    const [image, setImage] = useState<HTMLImageElement | null>(
        imageCache.get(url) || null
    );

    useEffect(() => {
        if (!url) return;

        // Return cached image if available
        if (imageCache.has(url)) {
            setImage(imageCache.get(url) || null);
            return;
        }

        // Load and cache new image
        const img = new Image();
        img.src = url;
        img.onload = () => {
            imageCache.set(url, img);
            setImage(img);
        };
        img.onerror = () => {
            setImage(null);
        };

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [url]);

    return image;
};

export default useImageCache; 