import React, { useState, useEffect, useContext } from 'react';
import './index.css';
import { Space, Table, Tag, Popover, Modal, Spin, Button, Badge, Tooltip, DatePicker } from 'antd';
import IconMongo from './icons/mongo'
import CustomCardMongo from './customCardMongo';
import IconStepdown from './icons/stepdown'
import { useDispatch, useSelector } from 'react-redux';
import { setHeadStats } from '../redux/redux';
import SearchContext from './searchContext';
import { useRef } from 'react';
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, BellTwoTone, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment, { Moment } from 'moment';
import 'moment/locale/tr';
import runningGif from './assets/Running.gif';
import { RootState } from './store';
import AddClusterModal from './components/AddClusterModal';


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
}

interface NodeStatus {
	nodename: string;
	isUpdated: boolean;
}



const getReplicaDetail = (replicaNodes: replicaNode[]) => {
	let color = "success";
	const nodesWithElements = replicaNodes.map((node: replicaNode, index: number) => {
		if (!["PRIMARY", "SECONDARY"].includes(node.status)) {
			color = "danger";
		}
		const nodeElement = (
			<p key={index} style={{ color: color }}>
				{node.nodename} - {node.status}
			</p>
		);
		return {
			nodename: node.nodename,
			status: node.status,
			version: node.version,
			dc: node.dc,
			ip: node.ip,
			totalDisksize: node.totalDisksize,
			freediskdata: node.freediskdata,
			freediskpercent: node.freediskpercent,
			nodeElement: nodeElement,
			color: color,
		};
	});

	return nodesWithElements;
}

