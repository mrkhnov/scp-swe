import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from '../../services/api';
import { Link, LinkStatus, Product, Order, Complaint, ComplaintStatus } from '../../types';
import { useApp } from '../../App';

export default function ConsumerDashboard() {
    return (
        <Routes>
            <Route path="/" element={<ConsumerCatalog />} />
            <Route path="/suppliers" element={<ConsumerLinks />} />
            <Route path="/orders" element={<ConsumerOrders />} />
            <Route path="/complaints" element={<ConsumerComplaints />} />
        </Routes>
    );
}

// --- Sub-components ---

function ConsumerLinks() {
    const [links, setLinks] = useState<Link[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    useEffect(() => {
        api.getMyLinks().then(setLinks).catch(console.error);
        api.getAvailableSuppliers().then(setSuppliers).catch(console.error);
    }, []);

    const handleRequestLink = async (supplierId: number) => {
        try {
            await api.requestLink(supplierId);
            alert('Link request sent!');
            api.getMyLinks().then(setLinks);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const isLinked = (supplierId: number) => {
        return links.some(link => link.supplier_id === supplierId);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Available Suppliers */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-xl font-semibold text-system-text mb-6">Available Suppliers</h3>
                {suppliers.length === 0 ? (
                    <p className="text-system-textSec text-center py-8">No suppliers available.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suppliers.map(supplier => {
                            const linked = isLinked(supplier.id);
                            const linkStatus = links.find(l => l.supplier_id === supplier.id)?.status;
                            return (
                                <div key={supplier.id} className="p-5 bg-system-bg rounded-2xl border border-system-border/50">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🏢</div>
                                        <div className="flex-grow">
                                            <div className="font-semibold text-system-text">{supplier.name}</div>
                                            <div className="text-xs text-system-textSec">ID: {supplier.id}</div>
                                        </div>
                                    </div>
                                    {linked ? (
                                        <span className={`block text-center px-3 py-2 rounded-lg text-xs font-medium ${
                                            linkStatus === LinkStatus.APPROVED ? 'bg-system-green/10 text-system-green' :
                                            linkStatus === LinkStatus.PENDING ? 'bg-system-orange/10 text-system-orange' :
                                            'bg-system-red/10 text-system-red'
                                        }`}>
                                            {linkStatus}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleRequestLink(supplier.id)}
                                            className="w-full bg-system-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-system-blueHover transition-colors"
                                        >
                                            Request Connection
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* My Links List */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-xl font-semibold text-system-text mb-6">My Connections</h3>
                {links.length === 0 ? <p className="text-system-textSec text-center py-8">No connections yet.</p> : (
                    <ul className="space-y-4">
                        {links.map(link => {
                            const supplier = suppliers.find(s => s.id === link.supplier_id);
                            return (
                                <li key={link.id} className="flex justify-between items-center p-4 bg-system-bg rounded-2xl">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-lg shadow-sm">🏢</div>
                                        <div>
                                            <div className="font-medium text-system-text">{supplier?.name || `Supplier #${link.supplier_id}`}</div>
                                            <div className="text-xs text-system-textSec">Link ID: {link.id}</div>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        link.status === LinkStatus.APPROVED ? 'bg-system-green/10 text-system-green' :
                                        link.status === LinkStatus.PENDING ? 'bg-system-orange/10 text-system-orange' :
                                        'bg-system-red/10 text-system-red'
                                    }`}>
                                        {link.status}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

function ConsumerCatalog() {
    const [products, setProducts] = useState<Product[]>([]);
    const { cart, addToCart, clearCart } = useApp();
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    useEffect(() => {
        const loadProducts = () => api.getProducts().then(setProducts).catch(console.error);
        loadProducts();
        
        // Listen for real-time product updates
        window.addEventListener('product_update', loadProducts);
        return () => window.removeEventListener('product_update', loadProducts);
    }, []);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setCheckoutLoading(true);
        try {
            const supplierIds = Array.from(new Set(cart.map(item => item.supplier_id)));
            for (const sid of supplierIds) {
                const items = cart.filter(c => c.supplier_id === sid).map(c => ({
                    product_id: c.id,
                    quantity: c.quantity
                }));
                await api.createOrder({ supplier_id: sid, items });
            }
            alert('Order placed successfully. Check Orders tab.');
            clearCart();
        } catch (e: any) {
            alert('Checkout failed: ' + e.message);
        } finally {
            setCheckoutLoading(false);
        }
    };

    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex-grow">
                <div className="flex justify-between items-end mb-6">
                    <h2 className="text-3xl font-bold text-system-text tracking-tight">Marketplace</h2>
                    <span className="text-sm text-system-textSec font-medium">{products.length} Items</span>
                </div>
                
                {products.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-system-border">
                        <p className="text-system-textSec">Connect with suppliers to see their products.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="group bg-white rounded-3xl shadow-card border border-system-border/50 overflow-hidden hover:shadow-lg transition-all duration-300">
                            <div className="aspect-square bg-system-bg relative overflow-hidden">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-6xl text-gray-300">📦</div>
                                )}
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-system-text text-lg leading-tight">{product.name}</h3>
                                    <p className="font-semibold text-system-text">${product.price.toFixed(2)}</p>
                                </div>
                                <p className="text-xs text-system-textSec mb-4 uppercase tracking-wide font-medium">{product.sku}</p>
                                <button 
                                    onClick={() => addToCart(product, product.min_order_qty)}
                                    className="w-full bg-system-bg text-system-blue font-medium py-2.5 rounded-xl hover:bg-system-blue hover:text-white transition-colors text-sm"
                                >
                                    Add to Order
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-full lg:w-96 shrink-0">
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50 sticky top-24">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-system-text">Your Order</h3>
                        {cart.length > 0 && <button onClick={clearCart} className="text-xs text-system-red font-medium hover:opacity-80">Clear All</button>}
                    </div>
                    
                    {cart.length === 0 ? (
                    <div className="py-12 text-center text-system-textSec border-2 border-dashed border-system-border/50 rounded-2xl">
                        Your cart is empty
                    </div>
                    ) : (
                    <div className="space-y-6">
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {cart.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-system-bg rounded-lg flex items-center justify-center text-sm shrink-0 overflow-hidden">
                                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover"/> : '📦'}
                                </div>
                                <div>
                                    <div className="font-medium text-sm text-system-text">{item.name}</div>
                                    <div className="text-xs text-system-textSec">Qty: {item.quantity}</div>
                                </div>
                            </div>
                            <div className="font-medium text-sm text-system-text">${(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                        ))}
                        </div>
                        <div className="pt-4 border-t border-system-border">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-system-textSec">Total</span>
                                <span className="text-2xl font-bold text-system-text">${totalPrice.toFixed(2)}</span>
                            </div>
                            <button 
                            onClick={handleCheckout}
                            disabled={checkoutLoading}
                            className="w-full bg-system-blue text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:bg-system-blueHover transition-colors disabled:opacity-70 disabled:shadow-none"
                            >
                            {checkoutLoading ? 'Processing...' : 'Place Order'}
                            </button>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ConsumerOrders() {
    const [myOrders, setMyOrders] = useState<Order[]>([]);
    const [showComplaintForm, setShowComplaintForm] = useState<number | null>(null);
    const [complaintText, setComplaintText] = useState('');

    useEffect(() => {
        const loadOrders = () => api.getMyOrders().then(setMyOrders).catch(console.error);
        loadOrders();
        
        // Listen for real-time order updates
        window.addEventListener('order_update', loadOrders);
        return () => window.removeEventListener('order_update', loadOrders);
    }, []);

    const handleCreateComplaint = async (orderId: number) => {
        if (!complaintText.trim()) {
            alert('Please enter a description');
            return;
        }

        try {
            await api.createComplaint({ order_id: orderId, description: complaintText });
            alert('Complaint created successfully');
            setShowComplaintForm(null);
            setComplaintText('');
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-system-text tracking-tight">My Orders</h2>
            
            <div className="space-y-4">
                {myOrders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-lg text-system-text">Order #{order.id}</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        order.status === 'COMPLETED' ? 'bg-system-green/10 text-system-green' :
                                        order.status === 'PENDING' ? 'bg-system-blue/10 text-system-blue' :
                                        order.status === 'ACCEPTED' ? 'bg-purple-100 text-purple-600' :
                                        order.status === 'IN_DELIVERY' ? 'bg-blue-100 text-blue-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {order.status}
                                    </span>
                                </div>
                                <p className="text-sm text-system-textSec">Supplier #{order.supplier_id} • {order.items.length} items</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-xl text-system-text">${order.total_amount.toFixed(2)}</p>
                                {order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
                                    <button
                                        onClick={() => setShowComplaintForm(order.id)}
                                        className="mt-2 text-sm text-system-red hover:underline"
                                    >
                                        Report Issue
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm bg-system-bg p-3 rounded-lg">
                                    <span>Product #{item.product_id} × {item.quantity}</span>
                                    <span className="font-medium">${(item.unit_price_at_time * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Complaint Form */}
                        {showComplaintForm === order.id && (
                            <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                                <h4 className="font-semibold text-system-text mb-3">Report an Issue</h4>
                                <textarea
                                    className="w-full p-3 bg-white border border-red-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-300"
                                    rows={3}
                                    placeholder="Describe the issue with this order..."
                                    value={complaintText}
                                    onChange={e => setComplaintText(e.target.value)}
                                />
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => handleCreateComplaint(order.id)}
                                        className="bg-system-red text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
                                    >
                                        Submit Complaint
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowComplaintForm(null);
                                            setComplaintText('');
                                        }}
                                        className="bg-white border border-system-border text-system-textSec px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {myOrders.length === 0 && <div className="bg-white p-12 rounded-3xl text-center text-system-textSec shadow-card border border-system-border/50">No orders yet.</div>}
        </div>
    );
}

function ConsumerComplaints() {
    const [complaints, setComplaints] = useState<any[]>([]);

    useEffect(() => {
        loadComplaints();
        
        // Listen for real-time complaint updates
        window.addEventListener('complaint_update', loadComplaints);
        return () => window.removeEventListener('complaint_update', loadComplaints);
    }, []);

    const loadComplaints = () => {
        api.getMyComplaints().then(setComplaints).catch(console.error);
    };

    const handleEscalateToManager = async (complaintId: number) => {
        if (!confirm('Not satisfied with the resolution? This will escalate the complaint to a Manager for review.')) {
            return;
        }
        
        try {
            await api.complaint.escalate(complaintId);
            alert('Complaint escalated to Manager');
            loadComplaints();
        } catch (err: any) {
            alert(err.message || 'Failed to escalate complaint');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">My Complaints</h2>
                <p className="text-system-textSec">Track your reported issues</p>
            </div>

            <div className="space-y-4">
                {complaints.map(complaint => (
                    <div key={complaint.id} className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="font-semibold text-system-text">Complaint #{complaint.id}</span>
                                <p className="text-xs text-system-textSec mt-1">Order #{complaint.order_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    complaint.status === 'OPEN' ? 'bg-yellow-100 text-yellow-700' :
                                    complaint.status === 'ESCALATED' ? 'bg-red-100 text-red-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                    {complaint.status}
                                </span>
                                {complaint.status === 'RESOLVED' && (
                                    <button
                                        onClick={() => handleEscalateToManager(complaint.id)}
                                        className="text-xs bg-system-red text-white px-3 py-1 rounded-full hover:bg-red-700"
                                    >
                                        Not Satisfied
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-sm text-system-text">{complaint.description}</p>
                        {complaint.handler_name && (
                            <p className="text-xs text-system-textSec mt-3">
                                Handler: {complaint.handler_name} 
                                <span className="ml-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                    {complaint.handler_role === 'SUPPLIER_SALES' ? 'Sales Rep' : 'Manager'}
                                </span>
                            </p>
                        )}
                    </div>
                ))}
                {complaints.length === 0 && (
                    <div className="bg-white p-12 rounded-3xl text-center text-system-textSec shadow-card border border-system-border/50">
                        <span className="text-4xl mb-4 block">✅</span>
                        <p>No complaints. Everything looks good!</p>
                    </div>
                )}
            </div>
        </div>
    );
}