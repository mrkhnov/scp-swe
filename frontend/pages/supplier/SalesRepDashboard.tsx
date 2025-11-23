import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Order, OrderStatus, Complaint, ComplaintStatus } from '../../types';
import { useApp } from '../../App';

export default function SalesRepDashboard() {
    const { t } = useTranslation();
    return (
        <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/orders" element={<OrdersView />} />
            <Route path="/complaints" element={<ComplaintsView />} />
        </Routes>
    );
}

// --- SUB-COMPONENTS ---

function Overview() {
    const { t } = useTranslation();
    const [orders, setOrders] = useState<Order[]>([]);
    const [complaints, setComplaints] = useState<Complaint[]>([]);

    useEffect(() => {
        loadData();
        
        // Listen for real-time updates
        const handleOrderUpdate = () => loadData();
        const handleComplaintUpdate = () => loadData();
        
        window.addEventListener('order_update', handleOrderUpdate);
        window.addEventListener('complaint_update', handleComplaintUpdate);
        
        return () => {
            window.removeEventListener('order_update', handleOrderUpdate);
            window.removeEventListener('complaint_update', handleComplaintUpdate);
        };
    }, []);

    const loadData = async () => {
        try {
            const [ordersData, complaintsData] = await Promise.all([
                api.getMyOrders(),
                api.getMyComplaints()
            ]);
            setOrders(ordersData);
            setComplaints(complaintsData);
        } catch (err) {
            console.error(err);
        }
    };

    const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING);
    const openComplaints = complaints.filter(c => c.status === ComplaintStatus.OPEN || c.status === ComplaintStatus.ESCALATED);

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.salesDashboard')}</h2>
                <p className="text-system-textSec">{t('supplier.salesDashboardSubtitle')}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                    <div className="text-system-textSec text-sm font-medium uppercase tracking-wide mb-2">{t('supplier.pendingOrders')}</div>
                    <div className="text-4xl font-bold text-system-text">{pendingOrders.length}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                    <div className="text-system-textSec text-sm font-medium uppercase tracking-wide mb-2">{t('supplier.openComplaints')}</div>
                    <div className="text-4xl font-bold text-system-text">{openComplaints.length}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                    <div className="text-system-textSec text-sm font-medium uppercase tracking-wide mb-2">{t('supplier.totalOrders')}</div>
                    <div className="text-4xl font-bold text-system-text">{orders.length}</div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">{t('supplier.recentOrders')}</h3>
                {pendingOrders.length === 0 ? (
                    <p className="text-system-textSec text-sm">{t('supplier.noPendingOrders')}</p>
                ) : (
                    <div className="space-y-4">
                        {pendingOrders.slice(0, 5).map(order => (
                            <div key={order.id} className="flex justify-between items-center p-5 bg-system-bg rounded-2xl border border-system-border/50">
                                <div>
                                    <span className="font-semibold text-system-text">{t('common.orders')} #{order.id}</span>
                                    <p className="text-xs text-system-textSec mt-1">{t('login.consumer')} #{order.consumer_id} • {order.items.length} {t('supplier.items')}</p>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-system-text">₸{order.total_amount.toFixed(2)}</div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-system-blue/10 text-system-blue">{order.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function OrdersView() {
    const { t } = useTranslation();
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        const loadOrders = () => api.getMyOrders().then(setOrders).catch(console.error);
        loadOrders();
        
        // Listen for real-time order updates
        window.addEventListener('order_update', loadOrders);
        return () => window.removeEventListener('order_update', loadOrders);
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.ordersReadOnly')}</h2>
            <p className="text-system-textSec -mt-4">{t('supplier.ordersReadOnlySubtitle')}</p>
            
            <div className="space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-lg text-system-text">{t('common.orders')} #{order.id}</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        order.status === OrderStatus.PENDING ? 'bg-system-blue/10 text-system-blue' :
                                        order.status === OrderStatus.ACCEPTED ? 'bg-system-green/10 text-system-green' :
                                        order.status === OrderStatus.IN_DELIVERY ? 'bg-purple-100 text-purple-700' :
                                        order.status === OrderStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>{order.status}</span>
                                </div>
                                <p className="text-sm text-system-textSec">{t('login.consumer')} ID: {order.consumer_id}</p>
                                
                                {/* Order Items */}
                                <div className="mt-4 space-y-2">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-system-bg p-3 rounded-lg">
                                            <span>{t('common.products')} #{item.product_id} × {item.quantity}</span>
                                            <span className="font-medium">₸{(item.unit_price_at_time * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <p className="text-sm text-system-textSec mb-1">{t('supplier.totalAmount')}</p>
                                <p className="font-bold text-2xl text-system-text">₸{order.total_amount.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                ))}
                {orders.length === 0 && <p className="text-center py-10 text-system-textSec">{t('common.noOrdersYet')}</p>}
            </div>
        </div>
    );
}

function ComplaintsView() {
    const { t } = useTranslation();
    const { user } = useApp();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        loadComplaints();
        
        // Listen for real-time complaint updates
        const handleComplaintUpdate = () => loadComplaints();
        window.addEventListener('complaint_update', handleComplaintUpdate);
        
        return () => window.removeEventListener('complaint_update', handleComplaintUpdate);
    }, []);

    const loadComplaints = async () => {
        try {
            const data = await api.getMyComplaints();
            setComplaints(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleReplyInChat = (complaint: Complaint) => {
        // Navigate to chat with the consumer and pass complaint info
        navigate('/chat', { 
            state: { 
                selectedUserId: complaint.created_by,  // User ID who created the complaint
                complaintId: complaint.id,
                complaintText: `Regarding Order #${complaint.order_id} - ${complaint.description}`
            } 
        });
    };

    const handleResolve = async (complaintId: number) => {
        if (!confirm('Are you sure you want to mark this complaint as resolved?')) return;
        
        try {
            await api.complaint.resolve(complaintId);
            await loadComplaints();
        } catch (err: any) {
            alert(err.message || 'Failed to resolve complaint');
        }
    };

    const handleEscalate = async (complaintId: number) => {
        if (!confirm('Escalate this complaint to a Manager?')) return;
        
        try {
            await api.complaint.escalate(complaintId);
            await loadComplaints();
        } catch (err: any) {
            alert(err.message || 'Failed to escalate complaint');
        }
    };

    // Separate complaints by assignment status
    const myComplaints = complaints.filter(c => c.handler_id === user?.id && c.status === ComplaintStatus.OPEN);
    const unassignedComplaints = complaints.filter(c => !c.handler_id && c.status === ComplaintStatus.OPEN);
    const otherAssignedComplaints = complaints.filter(c => c.handler_id && c.handler_id !== user?.id && c.status === ComplaintStatus.OPEN);
    const escalatedComplaints = complaints.filter(c => c.status === ComplaintStatus.ESCALATED);

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">{t('supplier.complaintManagement')}</h2>
                <p className="text-system-textSec">{t('supplier.complaintManagementSubtitle')}</p>
            </div>

            {/* My Complaints - Currently Handling */}
            {myComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-green rounded-full"></span>
                        {t('supplier.myComplaintsHandling')}
                    </h3>
                    <div className="space-y-4">
                        {myComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-green-50 rounded-2xl border border-green-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">{t('common.complaints')} #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            {t('supplier.order')} #{complaint.order_id}
                                            {complaint.created_by && ` • ${t('supplier.fromUser')} #${complaint.created_by}`}
                                            {complaint.handler_name && (
                                                <span className="block mt-1 text-green-700 font-medium">
                                                    {t('supplier.handler')}: {complaint.handler_name} ({complaint.handler_role})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReplyInChat(complaint)}
                                            className="bg-system-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
                                        >
                                            {t('supplier.replyInChat')}
                                        </button>
                                        <button
                                            onClick={() => handleResolve(complaint.id)}
                                            className="bg-system-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                                        >
                                            {t('supplier.resolve')}
                                        </button>
                                        <button
                                            onClick={() => handleEscalate(complaint.id)}
                                            className="bg-system-red text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
                                        >
                                            {t('common.escalate')}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Unassigned Complaints - Available to Handle */}
            {unassignedComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-blue rounded-full"></span>
                        {t('supplier.unassignedComplaints')}
                    </h3>
                    <div className="space-y-4">
                        {unassignedComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-system-bg rounded-2xl border border-system-border/50">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">{t('common.complaints')} #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            {t('supplier.order')} #{complaint.order_id}
                                            {complaint.created_by && ` • ${t('supplier.fromUser')} #${complaint.created_by}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReplyInChat(complaint)}
                                            className="bg-system-blue text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600"
                                        >
                                            {t('supplier.replyInChat')}
                                        </button>
                                        <button
                                            onClick={() => handleResolve(complaint.id)}
                                            className="bg-system-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                                        >
                                            {t('supplier.resolve')}
                                        </button>
                                        <button
                                            onClick={() => handleEscalate(complaint.id)}
                                            className="bg-system-red text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
                                        >
                                            {t('common.escalate')}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Other Sales Reps' Complaints - Read Only */}
            {otherAssignedComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        {t('supplier.beingHandledByOther')}
                    </h3>
                    <div className="space-y-4">
                        {otherAssignedComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-yellow-50 rounded-2xl border border-yellow-200 opacity-75">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">{t('common.complaints')} #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            {t('supplier.order')} #{complaint.order_id}
                                            {complaint.created_by && ` • ${t('supplier.fromUser')} #${complaint.created_by}`}
                                            {complaint.handler_name && (
                                                <span className="block mt-1 text-yellow-700 font-medium">
                                                    {t('supplier.handler')}: {complaint.handler_name} ({complaint.handler_role})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                        {complaint.handler_role === 'SUPPLIER_SALES' ? t('login.supplierSales') : t('login.supplierManager')}
                                    </span>
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Escalated Complaints (Read-only for Sales) */}
            {escalatedComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-red rounded-full"></span>
                        {t('supplier.escalatedToManager')}
                    </h3>
                    <div className="space-y-4">
                        {escalatedComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-red-50 rounded-2xl border border-red-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">{t('common.complaints')} #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            {t('supplier.order')} #{complaint.order_id}
                                            {complaint.created_by && ` • ${t('supplier.fromUser')} #${complaint.created_by}`}
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                        {t('supplier.awaitingManager')}
                                    </span>
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
