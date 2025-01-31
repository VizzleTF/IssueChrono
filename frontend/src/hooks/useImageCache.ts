import { useState, useEffect } from 'react';

const imageCache = new Map<string, HTMLImageElement>();

export const clearImageCache = () => {
    imageCache.clear();
};

const useImageCache = (url: string): HTMLImageElement | null => {
    const [image, setImage] = useState<HTMLImageElement | null>(
        imageCache.get(url) || null
    );

    useEffect(() => {
        if (!url) return;

        // Return cached image if available and valid
        if (imageCache.has(url)) {
            const cachedImage = imageCache.get(url);
            if (cachedImage && cachedImage.complete && cachedImage.naturalWidth > 0) {
                setImage(cachedImage);
                return;
            } else {
                // Remove invalid cached image
                imageCache.delete(url);
            }
        }

        // Load and cache new image
        const img = new Image();
        img.src = url;
        img.onload = () => {
            imageCache.set(url, img);
            setImage(img);
        };
        img.onerror = () => {
            imageCache.delete(url);
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