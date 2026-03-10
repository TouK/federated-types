import React from 'react';

export interface AppProps {
    title: string;
    onClose?: () => void;
}

export const App: React.FC<AppProps> = ({ title, onClose }) => {
    return (
        <div>
            <h1>{title}</h1>
            {onClose && <button onClick={onClose}>Close</button>}
        </div>
    );
};

export default App;
