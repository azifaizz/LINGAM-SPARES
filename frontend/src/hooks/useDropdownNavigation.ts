import { useState, useCallback, useEffect } from 'react';

interface UseDropdownNavigationProps<T> {
    items: T[];
    onSelect: (item: T) => void;
    isOpen: boolean;
    getItemLabel?: (item: T) => string;
}

export function useDropdownNavigation<T>({
    items,
    onSelect,
    isOpen,
    getItemLabel = (item: any) => item.name || "",
}: UseDropdownNavigationProps<T>) {
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setHighlightedIndex(0);
        }
    }, [isOpen]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen || items.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % items.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length);
                break;
            case 'Enter':
                e.preventDefault();
                onSelect(items[highlightedIndex]);
                break;
            default:
                // Jump to first matching character
                if (e.key.length === 1) {
                    const char = e.key.toLowerCase();
                    const matchIndex = items.findIndex((item) =>
                        getItemLabel(item).toLowerCase().startsWith(char)
                    );
                    if (matchIndex !== -1) {
                        setHighlightedIndex(matchIndex);
                        // Auto-scroll logic happens via ID in UI or ref
                    }
                }
                break;
        }
    }, [isOpen, items, highlightedIndex, onSelect, getItemLabel]);

    return {
        highlightedIndex,
        setHighlightedIndex,
        handleKeyDown,
    };
}
