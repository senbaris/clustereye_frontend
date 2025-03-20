import React, { useState, ReactNode } from 'react';
import { Card, Tooltip, Modal } from 'antd';
import { DeleteOutlined, BarChartOutlined } from '@ant-design/icons';
import IconPostgres from './icons/postgresql';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { RootState } from './store';

type CustomCardProps = {
    clusterName: string;
    iconColor: string; // panelColorClass.iconColor direkt olarak geçirilebilir
    onClick: () => void;
    children?: ReactNode;
};

const CustomCard: React.FC<CustomCardProps> = ({ clusterName, iconColor, onClick }) => {
    const [showActions, setShowActions] = useState(false);
    
    // Keycloak yerine Redux auth state'ini kullan
    const { isLoggedIn } = useSelector((state: RootState) => state.auth);

    const handleDeleteClick = async () => {
        try {
            const response = await axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/delete_postgresql_cls`, {
                clusterName: clusterName,
            });
            console.log('API Response:', response.data);
        } catch (error) {
            console.error('API Error:', error);
        }
    };

    const showDeleteConfirm = () => {
        Modal.confirm({
            title: (
                <span>
                    Are you sure you want to delete <span style={{ color: 'red', fontWeight: 'bold' }}>{clusterName}</span>?
                </span>
            ), content: 'If Dbstatus agents are still running, this cluster will be added to this dashboard again.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk() {
                handleDeleteClick();
            },
            onCancel() {
                console.log('Delete cancelled');
            },
        });
    };

    return (
        <Card
            bodyStyle={{ padding: 5, width: 195 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            onClick={onClick}
            actions={showActions ? [
                isLoggedIn && (
                    <Tooltip title="Remove cluster from dbstatus">
                        <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); showDeleteConfirm(); }} />
                    </Tooltip>
                ),
                <Tooltip title="Performance Analyze">
                    <Link to={`/postgrepa?clusterName=${clusterName}`}>
                        <BarChartOutlined key="edit" />
                    </Link>
                </Tooltip>,
            ] : []}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <IconPostgres size="20" color={iconColor} />
                <span
                    style={{
                        marginLeft: 8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        fontSize: '12px',
                        textOverflow: 'ellipsis',
                        maxWidth: 'calc(100% - 25px - 8px)'
                    }}
                >
                    {clusterName}
                </span>
            </div>
        </Card>
    );
};

export default CustomCard;
