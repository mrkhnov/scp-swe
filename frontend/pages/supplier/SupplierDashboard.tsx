import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from '../../services/api';
import { Link, LinkStatus, Order, OrderStatus, Product, UserRole, Complaint, ComplaintStatus } from '../../types';
import { useApp } from '../../App';

export default function SupplierDashboard() {
    return (
        <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/products" element={<Inventory />} />
            <Route path="/orders" element={<OrderManagement />} />
            <Route path="/complaints" element={<ComplaintsManagement />} />
            <Route path="/team" element={<TeamManagement />} />
        </Routes>
    );
}

// --- SUB-COMPONENTS ---

function Overview() {
    const [links, setLinks] = useState<Link[]>([]);
    
    useEffect(() => {
        api.getMyLinks().then(setLinks).catch(console.error);
    }, []);

    const handleStatus = async (id: number, status: string) => {
        await api.updateLinkStatus(id, status);
        setLinks(await api.getMyLinks());
    };

    const pendingLinks = links.filter(l => l.status === LinkStatus.PENDING);
    const activeLinks = links.filter(l => l.status === LinkStatus.APPROVED);

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">Dashboard</h2>
                <p className="text-system-textSec">Welcome back. Here's what's happening today.</p>
            </div>
            
            {/* Pending Requests */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-system-text">Connection Requests</h3>
                    <span className="bg-system-blue/10 text-system-blue px-2 py-1 rounded-md text-xs font-bold">{pendingLinks.length} New</span>
                </div>
                
                {pendingLinks.length === 0 ? (
                    <p className="text-system-textSec text-sm">No pending requests at the moment.</p>
                ) : (
                    <div className="space-y-4">
                         {pendingLinks.map(link => (
                             <div key={link.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-system-bg rounded-2xl border border-system-border/50 gap-4">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-lg shadow-sm">👤</div>
                                     <div>
                                        <span className="font-semibold text-system-text block">Consumer #{link.consumer_id}</span>
                                        <span className="text-xs text-system-textSec">Request ID: {link.id}</span>
                                     </div>
                                 </div>
                                 <div className="flex gap-2 w-full sm:w-auto">
                                     <button onClick={() => handleStatus(link.id, LinkStatus.APPROVED)} className="flex-1 sm:flex-none px-4 py-2 bg-system-green text-white rounded-lg hover:bg-green-600 text-sm font-medium transition-colors">Approve</button>
                                     <button onClick={() => handleStatus(link.id, LinkStatus.REJECTED)} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-system-border text-system-red rounded-lg hover:bg-red-50 text-sm font-medium transition-colors">Reject</button>
                                 </div>
                             </div>
                         ))}
                    </div>
                )}
            </div>

            {/* Active Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                    <div className="text-system-textSec text-sm font-medium uppercase tracking-wide mb-2">Active Consumers</div>
                    <div className="text-4xl font-bold text-system-text">{activeLinks.length}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                     <div className="text-system-textSec text-sm font-medium uppercase tracking-wide mb-2">Pending Orders</div>
                     <div className="text-4xl font-bold text-system-text">0</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50">
                     <div className="text-system-textSec text-sm font-medium uppercase tracking-wide mb-2">Total Revenue</div>
                     <div className="text-4xl font-bold text-system-text">$0.00</div>
                </div>
            </div>
        </div>
    );
}

function Inventory() {
    const { user } = useApp();
    const [products, setProducts] = useState<Product[]>([]);
    const canEdit = user?.role === UserRole.SUPPLIER_OWNER || user?.role === UserRole.SUPPLIER_MANAGER;
    const [newProd, setNewProd] = useState({ name: '', price: 0, stock_quantity: 0, sku: '', min_order_qty: 1, image_url: '' });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<Product>>({});

    useEffect(() => {
        api.getProducts().then(setProducts).catch(console.error);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        
        try {
            // Don't send image_url since it's not in the backend schema
            const { image_url, ...productData } = newProd;
            // Auto set inactive if stock is 0
            const finalData = { ...productData, is_active: productData.stock_quantity > 0 };
            await api.createProduct(finalData);
            setProducts(await api.getProducts());
            setNewProd({ name: '', price: 0, stock_quantity: 0, sku: '', min_order_qty: 1, image_url: '' });
            setImageFile(null);
            alert('Product created successfully!');
        } catch (error: any) {
            alert('Failed to create product: ' + (error.message || 'Unknown error'));
        }
    };

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setEditForm({ ...product });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSaveEdit = async (productId: number) => {
        if (!canEdit) return;
        
        try {
            // Auto set inactive if stock is 0
            const finalData = { ...editForm, is_active: (editForm.stock_quantity ?? 0) > 0 };
            await api.updateProduct(productId, finalData);
            setProducts(await api.getProducts());
            setEditingId(null);
            setEditForm({});
            alert('Product updated successfully!');
        } catch (error: any) {
            alert('Failed to update product: ' + (error.message || 'Unknown error'));
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-system-text tracking-tight">Catalog Management</h2>
            
            {/* Add Product Form */}
            {canEdit && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6">Add New Product</h3>
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-system-textSec uppercase">Product Name</label>
                                <input className="w-full p-3 bg-system-bg border-none rounded-xl outline-none focus:ring-2 focus:ring-system-blue" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-system-textSec uppercase">SKU</label>
                                <input className="w-full p-3 bg-system-bg border-none rounded-xl outline-none focus:ring-2 focus:ring-system-blue" value={newProd.sku} onChange={e => setNewProd({...newProd, sku: e.target.value})} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-system-textSec uppercase">Price ($)</label>
                                <input type="number" className="w-full p-3 bg-system-bg border-none rounded-xl outline-none focus:ring-2 focus:ring-system-blue" value={newProd.price || ''} onChange={e => setNewProd({...newProd, price: parseFloat(e.target.value)})} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-system-textSec uppercase">Stock</label>
                                <input type="number" className="w-full p-3 bg-system-bg border-none rounded-xl outline-none focus:ring-2 focus:ring-system-blue" value={newProd.stock_quantity || ''} onChange={e => setNewProd({...newProd, stock_quantity: parseInt(e.target.value)})} required />
                            </div>
                             <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-semibold text-system-textSec uppercase">Product Image</label>
                                <div className="flex items-center gap-4">
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-system-textSec file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-system-blue/10 file:text-system-blue hover:file:bg-system-blue/20"/>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="bg-system-text text-white px-8 py-3 rounded-xl font-medium hover:bg-black transition-colors">Add Product</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Product Table */}
            <div className="bg-white rounded-3xl shadow-card border border-system-border/50 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-system-bg border-b border-system-border">
                        <tr>
                            <th className="p-5 text-xs font-semibold text-system-textSec uppercase">Image</th>
                            <th className="p-5 text-xs font-semibold text-system-textSec uppercase">SKU</th>
                            <th className="p-5 text-xs font-semibold text-system-textSec uppercase">Name</th>
                            <th className="p-5 text-xs font-semibold text-system-textSec uppercase">Price</th>
                            <th className="p-5 text-xs font-semibold text-system-textSec uppercase">Stock</th>
                            <th className="p-5 text-xs font-semibold text-system-textSec uppercase">Status</th>
                            {canEdit && <th className="p-5 text-xs font-semibold text-system-textSec uppercase">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-system-border/50">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-system-bg/50">
                                {editingId === p.id ? (
                                    <>
                                        <td className="p-5">
                                            <div className="w-12 h-12 bg-system-bg rounded-lg overflow-hidden flex items-center justify-center">
                                                {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover"/> : '📦'}
                                            </div>
                                        </td>
                                        <td className="p-5 font-mono text-xs text-system-textSec">{p.sku}</td>
                                        <td className="p-5">
                                            <input 
                                                type="text" 
                                                value={editForm.name || ''} 
                                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                                                className="w-full p-2 bg-system-bg rounded-lg border border-system-border"
                                            />
                                        </td>
                                        <td className="p-5">
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={editForm.price || ''} 
                                                onChange={e => setEditForm({...editForm, price: parseFloat(e.target.value)})}
                                                className="w-20 p-2 bg-system-bg rounded-lg border border-system-border"
                                            />
                                        </td>
                                        <td className="p-5">
                                            <input 
                                                type="number" 
                                                value={editForm.stock_quantity ?? ''} 
                                                onChange={e => setEditForm({...editForm, stock_quantity: parseInt(e.target.value)})}
                                                className="w-20 p-2 bg-system-bg rounded-lg border border-system-border"
                                            />
                                        </td>
                                        <td className="p-5">
                                            <span className={`font-medium ${(editForm.stock_quantity ?? 0) > 0 ? 'text-system-green' : 'text-system-textSec'}`}>
                                                {(editForm.stock_quantity ?? 0) > 0 ? 'Will be Active' : 'Will be Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSaveEdit(p.id)} className="px-3 py-1 bg-system-green text-white rounded-lg text-xs hover:bg-green-600">Save</button>
                                                <button onClick={handleCancelEdit} className="px-3 py-1 bg-system-textSec text-white rounded-lg text-xs hover:bg-gray-600">Cancel</button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-5">
                                            <div className="w-12 h-12 bg-system-bg rounded-lg overflow-hidden flex items-center justify-center">
                                                {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover"/> : '📦'}
                                            </div>
                                        </td>
                                        <td className="p-5 font-mono text-xs text-system-textSec">{p.sku}</td>
                                        <td className="p-5 font-medium text-system-text">{p.name}</td>
                                        <td className="p-5 text-system-text">${p.price.toFixed(2)}</td>
                                        <td className="p-5 text-system-text">{p.stock_quantity}</td>
                                        <td className="p-5">
                                            <span className={`font-medium ${p.is_active ? 'text-system-green' : 'text-system-textSec'}`}>
                                                {p.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        {canEdit && (
                                            <td className="p-5">
                                                <button onClick={() => handleEdit(p)} className="px-3 py-1 bg-system-blue text-white rounded-lg text-xs hover:bg-blue-600">Edit</button>
                                            </td>
                                        )}
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        api.getMyOrders().then(setOrders).catch(console.error);
    }, []);

    const handleOrder = async (id: number, status: string) => {
        try {
            await api.updateOrderStatus(id, status);
            setOrders(await api.getMyOrders());
        } catch (e: any) {
            alert(e.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-system-text tracking-tight">Incoming Orders</h2>
            <div className="space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-3xl shadow-card border border-system-border/50 hover:shadow-lg transition-shadow">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-lg text-system-text">Order #{order.id}</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                         order.status === OrderStatus.PENDING ? 'bg-system-blue/10 text-system-blue' :
                                         order.status === OrderStatus.ACCEPTED ? 'bg-system-green/10 text-system-green' :
                                         'bg-gray-100 text-gray-600'
                                    }`}>{order.status}</span>
                                </div>
                                <p className="text-sm text-system-textSec">Consumer ID: {order.consumer_id} • {order.items.length} items</p>
                            </div>
                            
                            <div className="text-right">
                                <p className="font-bold text-xl text-system-text mb-3">${order.total_amount.toFixed(2)}</p>
                                <div className="flex gap-3">
                                    {order.status === OrderStatus.PENDING && (
                                        <>
                                            <button 
                                                onClick={() => handleOrder(order.id, OrderStatus.ACCEPTED)}
                                                className="bg-system-text text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-black"
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={() => handleOrder(order.id, OrderStatus.REJECTED)}
                                                className="bg-white border border-system-border text-system-red px-5 py-2 rounded-full text-sm font-medium hover:bg-red-50"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                     {order.status === OrderStatus.ACCEPTED && (
                                        <button 
                                            onClick={() => handleOrder(order.id, OrderStatus.IN_DELIVERY)}
                                            className="bg-system-blue text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-blue-600"
                                        >
                                            Ship Order
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {orders.length === 0 && <p className="text-center py-10 text-system-textSec">No orders yet.</p>}
            </div>
        </div>
    );
}

function TeamManagement() {
    const { user } = useApp();
    const [companyUsers, setCompanyUsers] = useState<any[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', password: '', role: UserRole.SUPPLIER_MANAGER });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Only allow access for Supplier Owner
    if (user?.role !== UserRole.SUPPLIER_OWNER) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-system-textSec">
                <span className="text-4xl mb-4">🚫</span>
                <h2 className="text-xl font-semibold text-system-text">Access Denied</h2>
                <p className="mt-2">Only Supplier Owners can manage team members.</p>
            </div>
        );
    }

    useEffect(() => {
        loadCompanyUsers();
    }, []);

    const loadCompanyUsers = async () => {
        try {
            const users = await api.auth.getCompanyUsers();
            setCompanyUsers(users);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.auth.addCompanyUser(newUser);
            await loadCompanyUsers();
            setNewUser({ email: '', password: '', role: UserRole.SUPPLIER_MANAGER });
            setShowAddForm(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveUser = async (userId: number, userEmail: string) => {
        if (!confirm(`Are you sure you want to remove ${userEmail} from your company?`)) {
            return;
        }

        try {
            await api.auth.removeCompanyUser(userId);
            await loadCompanyUsers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const getRoleDisplayName = (role: UserRole) => {
        switch (role) {
            case UserRole.SUPPLIER_OWNER: return 'Owner';
            case UserRole.SUPPLIER_MANAGER: return 'Manager';
            case UserRole.SUPPLIER_SALES: return 'Sales Rep';
            default: return role;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-system-text tracking-tight">Team Management</h2>
                    <p className="text-system-textSec">Manage your company's team members</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-system-text text-white px-6 py-3 rounded-xl font-medium hover:bg-black transition-colors"
                >
                    Add Team Member
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Add User Form */}
            {showAddForm && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6">Add New Team Member</h3>
                    <form onSubmit={handleAddUser} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="team.member@company.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-system-textSec uppercase tracking-wide mb-2">Role</label>
                            <select
                                className="w-full px-4 py-3 bg-system-bg border-0 rounded-xl text-system-text outline-none focus:ring-2 focus:ring-system-blue"
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                            >
                                <option value={UserRole.SUPPLIER_MANAGER}>Manager</option>
                                <option value={UserRole.SUPPLIER_SALES}>Sales Rep</option>
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-system-text text-white px-6 py-3 rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Adding...' : 'Add User'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewUser({ email: '', password: '', role: UserRole.SUPPLIER_MANAGER });
                                    setError('');
                                }}
                                className="bg-white border border-system-border text-system-textSec px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Team Members List */}
            <div className="bg-white rounded-3xl shadow-card border border-system-border/50 overflow-hidden">
                <div className="p-6 border-b border-system-border">
                    <h3 className="text-lg font-semibold text-system-text">Current Team Members</h3>
                </div>
                <div className="divide-y divide-system-border/50">
                    {companyUsers.map(teamUser => (
                        <div key={teamUser.id} className="p-6 flex items-center justify-between hover:bg-system-bg/30 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-system-blue/10 rounded-full flex items-center justify-center">
                                    <span className="text-system-blue font-semibold text-lg">
                                        {teamUser.email.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <div className="font-medium text-system-text">{teamUser.email}</div>
                                    <div className="text-sm text-system-textSec">{getRoleDisplayName(teamUser.role)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    teamUser.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {teamUser.is_active ? 'Active' : 'Inactive'}
                                </span>
                                {teamUser.role !== UserRole.SUPPLIER_OWNER && (
                                    <button
                                        onClick={() => handleRemoveUser(teamUser.id, teamUser.email)}
                                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {companyUsers.length === 0 && (
                    <div className="p-12 text-center text-system-textSec">
                        <span className="text-4xl mb-4 block">👥</span>
                        <p>No team members yet. Add some to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ComplaintsManagement() {
    const { user } = useApp();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadComplaints();
    }, []);

    const loadComplaints = async () => {
        try {
            const data = await api.getMyComplaints();
            setComplaints(data);
        } catch (error) {
            console.error('Failed to load complaints:', error);
        } finally {
            setLoading(false);
        }
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

    const escalatedComplaints = complaints.filter(c => c.status === ComplaintStatus.ESCALATED);
    const allComplaints = complaints.filter(c => c.status !== ComplaintStatus.ESCALATED);

    if (loading) return <div>Loading complaints...</div>;

    return (
        <div className="space-y-8 animate-in fade-in">
            <div>
                <h2 className="text-2xl font-bold text-system-text tracking-tight">Complaint Management</h2>
                <p className="text-system-textSec">
                    {user?.role === UserRole.SUPPLIER_MANAGER 
                        ? "Review and resolve escalated customer complaints"
                        : "Overview of all customer complaints"}
                </p>
            </div>

            {/* Escalated Complaints (Manager Priority) */}
            {escalatedComplaints.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-card border border-red-200/50">
                    <h3 className="text-lg font-semibold text-system-text mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-system-red rounded-full animate-pulse"></span>
                        Escalated Complaints (Requires Manager Action)
                    </h3>
                    <div className="space-y-4">
                        {escalatedComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-red-50 rounded-2xl border border-red-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">Complaint #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            Order #{complaint.order_id}
                                            {complaint.created_by && ` • From User #${complaint.created_by}`}
                                        </p>
                                        <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                            ESCALATED
                                        </span>
                                    </div>
                                    {user?.role === UserRole.SUPPLIER_MANAGER && (
                                        <button
                                            onClick={() => handleResolve(complaint.id)}
                                            className="bg-system-green text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                                        >
                                            Resolve
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Other Complaints */}
            <div className="bg-white p-8 rounded-3xl shadow-card border border-system-border/50">
                <h3 className="text-lg font-semibold text-system-text mb-6">All Complaints</h3>
                {allComplaints.length === 0 ? (
                    <p className="text-system-textSec text-sm">No complaints to display</p>
                ) : (
                    <div className="space-y-4">
                        {allComplaints.map(complaint => (
                            <div key={complaint.id} className="p-5 bg-system-bg rounded-2xl border border-system-border/50">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="font-semibold text-system-text">Complaint #{complaint.id}</span>
                                        <p className="text-xs text-system-textSec mt-1">
                                            Order #{complaint.order_id}
                                            {complaint.created_by && ` • From User #${complaint.created_by}`}
                                        </p>
                                        <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                                            complaint.status === ComplaintStatus.OPEN ? 'bg-yellow-100 text-yellow-700' :
                                            complaint.status === ComplaintStatus.RESOLVED ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {complaint.status}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-system-text">{complaint.description}</p>
                                {complaint.handler_id && (
                                    <p className="text-xs text-system-textSec mt-3">Handled by: Sales Rep #{complaint.handler_id}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}