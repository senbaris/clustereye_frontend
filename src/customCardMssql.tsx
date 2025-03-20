import React, { ReactNode } from 'react';
import { Card} from 'antd';
import IconMssql from './icons/sql_server';

type CustomCardProps = {
    clusterName: string;
    iconColor: string; // panelColorClass.iconColor direkt olarak geçirilebilir
    onClick: () => void;
    children?: ReactNode;
};

const CustomCard: React.FC<CustomCardProps> = ({ clusterName, iconColor, onClick }) => {

    return (
        <Card
            bodyStyle={{ padding: 5, width: 195 }}
            onClick={onClick}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <IconMssql size="20" color={iconColor} />
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
