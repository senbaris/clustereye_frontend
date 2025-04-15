import React, { useState, useEffect } from 'react';
import './index.css';
import { Space,Modal, Spin, Button, Badge, Tooltip,message } from 'antd';
import IconMongo from './icons/mongo'
import CustomCardMongo from './customCardMongo';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircleOutlined, CloseCircleOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Moment } from 'moment';
import 'moment/locale/tr';
import { RootState } from './store';
import AddClusterModal from './components/AddClusterModal';
import MongoTopology from './components/MongoTopology';


interface MyData {
	[key: string]: replicaNode[];
}

interface ConnInfo {
	nodename: string;
	send_diskalert: boolean;
	silence_until: {
		Time: string;
		Valid: boolean;
	} | null;
	sync_status: {
		Int32: number;  // sync_status artık bir integer
		Valid: boolean; // Eğer geçerli bir değer varsa true, yoksa false
	};
	sync_collection: {
		String: string;
		Valid: boolean;
	} | null;

}

interface replicaNode {
	dc: string;
	totalDisksize: string;
	freediskdata: string;
	freediskpercent: string;
	ip: string;
	nodename: string;
	replsetname?: string;
	status: string;
	version: string;
	// Yeni API alanları
	ClusterName?: string;
	FDPercent?: number;
	FreeDisk?: string;
	Hostname?: string;
	IP?: string;
	Location?: string;
	MongoStatus?: string;
	MongoVersion?: string;
	NodeStatus?: string;
	ReplicaSetName?: string;
	ReplicationLagSec?: number;
	TotalDisk?: string;
}

// Add a type definition for the Agent object
interface Agent {
	connection: string;
	hostname: string;
	id: string;
	ip: string;
	last_seen: string;
	status: string;
}

const getReplicaDetail = (replicaNodes: replicaNode[]) => {
	console.log('getReplicaDetail input:', replicaNodes);
	
	let color = "success";
	const nodesWithElements = replicaNodes.map((node: replicaNode, index: number) => {
		// Eski veya yeni API formatından status bilgisini al
		const nodeStatus = node.status || node.NodeStatus || '';
		
		if (!["PRIMARY", "SECONDARY"].includes(nodeStatus)) {
			color = "danger";
		}
		const nodeElement = (
			<p key={index} style={{ color: color }}>
				{node.nodename || node.Hostname} - {nodeStatus}
			</p>
		);
		
		// Ham node objesi içeriğini consola yazdır
		console.log(`Raw node ${index} content:`, node);
		console.log(`Node ${index} MongoStatus:`, node.MongoStatus);
		
		// Eski veya yeni API formatından veri öğelerini al
		const result = {
			nodename: node.nodename || node.Hostname || '',
			status: nodeStatus,
			version: node.version || node.MongoVersion || '',
			dc: node.dc || node.Location || '',
			ip: node.ip || node.IP || '',
			totalDisksize: node.totalDisksize || node.TotalDisk || 'N/A',
			freediskdata: node.freediskdata || node.FreeDisk || 'N/A',
			freediskpercent: node.freediskpercent || (node.FDPercent?.toString() || '0'),
			nodeElement: nodeElement,
			color: color,
			// Yeni API alanlarını da ekle
			MongoStatus: node.MongoStatus || 'UNKNOWN',
			ReplicationLagSec: node.ReplicationLagSec
		};
		
		console.log(`Processed node ${index} result:`, result);
		return result;
	});

	return nodesWithElements;
}

const getFullNodeName = (nodeName: string): string => {
	if (!nodeName) return '';
	
	if (nodeName.includes(".osp-") && !nodeName.includes(".hepsi.io")) {
		return `${nodeName}.hepsi.io`;
	} else if ((nodeName.includes("dpay") || nodeName.includes("altpay")) && !nodeName.includes(".dpay.int")) {
		return `${nodeName}.dpay.int`;
	}
	return `${nodeName}.hepsiburada.dmz`;
};

