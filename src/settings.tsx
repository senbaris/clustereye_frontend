import React, { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, Switch, message, Space, Table, Typography, Divider, Select, Modal } from 'antd';
import { SettingOutlined, UserOutlined, BellOutlined, SlackOutlined, MailOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface User {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    isActive: boolean;
}

interface NotificationSettings {
    slackWebhookUrl: string;
    slackEnabled: boolean;
    emailEnabled: boolean;
    emailServer: string;
    emailPort: string;
    emailUser: string;
    emailPassword: string;
    emailFrom: string;
    emailRecipients: string[];
}

const Settings: React.FC = () => {
    // State for user management
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userModalVisible, setUserModalVisible] = useState(false);

    // State for notification settings
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        slackWebhookUrl: '',
        slackEnabled: false,
        emailEnabled: false,
        emailServer: '',
        emailPort: '',
        emailUser: '',
        emailPassword: '',
        emailFrom: '',
        emailRecipients: []
    });

    // Form instances
    const [slackForm] = Form.useForm();
    const [emailForm] = Form.useForm();
    const [userForm] = Form.useForm();

    // Fetch users and settings
    useEffect(() => {
        fetchUsers();
        fetchNotificationSettings();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);

        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // API'den kullanıcıları çek
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching users: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API response (users):', data);

            // Gerçek API yanıt yapısına göre formatlama
            let formattedUsers: User[] = [];

            if (data.success && Array.isArray(data.users)) {
                formattedUsers = data.users.map((user: any) => ({
                    id: String(user.id),
                    username: user.username,
                    email: user.email,
                    isAdmin: user.admin === "true" || user.admin === true,
                    isActive: user.status === "active"
                }));
            }

            console.log('Formatted users:', formattedUsers);
            setUsers(formattedUsers);

            // Eğer API yanıtında kullanıcı yoksa veya geliştirme aşamasındaysak
            if (formattedUsers.length === 0 && import.meta.env.MODE === 'development') {
                console.log('No users found or using development mode, showing sample data');
                setUsers([
                    { id: '1', username: 'admin', email: 'admin@example.com', isAdmin: true, isActive: true },
                    { id: '2', username: 'user1', email: 'user1@example.com', isAdmin: false, isActive: true },
                    { id: '3', username: 'user2', email: 'user2@example.com', isAdmin: false, isActive: false }
                ]);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error(`Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Hata durumunda geliştirme modunda örnek veri göster
            if (import.meta.env.MODE === 'development') {
                console.log('Error in API call, showing sample data in development mode');
                setUsers([
                    { id: '1', username: 'admin', email: 'admin@example.com', isAdmin: true, isActive: true },
                    { id: '2', username: 'user1', email: 'user1@example.com', isAdmin: false, isActive: true },
                    { id: '3', username: 'user2', email: 'user2@example.com', isAdmin: false, isActive: false }
                ]);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchNotificationSettings = async () => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            console.log('Fetching notification settings with token:', token.substring(0, 10) + '...');

            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error fetching notification settings: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Raw API response (notification settings):', data);

            // API yanıtını uygun formata dönüştürüyoruz
            const formattedSettings = {
                slackWebhookUrl: data.settings?.slackWebhookUrl || '',
                slackEnabled: data.settings?.slackEnabled || false,
                emailEnabled: data.settings?.emailEnabled || false,
                emailServer: data.settings?.emailServer || '',
                emailPort: data.settings?.emailPort || '',
                emailUser: data.settings?.emailUser || '',
                emailPassword: data.settings?.emailPassword || '',
                emailFrom: data.settings?.emailFrom || '',
                emailRecipients: Array.isArray(data.settings?.emailRecipients) ? data.settings.emailRecipients : []
            };

            console.log('Formatted notification settings:', formattedSettings);

            // Tüm değerlerin boş olup olmadığını kontrol et
            const hasData = Object.entries(formattedSettings).some(([key, value]) => {
                // Boolean değerleri kontrol etme
                if (typeof value === 'boolean') return false;
                // Array kontrolü
                if (Array.isArray(value)) return value.length > 0;
                // String kontrolü
                return value !== '';
            });

            console.log('Has notification settings data:', hasData);

            setNotificationSettings(formattedSettings);

            // Form değerlerini güncelle
            slackForm.setFieldsValue({
                slackWebhookUrl: formattedSettings.slackWebhookUrl,
                slackEnabled: formattedSettings.slackEnabled
            });

            emailForm.setFieldsValue({
                emailEnabled: formattedSettings.emailEnabled,
                emailServer: formattedSettings.emailServer,
                emailPort: formattedSettings.emailPort,
                emailUser: formattedSettings.emailUser,
                emailPassword: formattedSettings.emailPassword,
                emailFrom: formattedSettings.emailFrom,
                emailRecipients: formattedSettings.emailRecipients
            });

            // API'den veri gelmezse veya geliştirme aşamasındaysak örnek veri göster
            if (!hasData) {
                console.log('No notification settings found in API response');

                const sampleSettings = {
                    slackWebhookUrl: 'https://hooks.slack.com/services/TXXXXXX/BXXXXXX/XXXXXXXXXX',
                    slackEnabled: true,
                    emailEnabled: false,
                    emailServer: 'smtp.example.com',
                    emailPort: '587',
                    emailUser: 'alerts@example.com',
                    emailPassword: '********',
                    emailFrom: 'alerts@example.com',
                    emailRecipients: ['admin@example.com', 'team@example.com']
                };

                setNotificationSettings(sampleSettings);

                slackForm.setFieldsValue({
                    slackWebhookUrl: sampleSettings.slackWebhookUrl,
                    slackEnabled: sampleSettings.slackEnabled
                });

                emailForm.setFieldsValue({
                    emailEnabled: sampleSettings.emailEnabled,
                    emailServer: sampleSettings.emailServer,
                    emailPort: sampleSettings.emailPort,
                    emailUser: sampleSettings.emailUser,
                    emailPassword: sampleSettings.emailPassword,
                    emailFrom: sampleSettings.emailFrom,
                    emailRecipients: sampleSettings.emailRecipients
                });
            }
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            message.error(`Failed to fetch notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Hata durumunda geliştirme modunda örnek veri göster
            if (import.meta.env.MODE === 'development') {
                console.log('Error in API call, showing sample data in development mode');

                const sampleSettings = {
                    slackWebhookUrl: 'https://hooks.slack.com/services/TXXXXXX/BXXXXXX/XXXXXXXXXX',
                    slackEnabled: true,
                    emailEnabled: false,
                    emailServer: 'smtp.example.com',
                    emailPort: '587',
                    emailUser: 'alerts@example.com',
                    emailPassword: '********',
                    emailFrom: 'alerts@example.com',
                    emailRecipients: ['admin@example.com', 'team@example.com']
                };

                setNotificationSettings(sampleSettings);

                slackForm.setFieldsValue({
                    slackWebhookUrl: sampleSettings.slackWebhookUrl,
                    slackEnabled: sampleSettings.slackEnabled
                });

                emailForm.setFieldsValue({
                    emailEnabled: sampleSettings.emailEnabled,
                    emailServer: sampleSettings.emailServer,
                    emailPort: sampleSettings.emailPort,
                    emailUser: sampleSettings.emailUser,
                    emailPassword: sampleSettings.emailPassword,
                    emailFrom: sampleSettings.emailFrom,
                    emailRecipients: sampleSettings.emailRecipients
                });
            }
        }
    };

    const handleSlackFormSubmit = async (values: any) => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // API'a gönderilecek verileri hazırla
            const slackData = {
                slack_webhook_url: values.slackWebhookUrl,
                slack_enabled: values.slackEnabled
            };

            // API call to save slack settings
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(slackData)
            });

            if (!response.ok) {
                throw new Error(`Error saving slack settings: ${response.status} - ${response.statusText}`);
            }

            // Update local state
            setNotificationSettings({
                ...notificationSettings,
                slackWebhookUrl: values.slackWebhookUrl,
                slackEnabled: values.slackEnabled
            });

            message.success('Slack settings saved successfully');
        } catch (error) {
            console.error('Error saving slack settings:', error);
            message.error(`Failed to save slack settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleTestSlack = async () => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // Webhook URL doğrulaması
            const webhookUrl = slackForm.getFieldValue('slackWebhookUrl');
            if (!webhookUrl) {
                throw new Error('Please enter a valid Slack webhook URL');
            }

            // API call to test slack webhook
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings/test-slack`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ webhook_url: webhookUrl })
            });

            if (!response.ok) {
                throw new Error(`Error testing Slack webhook: ${response.status} - ${response.statusText}`);
            }

            message.success('Test message sent to Slack successfully');
        } catch (error) {
            console.error('Error testing slack webhook:', error);
            message.error(`Failed to send test message to Slack: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleEmailFormSubmit = async (values: any) => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // API'a gönderilecek verileri hazırla
            const emailData = {
                email_enabled: values.emailEnabled,
                email_server: values.emailServer,
                email_port: values.emailPort,
                email_user: values.emailUser,
                email_password: values.emailPassword,
                email_from: values.emailFrom,
                email_recipients: values.emailRecipients
            };

            // API call to save email settings
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(emailData)
            });

            if (!response.ok) {
                throw new Error(`Error saving email settings: ${response.status} - ${response.statusText}`);
            }

            // Update local state
            setNotificationSettings({
                ...notificationSettings,
                emailEnabled: values.emailEnabled,
                emailServer: values.emailServer,
                emailPort: values.emailPort,
                emailUser: values.emailUser,
                emailPassword: values.emailPassword,
                emailFrom: values.emailFrom,
                emailRecipients: values.emailRecipients
            });

            message.success('Email settings saved successfully');
        } catch (error) {
            console.error('Error saving email settings:', error);
            message.error(`Failed to save email settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleTestEmail = async () => {
        try {
            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // Email ayarlarını doğrula
            const emailData = emailForm.getFieldsValue();

            if (!emailData.emailServer || !emailData.emailPort || !emailData.emailUser ||
                !emailData.emailPassword || !emailData.emailFrom || !emailData.emailRecipients?.length) {
                throw new Error('Please fill in all email settings fields before testing');
            }

            // Önceki verileri API formatına dönüştür
            const formattedData = {
                email_server: emailData.emailServer,
                email_port: emailData.emailPort,
                email_user: emailData.emailUser,
                email_password: emailData.emailPassword,
                email_from: emailData.emailFrom,
                email_recipients: emailData.emailRecipients
            };

            // API call to test email
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/notification-settings/email/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(formattedData)
            });

            if (!response.ok) {
                throw new Error(`Error testing email: ${response.status} - ${response.statusText}`);
            }

            message.success('Test email sent successfully');
        } catch (error) {
            console.error('Error testing email:', error);
            message.error(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const showAddUserModal = () => {
        setEditingUser(null);
        userForm.resetFields();
        setUserModalVisible(true);
    };

    const showEditUserModal = (user: User) => {
        setEditingUser(user);
        userForm.setFieldsValue({
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
            isActive: user.isActive
        });
        setUserModalVisible(true);
    };

    const handleUserFormSubmit = async (values: any) => {
        setLoading(true);

        try {
            if (editingUser) {
                // Güncelleme için sadece izin verilen alanları gönderelim
                const updateData = {
                    username: values.username,
                    email: values.email,
                    is_admin: values.isAdmin === true,
                    is_active: values.isActive ? "active" : "inactive"
                };

                console.log('Updating user (raw form values):', values);
                console.log('Updating user (formatted data):', JSON.stringify(updateData));

                // localStorage'dan token al
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error('Authorization token not found. Please log in again.');
                }

                const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify(updateData)
                });

                if (!response.ok) {
                    throw new Error(`Error updating user: ${response.status} - ${response.statusText}`);
                }

                // Update local state
                setUsers(users.map(user =>
                    user.id === editingUser.id ? {
                        ...user,
                        username: values.username,
                        email: values.email,
                        isAdmin: values.isAdmin,
                        isActive: values.isActive
                    } : user
                ));

                message.success('User updated successfully');
            } else {
                // Yeni kullanıcı için tüm bilgileri gönder
                const userData = {
                    username: values.username,
                    password: values.password,
                    email: values.email,
                    is_admin: values.isAdmin === true,
                    is_active: values.isActive ? "active" : "inactive"
                };

                console.log('Creating new user (raw form values):', values);
                console.log('Creating new user (formatted data):', JSON.stringify(userData));

                // localStorage'dan token al
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error('Authorization token not found. Please log in again.');
                }

                const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify(userData)
                });

                if (!response.ok) {
                    throw new Error(`Error creating user: ${response.status} - ${response.statusText}`);
                }

                const responseData = await response.json();
                console.log('API response:', responseData);

                // API yanıtındaki kullanıcı bilgilerini al veya varsayılan değerler kullan
                const newUser = {
                    id: responseData.id || Date.now().toString(),
                    username: values.username,
                    email: values.email || '',
                    isAdmin: values.isAdmin || false,
                    isActive: values.isActive || true
                };

                // Kullanıcı listesini güncelle
                setUsers([...users, newUser]);
                message.success('User created successfully');
            }

            // Modal'ı kapat
            setUserModalVisible(false);
        } catch (error) {
            console.error('Error in user form submit:', error);
            message.error(`${error instanceof Error ? error.message : 'An unexpected error occurred'}`);

            // Geliştirme modunda hata olsa bile UI'da değişiklik yap
            if (import.meta.env.MODE === 'development') {
                if (editingUser) {
                    // Update in UI despite error in development mode
                    setUsers(users.map(user =>
                        user.id === editingUser.id ? {
                            ...user,
                            username: values.username,
                            email: values.email,
                            isAdmin: values.isAdmin,
                            isActive: values.isActive
                        } : user
                    ));
                    console.log('Development mode: User updated in UI despite API error');
                } else {
                    // Create in UI despite error in development mode
                    const simulatedUser = {
                        id: Date.now().toString(),
                        username: values.username,
                        email: values.email || '',
                        isAdmin: values.isAdmin || false,
                        isActive: values.isActive || true
                    };
                    setUsers([...users, simulatedUser]);
                    console.log('Development mode: User created in UI despite API error');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            setLoading(true);

            // localStorage'dan token al
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Authorization token not found. Please log in again.');
            }

            // API call to delete user
            const response = await fetch(`${import.meta.env.VITE_REACT_APP_API_URL}/api/v1/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error deleting user: ${response.status} - ${response.statusText}`);
            }

            // UI'dan da kullanıcıyı kaldır
            setUsers(users.filter(user => user.id !== userId));

            message.success('User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            message.error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // Geliştirme modunda hata olsa bile UI'dan sil (gerçek uygulamada bunu yapmayın)
            if (import.meta.env.MODE === 'development') {
                setUsers(users.filter(user => user.id !== userId));
                console.log('Development mode: User removed from UI despite API error');
            }
        } finally {
            setLoading(false);
        }
    };

    const userColumns = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Admin',
            dataIndex: 'isAdmin',
            key: 'isAdmin',
            render: (isAdmin: boolean) => (
                isAdmin ? <Text type="success">Yes</Text> : <Text type="secondary">No</Text>
            )
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                isActive ? <Text type="success">Active</Text> : <Text type="danger">Inactive</Text>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (text: string, record: User) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        type="link"
                        onClick={() => showEditUserModal(record)}
                    />
                    <Button
                        icon={<DeleteOutlined />}
                        type="link"
                        danger
                        onClick={() => handleDeleteUser(record.id)}
                    />
                </Space>
            )
        }
    ];

    return (
        <div>
            <Title level={2}><SettingOutlined /> System Settings</Title>
            <Divider />

            <Tabs defaultActiveKey="1">
                <TabPane
                    tab={<span><UserOutlined /> User Management</span>}
                    key="1"
                >
                    <Card>
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <Title level={4}>Users</Title>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={showAddUserModal}
                            >
                                Add User
                            </Button>
                        </div>

                        <Table
                            columns={userColumns}
                            dataSource={users}
                            rowKey="id"
                            loading={loading}
                        />
                    </Card>
                </TabPane>

                <TabPane
                    tab={<span><BellOutlined /> Notifications</span>}
                    key="2"
                >
                    <Card title={<span><SlackOutlined /> Slack Notifications</span>} style={{ marginBottom: 16 }}>
                        <Form
                            form={slackForm}
                            layout="vertical"
                            onFinish={handleSlackFormSubmit}
                            initialValues={{
                                slackWebhookUrl: notificationSettings.slackWebhookUrl,
                                slackEnabled: notificationSettings.slackEnabled
                            }}
                        >
                            <Form.Item
                                name="slackEnabled"
                                label="Enable Slack Notifications"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>

                            <Form.Item
                                name="slackWebhookUrl"
                                label="Slack Webhook URL"
                                rules={[
                                    { required: true, message: 'Please enter the Slack webhook URL' },
                                    { type: 'url', message: 'Please enter a valid URL' }
                                ]}
                            >
                                <Input placeholder="https://hooks.slack.com/services/..." />
                            </Form.Item>

                            <Form.Item>
                                <Space>
                                    <Button type="primary" htmlType="submit">
                                        Save Settings
                                    </Button>
                                    <Button onClick={handleTestSlack}>
                                        Test Connection
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Card>

                    <Card title={<span><MailOutlined /> Email Notifications</span>}>
                        <Form
                            form={emailForm}
                            layout="vertical"
                            onFinish={handleEmailFormSubmit}
                            initialValues={{
                                emailEnabled: notificationSettings.emailEnabled,
                                emailServer: notificationSettings.emailServer,
                                emailPort: notificationSettings.emailPort,
                                emailUser: notificationSettings.emailUser,
                                emailPassword: notificationSettings.emailPassword,
                                emailFrom: notificationSettings.emailFrom,
                                emailRecipients: notificationSettings.emailRecipients
                            }}
                        >
                            <Form.Item
                                name="emailEnabled"
                                label="Enable Email Notifications"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>

                            <Form.Item
                                name="emailServer"
                                label="SMTP Server"
                                rules={[
                                    { required: true, message: 'Please enter the SMTP server' }
                                ]}
                            >
                                <Input placeholder="smtp.example.com" />
                            </Form.Item>

                            <Form.Item
                                name="emailPort"
                                label="SMTP Port"
                                rules={[
                                    { required: true, message: 'Please enter the SMTP port' }
                                ]}
                            >
                                <Input placeholder="587" />
                            </Form.Item>

                            <Form.Item
                                name="emailUser"
                                label="SMTP Username"
                                rules={[
                                    { required: true, message: 'Please enter the SMTP username' }
                                ]}
                            >
                                <Input placeholder="username" />
                            </Form.Item>

                            <Form.Item
                                name="emailPassword"
                                label="SMTP Password"
                                rules={[
                                    { required: true, message: 'Please enter the SMTP password' }
                                ]}
                            >
                                <Input.Password placeholder="password" />
                            </Form.Item>

                            <Form.Item
                                name="emailFrom"
                                label="From Email Address"
                                rules={[
                                    { required: true, message: 'Please enter the from email address' },
                                    { type: 'email', message: 'Please enter a valid email address' }
                                ]}
                            >
                                <Input placeholder="alerts@example.com" />
                            </Form.Item>

                            <Form.Item
                                name="emailRecipients"
                                label="Recipients"
                                rules={[
                                    { required: true, message: 'Please add at least one recipient' }
                                ]}
                            >
                                <Select
                                    mode="tags"
                                    style={{ width: '100%' }}
                                    placeholder="Add email recipients"
                                    tokenSeparators={[',']}
                                />
                            </Form.Item>

                            <Form.Item>
                                <Space>
                                    <Button type="primary" htmlType="submit">
                                        Save Settings
                                    </Button>
                                    <Button onClick={handleTestEmail}>
                                        Test Email
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Card>
                </TabPane>
            </Tabs>

            <Modal
                title={editingUser ? "Edit User" : "Add User"}
                visible={userModalVisible}
                onCancel={() => setUserModalVisible(false)}
                footer={null}
            >
                <Form
                    form={userForm}
                    layout="vertical"
                    onFinish={handleUserFormSubmit}
                >
                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[
                            { required: true, message: 'Please enter username' }
                        ]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Username" />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Please enter email' },
                            { type: 'email', message: 'Please enter a valid email' }
                        ]}
                    >
                        <Input prefix={<MailOutlined />} placeholder="Email" />
                    </Form.Item>

                    {!editingUser && (
                        <Form.Item
                            name="password"
                            label="Password"
                            rules={[
                                { required: true, message: 'Please enter password' },
                                { min: 6, message: 'Password must be at least 6 characters' }
                            ]}
                        >
                            <Input.Password placeholder="Password" />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="isAdmin"
                        label="Admin User"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>

                    <Form.Item
                        name="isActive"
                        label="Active"
                        valuePropName="checked"
                        initialValue={true}
                    >
                        <Switch />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingUser ? "Update User" : "Create User"}
                            </Button>
                            <Button onClick={() => setUserModalVisible(false)}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Settings; 