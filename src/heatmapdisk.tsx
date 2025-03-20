import React, { useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import axios from 'axios';

interface DiskData {
    replsetname: string;
    total_disk_size_for_replset: number;
}

type TooltipParams = {
    data: {
        name: string;
        value: number;
    };
};

const HeatmapDisk: React.FC = () => {
    const chartRef = useRef(null);
    const [data, setData] = useState<DiskData[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/heatmapdata`);
                
                // Veri kontrolü ekleyelim
                const responseData = response.data.data;
                if (Array.isArray(responseData)) {
                    setData(responseData);
                } else {
                    console.warn('API response is not an array:', responseData);
                    setData([]);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setData([]);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (data.length === 0) return; // Veri henüz yüklenmediyse grafiği oluşturma

        if (!chartRef.current) return; // chartRef.current null ise return yap

        let chartInstance = echarts.getInstanceByDom(chartRef.current);

        if (!chartInstance) {
            chartInstance = echarts.init(chartRef.current);
        }
        const formattedData = {
            name: "Disk Usage",
            children: data.map(item => ({
                name: item.replsetname,
                value: item.total_disk_size_for_replset
            }))
        };

        const option = {
            title: {
                text: '',
            },
            tooltip: {
                trigger: 'item',
                formatter: function(params: TooltipParams) {
                    const { name, value } = params.data;
            
                    if (value >= 1024) {
                        // Değer 1024 GB (yani 1 TB) veya daha büyükse TB cinsinden göster
                        return `${name}: ${(value / 1024).toFixed(2)} TB`;
                    } else {
                        // Değer 1024 GB'tan küçükse GB cinsinden göster
                        return `${name}: ${value.toFixed(2)} GiB`;
                    }
                }
            },
            visualMap: {
                type: 'piecewise',
                pieces: [
                    {min: 1000, color: '#c31717ff'},
                    {min: 749, max: 999, color: '#fc621fff'},
                    {min: 500, max: 749, color: '#405fbf'},
                    {min: 999, max: 999.99, color: '#c31717ff'},
                    {max: 499, color: '#5b9f39ff'}
                ],
                show: false // Bu, visualMap bileşeninin kullanıcıya gösterilip gösterilmemesini kontrol eder. Burada gizli tutmayı tercih ediyoruz.
            },
            series: [{
                type: 'treemap',
                data: [formattedData]
            }]
        };
        
        chartInstance.setOption(option);
    }, [data]);

    return (
        <div ref={chartRef} style={{ width: '100%', height: '800px' }}></div>
    );
}

export default HeatmapDisk;