const Mongo: React.FC = () => {
	const dispatch = useDispatch();
	const [selectedCard, setSelectedCard] = useState<string | null>(null);
	const [activeCluster, setActiveCluster] = useState<any[]>([]);
	const [data, setData] = useState<MyData[]>([]);
	const [loading, setLoading] = useState(true);
	const { isLoggedIn } = useSelector((state: RootState) => state.auth);
	const [loading2, setLoading2] = useState(false);
	const POLLING_INTERVAL = 5000;
	const [isSecondModalVisible, setIsSecondModalVisible] = useState(false);
	const [operationResult, setOperationResult] = useState<{ success?: boolean, message?: string }>({});
	const [connInfos, setConnInfos] = useState<{ [key: string]: ConnInfo }>({});
	const [selectedTime, setSelectedTime] = useState<Moment | null>(null);
	const [modalVisible, setModalVisible] = useState(false);
	const [agentStatuses, setAgentStatuses] = useState<{[key: string]: boolean}>({});

	// Karta tıklama işlevi - topoloji görünümünü yönetmek için geliştirildi
	const handle = (replSetName: string) => {
		// Seçili kartı değiştir
		if (selectedCard === replSetName) {
			setSelectedCard(null); // Aynı karta tıklanırsa görünümü kapat
			setActiveCluster([]); // Aktif küme verilerini temizle
		} else {
			setSelectedCard(replSetName); // Farklı bir karta tıklanırsa o kartı seç
			
			// Seçilen kümenin verilerini bul ve aktif küme olarak ayarla
			const selectedClusterData = data.find(da => Object.keys(da)[0] === replSetName);
			if (selectedClusterData) {
				const replicaNodes = selectedClusterData[replSetName];
				const detailedNodes = getReplicaDetail(replicaNodes);
				setActiveCluster(detailedNodes);
			}
		}
	};

	// useEffect ile data değiştiğinde active cluster verilerini güncelle
	useEffect(() => {
		if (selectedCard && data.length > 0) {
			const selectedClusterData = data.find(da => Object.keys(da)[0] === selectedCard);
			if (selectedClusterData) {
				const replicaNodes = selectedClusterData[selectedCard];
				const detailedNodes = getReplicaDetail(replicaNodes);
				setActiveCluster(detailedNodes);
			}
		}
	}, [data, selectedCard]);

	useEffect(() => {
		fetchMongoData();
		fetchAgentStatuses();

		const intervalId = setInterval(() => {
			fetchMongoData();
			fetchAgentStatuses();
		}, POLLING_INTERVAL);

		return () => clearInterval(intervalId); // cleanup
	}, []);

	const fetchMongoData = async () => {
		try {
			
			
			// localStorage'dan token al
			const token = localStorage.getItem('token');
			
			if (!token) {
				console.warn('No authentication token found, proceeding without authentication');
			}
			
			// API call to fetch MongoDB status
			const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/mongo`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-Requested-With': 'XMLHttpRequest',
					'Accept': 'application/json',
					...(token ? { 'Authorization': `Bearer ${token}` } : {})
				},
				credentials: 'include'
			});
			
				if (!response.ok) {
				throw new Error(`Error fetching MongoDB status: ${response.status} - ${response.statusText}`);
			}
			
			const responseData = await response.json();
			console.log('MongoDB API response (RAW):', JSON.stringify(responseData, null, 2));
			
			if (responseData.status === "success" && Array.isArray(responseData.data)) {
				// Yeni API yanıt formatı detaylı inceleme
				console.log('MongoDB API response has new format with status and data fields');
				console.log('Data array length:', responseData.data.length);
				if (responseData.data.length > 0) {
					const firstCluster = responseData.data[0];
					const clusterName = Object.keys(firstCluster)[0];
					console.log('First cluster name:', clusterName);
					console.log('First cluster sample node:', firstCluster[clusterName][0]);
				}
				
				// Yeni API yanıt formatını işle
				const transformedData = responseData.data.map((clusterObj: any) => {
					// Her bir küme objesi için dönüştürme
					const clusterName = Object.keys(clusterObj)[0];
					const nodes = clusterObj[clusterName];
					
					console.log(`Cluster ${clusterName} raw node data:`, nodes);
					
					// Her küme için yeni bir obje döndür
					return {
						[clusterName]: nodes.map((node: any) => {
							console.log(`Node ${node.Hostname} raw data:`, node);
							console.log(`Node ${node.Hostname} MongoStatus:`, node.MongoStatus);
							
							const transformedNode = {
								// Eski veri formatına dönüştür
								dc: node.Location || 'Unknown',
								totalDisksize: node.TotalDisk || 'N/A',
								freediskdata: node.FreeDisk || 'N/A',
								freediskpercent: node.FDPercent?.toString() || '0',
								ip: node.IP || 'N/A',
								nodename: node.Hostname || 'unknown',
								replsetname: node.ReplicaSetName || clusterName,
								status: node.NodeStatus || 'UNKNOWN',
								version: node.MongoVersion || 'N/A',
								// MongoStatus'ü de ekleyelim
								MongoStatus: node.MongoStatus || 'UNKNOWN',
								// Diğer yeni API alanlarını da ekleyelim
								Hostname: node.Hostname,
								NodeStatus: node.NodeStatus,
								Location: node.Location,
								IP: node.IP,
								MongoVersion: node.MongoVersion,
								ReplicaSetName: node.ReplicaSetName,
								ReplicationLagSec: node.ReplicationLagSec,
								FDPercent: node.FDPercent,
								FreeDisk: node.FreeDisk,
								TotalDisk: node.TotalDisk
							};
							console.log(`Node ${node.Hostname} transformed:`, transformedNode);
							return transformedNode;
						})
					};
				});
				
				console.log('Transformed MongoDB data:', transformedData);
				setData(transformedData);
			} else if (Array.isArray(responseData)) {
				// Eski format hala destekli
				setData(responseData);
			} else {
				setData([]);
				console.warn('API response does not contain expected data structure:', responseData);
			}
		} catch (error) {
			console.error('Error fetching MongoDB data:', error);
			message.error(`Failed to fetch MongoDB clusters: ${error instanceof Error ? error.message : 'Unknown error'}`);
			setData([]);
		} finally {
			setLoading(false);
		}
	};

	const fetchAgentStatuses = async () => {
		try {
			// localStorage'dan token al
			const token = localStorage.getItem('token');
			
			if (!token) {
				console.warn('No authentication token found, proceeding without authentication');
			}
			
			// API call to fetch agent statuses
			const agentResponse = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/status/agents`, {
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					...(token ? { 'Authorization': `Bearer ${token}` } : {})
				}
			});
			
			// Check for the expected data structure
			if (agentResponse.data?.status === "success" && Array.isArray(agentResponse.data?.data?.agents)) {
				const agentList = agentResponse.data.data.agents;
				const newAgentStatuses: {[key: string]: boolean} = {};
				
				// Process agent statuses from the array structure
				agentList.forEach((agent: Agent) => {
					if (agent.hostname && agent.status) {
						// An agent is active if its status is "connected"
						const isActive = agent.status === "connected";
						
						// Add with domain extensions for different environments
						newAgentStatuses[agent.hostname] = isActive;
						newAgentStatuses[`${agent.hostname}.hepsiburada.dmz`] = isActive;
						newAgentStatuses[`${agent.hostname}.hepsi.io`] = isActive;
						newAgentStatuses[`${agent.hostname}.dpay.int`] = isActive;
					}
				});
				
				console.log('Agent statuses updated:', newAgentStatuses);
				setAgentStatuses(newAgentStatuses);
		} else {
				console.warn('Unexpected agent status response format:', agentResponse.data);
			}
		} catch (error) {
			console.error('Error fetching agent statuses:', error);
		}
	};

	const handleSilentAlarm = async (nodeName: string): Promise<void> => {
		const fullNodeName = getFullNodeName(nodeName);
		const silentAlarmAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/silentalarm`;

		try {
			const response = await fetch(silentAlarmAPI, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					hostname: fullNodeName,
					silent: !connInfos[fullNodeName]?.send_diskalert,
					silence_until: selectedTime ? selectedTime.toISOString() : null,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				console.log('Başarılı:', data);

				setOperationResult({ success: true, message: 'Operation was successful!' });

				setConnInfos((prev) => ({
					...prev,
					[fullNodeName]: {
						...prev[fullNodeName],
						send_diskalarm: !prev[fullNodeName].send_diskalert,
						silence_until: selectedTime ? { Time: selectedTime.toISOString(), Valid: true } : null,
					},
				}));
			} else {
				console.error('Hata:', response.statusText);
				setOperationResult({ success: false, message: 'Operation failed!' });
			}
		} catch (error) {
			console.error('Bir hata oluştu:', error);
			setOperationResult({ success: false, message: 'An error occurred!' });
		}
	};

	async function handleIconStepdownClick(nodeName: string): Promise<void> {
		const fullNodeName = `${nodeName}.hepsiburada.dmz`;
		const dbstatusAPI = `${import.meta.env.VITE_REACT_APP_API_URL}/stepdown`;

		try {
			const response = await fetch(dbstatusAPI, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					hostname: fullNodeName
				})
			});

			if (response.ok) {
				const data = await response.json();
				console.log("Başarılı:", data);
				setOperationResult({ success: true, message: 'Operation was successful!' });
			} else {
				console.error("Hata:", response.statusText);
				setOperationResult({ success: false, message: 'Operation failed!' });
			}
		} catch (error) {
			console.error("Bir hata oluştu:", error);
			setOperationResult({ success: false, message: 'An error occurred!' });
		}
	}

	const handleSecondModalClose = () => {
		setIsSecondModalVisible(false);
	}

	const getPanelStyleClasses = (repDetails: any[]) => {
		const nonSecondaryCount = repDetails.filter(
			(detail) =>
				detail.status !== 'PRIMARY' &&
				detail.status !== 'SECONDARY' &&
				detail.status !== 'ARBITER'
		).length;
	
		const lowFreeDiskPercent = repDetails.some(
			(detail) => parseFloat(detail.freediskpercent) < 25
		);
	
		// freediskdata değerinden " GB" kısmını kaldırıp sayıya çevir
		const lowFreeDiskData = repDetails.some((detail) => {
			const dataValue = parseFloat(detail.freediskdata.split(' ')[0]);
			return dataValue < 250; // 250GB'tan düşük kontrolü
		});
	
		if (nonSecondaryCount === 1) {
			return {
				containerClass: 'card-container redalert',
				iconColor: '#fc621fff',
				tooltip: 'Warning: Non-secondary node detected!', // Tooltip mesajı
			};
		} else {
			const hasNonPrimaryOrSecondary = repDetails.some(
				(detail) => !['PRIMARY', 'SECONDARY'].includes(detail.status)
			);
	
			if (hasNonPrimaryOrSecondary) {
				return {
					containerClass: 'card-container redalert',
					iconColor: 'red',
					tooltip: 'Warning: Node status not PRIMARY or SECONDARY!', // Tooltip mesajı
				};
			} else if (lowFreeDiskPercent && lowFreeDiskData) {
				return {
					containerClass: 'card-container diskwarn',
					iconColor: '#ffa101ff',
					tooltip: 'Warning: Low disk space detected!', // Tooltip mesajı
				};
			} else {
				return {
					containerClass: 'card-container bn5',
					iconColor: 'green',
					tooltip: null, // Tooltip yok
				};
			}
		}
	};
	

	return (
		<>
			<Space direction="vertical" size="middle" style={{ display: 'flex', width: '100%' }}>
				{/* Refresh butonunu içeren div'i kaldırıyoruz */}
				{/* <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
					<Button 
						onClick={handleRefreshData} 
						icon={<SyncOutlined spin={isRefreshing} />}
						loading={isRefreshing}
						type="primary"
					>
						Refresh
					</Button>
				</div> */}
				
				{loading ? (
					<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
						<Spin size="large" tip="Loading MongoDB cluster data..." />
					</div>
				) : (
					<>
						{data.length === 0 ? (
							<div style={{ 
								display: 'flex', 
								flexDirection: 'column',
								justifyContent: 'center', 
								alignItems: 'center', 
								height: '300px',
								background: '#f0f2f5',
								borderRadius: '8px',
								padding: '20px',
								textAlign: 'center'
							}}>
								<IconMongo size="60" color="#47A248" />
								<h2 style={{ marginTop: '20px' }}>No MongoDB Clusters Found</h2>
								<p>No MongoDB clusters are available. This could be because no clusters have been added yet or there was an error fetching data.</p>
								{isLoggedIn && (
									<Button 
										type="primary" 
										icon={<PlusOutlined />} 
										style={{ marginTop: '15px' }}
										onClick={() => setModalVisible(true)}
									>
										Add Cluster
									</Button>
								)}
							</div>
						) : (
							<>
							<div className="stats-container">
								<div key={"sad"} className="panels-wrapper">
										{data
											.sort((a: MyData, b: MyData) => {
											const aKey = Object.keys(a)[0];
											const bKey = Object.keys(b)[0];
											return aKey.localeCompare(bKey);
										})
											.map((da: MyData) => {
											return Object.keys(da).map((replicasetname, index) => {
												const replicaNodes = da[replicasetname];
												const detailedNodes = getReplicaDetail(replicaNodes);

													// Check agent status for each node in the replica set
													const isNodeUpdated = detailedNodes.some((nodeDetail) => {
														// Extract base hostname without domain
														const baseNodeName = nodeDetail.nodename;
														
														// Check if the base hostname or any of its domain variations exist in agentStatuses
														return agentStatuses[baseNodeName] || 
															agentStatuses[`${baseNodeName}.hepsiburada.dmz`] || 
															agentStatuses[`${baseNodeName}.hepsi.io`] || 
															agentStatuses[`${baseNodeName}.dpay.int`];
												});

												const styleClasses = getPanelStyleClasses(detailedNodes);

												return (
													<Tooltip
														title={styleClasses.tooltip} // Tooltip mesajını burada kullanıyoruz
														placement="top"
														color="red"
														key={`tooltip_${replicasetname}_${index}`}
													>
														<div
															key={`div1_${replicasetname}_${index}`}
															className={`${styleClasses.containerClass} ${
																selectedCard === replicasetname ? 'card-container bn6' : ''
															}`}
															style={{ margin: 4, cursor: 'pointer' }}
														>
															<Badge
																key={`badge${index}`}
																status={isNodeUpdated ? 'processing' : 'error'}
																color={isNodeUpdated ? 'green' : 'red'}
																dot
																offset={[-2, 2]}
															>
																<CustomCardMongo
																	iconColor={styleClasses.iconColor}
																	clusterName={replicasetname}
																	nodes={detailedNodes}
																	key={`card1${index}`}
																	onClick={() => handle(replicasetname)}
																>
																	<div
																		key={`div2${index}`}
																		style={{ display: 'flex', alignItems: 'center' }}
																	>
																		<IconMongo
																			key={`icon1${index}`}
																			size="25"
																			color={styleClasses.iconColor}
																		/>
																		<span
																			key={`span1${index}`}
																			style={{
																				marginLeft: 8,
																				whiteSpace: 'nowrap',
																				overflow: 'hidden',
																				fontSize: '12px',
																				textOverflow: 'ellipsis',
																				maxWidth: 'calc(100% - 25px - 8px)',
																			}}
																		>
																			{replicasetname}
																		</span>
																	</div>
																</CustomCardMongo>
															</Badge>
														</div>
													</Tooltip>
												);
											});
										})}
								</div>
							</div>
				
								{/* Seçili kartın topoloji görünümü */}
								{selectedCard && activeCluster.length > 0 && (
									<div style={{ marginTop: 16 }}>
										<MongoTopology
											nodes={activeCluster}
											key={`topology-${selectedCard}-${JSON.stringify(activeCluster)}`}
										/>
									</div>
								)}
							</>
						)}
					</>
				)}
			</Space>

			{/* Stepdown Process Modal */}
			<Modal
				title="stepDown Process"
				open={isSecondModalVisible}
				footer={null}
				closable={false}
			>
				{loading2 ? (
					<Spin tip="Loading..." />
				) : (
					<div style={{ display: 'flex', alignItems: 'center' }}>
						{operationResult.success ? (
							<>
								<CheckCircleOutlined style={{ color: 'green', fontSize: '24px', marginRight: '10px' }} />
								<p style={{ margin: 0 }}>{operationResult.message}</p>
							</>
						) : (
							<>
								<CloseCircleOutlined style={{ color: 'red', fontSize: '24px', marginRight: '10px' }} />
								<p style={{ margin: 0 }}>{operationResult.message}</p>
							</>
						)}
					</div>
				)}
				{!loading2 && <Button type="primary" onClick={handleSecondModalClose} style={{ marginTop: '10px' }}>Close</Button>}
			</Modal>
			<AddClusterModal 
				visible={modalVisible} 
				onClose={() => setModalVisible(false)} 
				initialTab="mongodb"
			/>
		</>
	);
};

export default Mongo;