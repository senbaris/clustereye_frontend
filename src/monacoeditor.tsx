import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
    value: string;
    readOnly?: boolean; // Readonly özelliği eklendi
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, readOnly = false }) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const monacoInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
        if (editorRef.current) {
            monacoInstanceRef.current = monaco.editor.create(editorRef.current, {
                value,
                language: 'pgsql', // PostgreSQL dil desteği
                theme: 'vs-light',
                readOnly, // Salt okunur yapı
                automaticLayout: true,
                minimap: { enabled: false },
            });
        }

        return () => {
            monacoInstanceRef.current?.dispose();
        };
    }, []);

    // Dışarıdan gelen value güncellemelerini yönet
    useEffect(() => {
        if (monacoInstanceRef.current) {
            const currentValue = monacoInstanceRef.current.getValue();
            if (value !== currentValue) {
                monacoInstanceRef.current.setValue(value);
            }
        }
    }, [value]);

    return <div ref={editorRef} style={{ height: '300px', width: '100%' }} />;
};

export default MonacoEditor;
