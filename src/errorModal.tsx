import React, { useState, useEffect } from 'react';
import { Modal, Badge, Tooltip } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import axios from 'axios';

type ErrorData = {
    nodename: string;
    errortext: string;
    datetime: string;
};

const ErrorModal: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [errorData, setErrorData] = useState<ErrorData[]>([]);
    const [hasRecentError, setHasRecentError] = useState(false);

    const fetchErrorLogs = async () => {
        try {
            const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/error_logs`, {withCredentials: true});
            setErrorData(response.data);

            // Son 1 saat içerisinde hata olup olmadığını kontrol et
            const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
            if (response.data.some((error: ErrorData) => new Date(error.datetime) > oneHourAgo)) {
                setHasRecentError(true);
            } else {
                setHasRecentError(false);
            }

        } catch (error) {
            setHasRecentError(false);
        }
    };

    const fetchAndOpenLogs = async () => {
        await fetchErrorLogs();
        setVisible(true);
    };

    const handleClose = () => {
        setVisible(false);
    };

    useEffect(() => {
        fetchErrorLogs();

        const interval = setInterval(() => {
            fetchErrorLogs();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div onClick={fetchAndOpenLogs} style={{ display: 'inline-block', cursor: 'pointer' }}>
                <Badge dot={hasRecentError}>
                <Tooltip title="Agent Error Logs"> <NotificationOutlined style={{ fontSize: 16, marginLeft: '10px', color: 'white'}} /></Tooltip>
                </Badge>
            </div>
            <Modal title="Error Logs" open={visible} onCancel={handleClose} footer={null} width={600}>
    {Array.isArray(errorData) ? (
        errorData.slice(0, 5).map((error, index) => (
            <div key={index} style={{ marginBottom: 20 }}>
                <p><strong>Datetime:</strong> {error.datetime}</p>
                <p><strong>Error Text:</strong> {error.errortext}</p>
                <p><strong>Node Name:</strong> {error.nodename}</p>
                <hr />
            </div>
        ))
    ) : (
        <p>No error logs available.</p> // Veya kullanıcıya göstermek istediğiniz başka bir mesaj
    )}
</Modal>

        </>
    );
};

export default ErrorModal;
