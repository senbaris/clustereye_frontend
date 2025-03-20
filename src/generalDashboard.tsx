import { useEffect, useState } from "react";
import axios from "axios";
import HexagonGrid from "./hexagongrid";
import { DashboardData } from "./type";
import { flattenMongoData, flattenPostgresData } from "./data-utils";
import './index.css';
import { useDispatch } from 'react-redux';
import { setHeadStats } from '../redux/redux';
import { STATUS_COLORS, getStatusColor } from "./hexagon";

const GeneralDashboard = () => {
    // Tip tanımlı useState
    const [data, setData] = useState<DashboardData>({ mongodb: [], postgresql: [] });
    const [loading, setLoading] = useState<boolean>(true);
    const dispatch = useDispatch();

    const fetchData = () => {
        axios
            .get(`${import.meta.env.VITE_REACT_APP_API_URL}/generalhealth`)
            .then((response) => {
                const rawData = response.data;

                // MongoDB ve PostgreSQL verilerini düzleştir
                const flattenedMongo = flattenMongoData(rawData.mongodb);
                const flattenedPostgres = flattenPostgresData(rawData.postgresql);

                setData({
                    mongodb: flattenedMongo,
                    postgresql: flattenedPostgres,
                });
                setLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching health data:", error);
                setLoading(false);
            });
    };

    // Toplam MongoDB ve PostgreSQL Node Sayıları
    const totalMongoNodes = data.mongodb.length;
    const totalPostgresNodes = data.postgresql.length;
    const criticalNodes = [
        ...data.mongodb.filter((node) => getStatusColor(node) === STATUS_COLORS.RED),
        ...data.postgresql.filter((node) => getStatusColor(node) === STATUS_COLORS.RED),
    ];

    const warningNodes = [
        ...data.mongodb.filter((node) => getStatusColor(node) === STATUS_COLORS.YELLOW),
        ...data.postgresql.filter((node) => getStatusColor(node) === STATUS_COLORS.YELLOW),
    ];

    useEffect(() => {
        dispatch(setHeadStats({
            panelName: 'clusterheatmap',
            totalMongoNodes: totalMongoNodes,
            totalPostgresNodes: totalPostgresNodes,
            criticalNodes: criticalNodes.length,
            warningNodes: warningNodes.length
        }));// eslint-disable-next-line
    }, [totalMongoNodes, totalPostgresNodes, criticalNodes.length, warningNodes.length])

    useEffect(() => {
        fetchData();

        const intervalId = setInterval(() => {
            fetchData();
        }, 5000);

        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return <p>Loading...</p>;
    }

    return (
        <div style={{ padding: "20px" }}>
            <HexagonGrid nodes={data.mongodb} size="small" />
            <HexagonGrid nodes={data.postgresql} size="small" />

        </div>
    );
};


export default GeneralDashboard;