const Mongo: React.FC = () => {
	const dispatch = useDispatch();
	const [activeReplSet, setActiveReplSet] = useState<replicaNode[]>([]);
	const [data, setData] = useState<MyData[]>([]);
	const [loading, setLoading] = useState(true);
	const { isLoggedIn } = useSelector((state: RootState) => state.auth);
	const [loading2, setLoading2] = useState(false);
	const [panelCount, setPanelCount] = useState<number>(0);
	const [nonStandardStatusCount, setNonStandardStatusCount] = useState<number>(0);
	const [totalMemberCount, setTotalMemberCount] = useState<number>(0);
	const [panelsWithOneDifferentStatusCount, setPanelsWithOneDifferentStatusCount] = useState<number>(0);
	const [primaryMembersInEsenyurtCount, setPrimaryMembersInEsenyurtCount] = useState<number>(0);
	const [primaryMembersInGebzeCount, setPrimaryMembersInGebzeCount] = useState<number>(0);
	const [showOnlyEsenyurtPrimary] = useState<boolean>(false);
	const [showOnlyGebzePrimary] = useState<boolean>(false);
	const POLLING_INTERVAL = 5000;
	const { searchTerm } = useContext(SearchContext);
	const tableRef = useRef<HTMLDivElement>(null);
	const [selectedCard, setSelectedCard] = useState<string | null>(null);
	const [isSecondModalVisible, setIsSecondModalVisible] = useState(false);
	const [operationResult, setOperationResult] = useState<{ success?: boolean, message?: string }>({});
	const [selectedReplicaSetName, setSelectedReplicaSetName] = useState("");
	const [nodeStatuses, setNodeStatuses] = useState<NodeStatus[]>([]);
	const [connInfos, setConnInfos] = useState<{ [key: string]: ConnInfo }>({});
	const [selectedTime, setSelectedTime] = useState<Moment | null>(null);
	const [modalVisible, setModalVisible] = useState(false);
	
	// const keys = useKeycloak()?.keycloak;

	useEffect(() => {
		// Keycloak kodu yerine Redux state'ini kullanıyoruz
		// useEffect(() => {
		//     setIsLoggedIn(keys?.authenticated || false)
		// }, [keys?.authenticated]);
		
	}, []);

	useEffect(() => {
		const apiUrl = `${import.meta.env.VITE_REACT_APP_API_URL}/status`;
		const fetchData = () => {
			fetch(apiUrl)
				.then((response) => response.json())
				.then((responseData) => {
					if (Array.isArray(responseData)) {
						setData(responseData);
					} else {
						setData([]);
						console.warn('API response is not an array:', responseData);
					}
					setLoading(false);
				})
				.catch((error) => {
					console.error('Error fetching data:', error);
					setData([]);
					setLoading(false);
				});
		}

		fetchData(); // initial fetch

		const intervalId = setInterval(() => {
			fetchData(); // Fetch data at intervals
			// Cleanup at intervals
		}, POLLING_INTERVAL);


		return () => clearInterval(intervalId); // cleanup

	}, []);

	useEffect(() => {
		const intervalId = setInterval(async () => {
			try {
				const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/checkalarms`, {
					method: 'POST',
				});
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				fetchConnInfos(); // Alarm durumu değiştiğinde tekrar fetch yaparak güncelleyebiliriz
			} catch (error) {
				console.error('Failed to check alarms:', error);
			}
		}, 5000); // Her 60 saniyede bir kontrol eder

		return () => clearInterval(intervalId); // Temizleme işlevi
	}, []);





	const fetchConnInfos = async () => {
		try {
			const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/conninfo`);
			const data = await response.json();
			
			if (Array.isArray(data)) {
				const infoMap = data.reduce((acc, curr) => {
					acc[curr.nodename] = curr;
					return acc;
				}, {} as { [key: string]: ConnInfo });
				setConnInfos(infoMap);
			} else {
				console.warn('Connection info response is not an array:', data);
				setConnInfos({});
			}
		} catch (error) {
			console.error('Failed to fetch connection info:', error);
			setConnInfos({}); // Hata durumunda boş obje
		}
	};

	useEffect(() => {
		fetchConnInfos();
	}, []);


	useEffect(() => {
		dispatch(setHeadStats({
			panelName: 'mongo',
			panelCount: panelCount,
			nonStandardStatusCount: nonStandardStatusCount,
			totalMemberCount: totalMemberCount,
			panelsWithOneDifferentStatusCount: panelsWithOneDifferentStatusCount,
			primaryMembersInEsenyurtCount: primaryMembersInEsenyurtCount,
			primaryMembersInGebzeCount: primaryMembersInGebzeCount,
		}));// eslint-disable-next-line
	}, [panelCount, nonStandardStatusCount, totalMemberCount, panelsWithOneDifferentStatusCount, primaryMembersInEsenyurtCount, primaryMembersInGebzeCount])

	useEffect(() => {
		// Partially healtyh count
		let panelsWithOneDifferentStatusCount = 0;
		const faultyNodes: { name: string, status: string }[] = [];
		const currentFaultyNodesSet = new Set<string>();

		data.forEach((panelData: MyData) => {
			const membersInPanel = Object.values(panelData)[0] as replicaNode[];
			const nonStandardMembers = membersInPanel.filter((member: replicaNode) =>
				!["SECONDARY", "ARBITER", "PRIMARY"].includes(member.status)
			);

			if (nonStandardMembers.length === 1) {
				panelsWithOneDifferentStatusCount++;
				faultyNodes.push({
					name: nonStandardMembers[0].nodename,
					status: nonStandardMembers[0].status
				});
				currentFaultyNodesSet.add(nonStandardMembers[0].nodename);
			}
		});

		// Total Cluster Count
		setPanelCount(data.length);

		// Total UnHealthy Nodes Count and Total Nodes Count
		let count = 0;
		const allMembersCount = Array.isArray(data) ? data.reduce((total, panelData) => {
			const members = Object.values(panelData)[0];
			if (Array.isArray(members)) {
				return total + members.length;
			}
			return total;
		}, 0) : 0;

		data.forEach((panelObject: MyData) => {
			Object.values(panelObject).forEach((panel: replicaNode[]) => {
				panel.forEach((member: replicaNode) => {
					if (!["PRIMARY", "SECONDARY", "ARBITER"].includes(member.status)) {
						count++;
					}
				});
			});
		});

		setNonStandardStatusCount(count);
		setTotalMemberCount(allMembersCount);
		setPanelsWithOneDifferentStatusCount(panelsWithOneDifferentStatusCount);

		const primaryEsenyurtCount = data.reduce((count: number, panelData: MyData) => {
			const membersInPanel = Object.values(panelData)[0] as replicaNode[];
			const primaryInEsenyurt = membersInPanel.filter((member: replicaNode) =>
				member.dc === 'Esenyurt' && member.status === 'PRIMARY'
			).length;
			return count + primaryInEsenyurt;
		}, 0);
		setPrimaryMembersInEsenyurtCount(primaryEsenyurtCount);

		const primaryGebzeCount = data.reduce((count: number, panelData: MyData) => {
			const membersInPanel = Object.values(panelData)[0] as replicaNode[];
			const primaryInGebze = membersInPanel.filter((member: replicaNode) =>
				member.dc === 'Gebze' && member.status === 'PRIMARY'
			).length;
			return count + primaryInGebze;
		}, 0);
		setPrimaryMembersInGebzeCount(primaryGebzeCount);
	}, [data]);

	const getFullNodeName = (nodeName: string): string => {
		if (nodeName.includes(".osp-") && !nodeName.includes(".hepsi.io")) {
			return `${nodeName}.hepsi.io`;
		} else if ((nodeName.includes("dpay") || nodeName.includes("altpay")) && !nodeName.includes(".dpay.int")) {
			return `${nodeName}.dpay.int`;
		}
		return `${nodeName}.hepsiburada.dmz`;
	};


	const columns = [
		{
			title: 'Node Name',
			dataIndex: 'nodename',
			key: 'nodename',
			render: (nodename: string, record: any) => {
				const isNodeUpdated = record.isUpdated;

				return (
					<div style={{ display: 'flex', alignItems: 'center' }}>
						<span>{nodename}</span>
						<Tooltip title={isNodeUpdated ? "Agent is Running" : "Agent is Not Running"}>
							{isNodeUpdated ? (
								<img
									src={runningGif}
									alt="Running"
									style={{ width: 16, height: 16, marginLeft: 8, cursor: 'pointer' }}
								/>
							) : (
								<CloseCircleOutlined
									style={{ color: 'red', marginLeft: 8, cursor: 'pointer' }}
								/>
							)}
						</Tooltip>
					</div>
				);
			},
		},
		{
			title: 'Status',
			dataIndex: 'status',
			key: 'status',
			render: (text: string, record: any) => {
				let color;
				if (text === 'PRIMARY' || text === 'SECONDARY') {
					color = 'green';
				} else if (text === 'ARBITER') {
					color = 'geekblue';
				} else {
					color = 'volcano';
				}

				const fullNodeName = record?.nodename ? getFullNodeName(record.nodename) : null;
				if (!fullNodeName || !connInfos[fullNodeName]) {
					return (
						<Tag color={color} style={{ marginRight: 8 }}>
							{text}
						</Tag>
					);
				}

				const syncStatus = connInfos[fullNodeName]?.sync_status?.Valid ? `${connInfos[fullNodeName].sync_status.Int32}%` : null;

				// sync_collection alanını güvenli şekilde kontrol etme
				const collectionName = connInfos[fullNodeName]?.sync_collection?.Valid
					? connInfos[fullNodeName]!.sync_collection!.String
					: null;

				const statusText = syncStatus ? `${text} - ${syncStatus}` : text;

				return (
					<Tooltip title={collectionName || "No Collection Name"}>
						<Tag color={color} style={{ marginRight: 8 }}>
							{statusText}
						</Tag>
					</Tooltip>
				);
			},
		},
		{
			title: 'Ip',
			dataIndex: 'ip',
			key: 'ip',
		},
		{
			title: 'Dc',
			dataIndex: 'dc',
			key: 'dc',
			render: (text: string) => {
				let color;
				if (text === 'Esenyurt') {
					color = 'blue';
				} else if (text === 'Gebze') {
					color = 'yellow';
				} else {
					color = 'volcano';
				}

				return (
					<Tag color={color}>
						{text}
					</Tag>
				);
			},
		},
		{
			title: 'Total Disk',
			dataIndex: 'totalDisksize',
			key: 'totalDisksize',
		},
		{
			title: 'Free Disk',
			dataIndex: 'freediskdata',
			key: 'freediskdata',
		},
		{
			title: 'Free Disk %',
			dataIndex: 'freediskpercent',
			key: 'freediskpercent',
			render: (freediskpercent: number, record: replicaNode) => {
				let color = 'green';
				let icon = <CheckCircleOutlined style={{ color: 'green', marginRight: 4 }} />;

				if (freediskpercent < 25) {
					color = 'volcano';
					icon = <WarningOutlined style={{ color: 'orange', marginRight: 4 }} />;
				}

				const fullNodeName = getFullNodeName(record.nodename);

				// silence_until alanını moment nesnesine dönüştür
				const silenceUntilRaw = connInfos[fullNodeName]?.silence_until;
				const initialDate = silenceUntilRaw && silenceUntilRaw.Valid
					? moment.utc(silenceUntilRaw.Time) // UTC'den yerel zamana dönüştür
					: null;// moment ile dönüştürülmüş hali

				let tooltipMessage = "Alarm On"; // Varsayılan

				// Eğer alarm kapalıysa (send_diskalarm false)
				if (!connInfos[fullNodeName]?.send_diskalert) {
					// Eğer tarih geçerliyse
					if (initialDate && initialDate.isValid()) {
						tooltipMessage = `Alarm Off Until ${initialDate.format("DD.MM.YYYY HH:mm")}`;
					} else {
						tooltipMessage = "Alarm Off";
					}
				}

				return (
					<div style={{ display: 'flex', alignItems: 'center' }}>
						<Tag color={color} style={{ marginRight: 8 }}>
							{icon}
							{`${freediskpercent}%`}
						</Tag>
						{isLoggedIn && (
							<>
								<Tooltip title={tooltipMessage}>
									<Button
										type="link"
										icon={
											connInfos[fullNodeName]?.send_diskalert ? (
												<BellTwoTone twoToneColor="#52c41a" />
											) : (
												<BellTwoTone twoToneColor="#ff0000" />
											)
										}
										onClick={() => {
											setSelectedTime(null); // Reset the selectedTime state
											handleSilentAlarm(record.nodename);
										}}
									/>
								</Tooltip>
								<DatePicker
									showTime
									format="YYYY-MM-DD HH:mm:ss"
									placeholder="Alarm Off Until.."
									onChange={(value) => setSelectedTime(value ? moment(value.toISOString()) : null)}
								/>
							</>
						)}
					</div>
				);
			},
		},
		{
			title: 'Version',
			dataIndex: 'version',
			key: 'version',
		},
	];


	const filteredData = (showOnlyEsenyurtPrimary || showOnlyGebzePrimary) ? data.filter(panelData => {
		const membersInPanel = Object.values(panelData)[0] as replicaNode[];
		return (
			(showOnlyEsenyurtPrimary && membersInPanel.some(member => member.dc === 'Esenyurt' && member.status === 'PRIMARY')) ||
			(showOnlyGebzePrimary && membersInPanel.some(member => member.dc === 'Gebze' && member.status === 'PRIMARY'))
		);
	}) : data;

	const filteredDataSearch = React.useMemo(() => {
		let results = data;

		// Search term için filtreleme
		if (searchTerm) {
			results = results.filter(panelData => {
				return Object.keys(panelData).some(key => key.toLowerCase().includes(searchTerm.toLowerCase()));
			});
		}

		return results;
	}, [data, searchTerm]);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/agentstatus`);
				const nodeData = response.data; // {"mongo-dba-test-01":"00:08:37", "mongo-dba-test-02":"00:08:37", ...}

				const newStatuses = Object.keys(nodeData).map(nodename => {
					const nodeTime = moment(nodeData[nodename], "YYYY-MM-DDTHH:mm:ss");
					const isUpdatedRecently = nodeTime.isAfter(moment().subtract(2, 'minutes'));

					return { nodename, isUpdated: isUpdatedRecently };
				});

				setNodeStatuses(newStatuses);
			} catch (error) {
				console.error('Error fetching data: ', error);
			}
		};

		fetchData();
		const intervalId = setInterval(fetchData, POLLING_INTERVAL);

		return () => clearInterval(intervalId);
	}, []);


	const normalizeNodeName = (name: string) => {
		const trimmedName = name.trim().toLowerCase();

		if (trimmedName.includes('osp-r2-st') || trimmedName.includes('osp-r1-st')) {
			if (!trimmedName.endsWith('.hepsi.io')) {
				return trimmedName.replace(/\.hepsiburada\.dmz$|\.dpay\.int$/, '') + '.hepsi.io';
			}
		} else if (trimmedName.includes('dpay') || trimmedName.includes('altpay')) {
			if (!trimmedName.endsWith('.dpay.int')) {
				return trimmedName.replace(/\.hepsiburada\.dmz$|\.hepsi\.io$/, '') + '.dpay.int';
			}
		} else {
			if (!trimmedName.endsWith('.hepsiburada.dmz')) {
				return trimmedName.replace(/\.hepsi\.io$|\.dpay\.int$/, '') + '.hepsiburada.dmz';
			}
		}

		return trimmedName;
	};



	const handle = (replSetName: string) => {
		setSelectedReplicaSetName(replSetName);
		if (selectedCard === replSetName) {
			setSelectedCard(''); // Eğer aynı karta tıklanırsa efekti kaldır
			setActiveReplSet([]); // Veriyi temizle
		} else {
			setSelectedCard(replSetName); // Farklı bir karta tıklanırsa o kartın ismini sakla

			const filteredArray = filteredData.filter(item => replSetName in item);
			const repDetails = getReplicaDetail(filteredArray[0][replSetName]);

			const dataSource = repDetails.map((detail) => {
				const nodeStatus = nodeStatuses.find(status =>
					normalizeNodeName(status.nodename) === normalizeNodeName(detail.nodename)
				);
				return {
					replicasetname: replSetName,
					key: detail.nodename,
					nodename: detail.nodename,
					status: detail.status,
					ip: detail.ip,
					dc: detail.dc,
					totalDisksize: detail.totalDisksize,
					freediskdata: detail.freediskdata,
					freediskpercent: detail.freediskpercent,
					version: detail.version,
					isUpdated: nodeStatus ? nodeStatus.isUpdated : false, // isUpdated field added here
				};
			});
			setActiveReplSet(dataSource);
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


	function showConfirmStepdown(nodeName: string) {
		Modal.confirm({
			title: 'Are you sure?',
			content: `Do you want to execute stepdown() for ${nodeName}?`,
			onOk: async () => {
				setIsSecondModalVisible(true);
				handleIconStepdownClick(nodeName); // nodeName bilgisini fonksiyona ilettik
				setLoading2(false);

			},
			onCancel() {

			},
		});
	}
	const handleSecondModalClose = () => {
		setIsSecondModalVisible(false);
	}

	useEffect(() => {
		if (activeReplSet.length > 0 && tableRef.current) {
			window.scrollTo({
				top: tableRef.current.offsetTop,
				behavior: 'smooth',
			});
		}
	}, [activeReplSet]);

	const getPanelStyleClasses = (repDetails: replicaNode[]) => {
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
			<Space direction="vertical" size="middle" style={{ display: 'flex' }}>
				{loading ? (
					<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
						<Spin size="large" />
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
								<p>You haven't added any MongoDB clusters yet.</p>
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
							<div className="stats-container">
								<div key={"sad"} className="panels-wrapper">
									{filteredDataSearch
										.sort((a, b) => {
											const aKey = Object.keys(a)[0];
											const bKey = Object.keys(b)[0];
											return aKey.localeCompare(bKey);
										})
										.map((da) => {
											return Object.keys(da).map((replicasetname, index) => {
												const replicaNodes = da[replicasetname];
												const detailedNodes = getReplicaDetail(replicaNodes);

												const isNodeUpdated = detailedNodes.every((nodeDetail) => {
													const nodeStatus = nodeStatuses.find(
														(status) =>
															status.nodename === `${nodeDetail.nodename}.hepsiburada.dmz` ||
															status.nodename === `${nodeDetail.nodename}.hepsi.io` ||
															status.nodename === `${nodeDetail.nodename}.dpay.int`
													);
													return nodeStatus?.isUpdated ?? false;
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
						)}
					</>
				)}
			</Space>

			{
				activeReplSet.length > 0 &&
				<div ref={tableRef} style={{ position: 'relative' }}>
					<Badge.Ribbon color='#4faa40ff' text={<span style={{ fontWeight: 'bold' }}>{selectedReplicaSetName}</span>} placement="end" style={{ zIndex: 1000 }}>
					</Badge.Ribbon>
					<Table className='textclr'
						style={{ marginTop: 10 }}
						columns={columns}
						expandable={{
							expandedRowRender: isLoggedIn ? (record: replicaNode) => {
								if (record.status === "PRIMARY") {
									return (
										<div>
											<Popover content="stepdown()"><a href="#" onClick={() => showConfirmStepdown(record.nodename)} style={{ marginRight: 10 }}>
												<IconStepdown color='red' />
											</a></Popover>


										</div>

									);
								}
							} : undefined,
						}}
						title={() => (
							<div style={{ display: 'flex', alignItems: 'left' }}>

							</div>
						)}
						dataSource={activeReplSet}
						pagination={false}
					/>
				</div>
			}
			{/* İkinci Modal */}
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